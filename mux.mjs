#!/usr/bin/env node
// Locución: mezcla los wav de assets/vo/ sobre un video ya renderizado.
//
//   node mux.mjs <pieza> [--format v] [--check]
//
// Lee assets/vo/cues.json (entrada y máximo de cada línea, duración de la
// pieza) y assets/vo/<id>.wav. Cada línea entra en su momento, se mezclan, se
// normaliza el volumen (loudnorm a -16 LUFS) y el audio se recorta a la
// duración del video. El video no se recodifica (-c:v copy). Reemplaza
// out/<pieza>[-vertical].mp4 por la versión con locución; si el mp4 ya tenía
// audio, se descarta y se mezcla de nuevo.
//
// Antes de mezclar valida, y con --check solo valida:
//   - que la duración de cues.json sea la del mp4 (si no, los cues están
//     pensados para otro corte);
//   - que ninguna línea pise a la siguiente ni termine fuera del video. Con el
//     wav se usa su duración real; sin wav, el máximo del guion.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Misma resolución que render.mjs: en esta máquina FFMPEG apunta a la carpeta.
const FFMPEG = (() => {
  const v = process.env.FFMPEG_EXE || process.env.FFMPEG;
  if (v && /\.exe$|ffmpeg$/i.test(v)) return v;
  if (v && fs.existsSync(path.join(v, "ffmpeg.exe"))) return path.join(v, "ffmpeg.exe");
  return "C:/ffmpeg/bin/ffmpeg.exe";
})();
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m, ext) => `ffprobe${ext ?? ""}`);

const argv = process.argv.slice(2);
const name = argv[0];
if (!name || name.startsWith("--")) {
  console.error("uso: node mux.mjs <pieza> [--format v] [--check]");
  process.exit(1);
}
const vertical = argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "v";
const checkOnly = argv.includes("--check");

const AIRE = 0.25; // aire mínimo entre una línea y la siguiente
const COLA = 0.6; // placa sola al final, sin voz
const TOL = 0.05; // tolerancia de duración video/cues (un frame y medio)

const cuesAll = JSON.parse(fs.readFileSync(path.join(here, "assets/vo/cues.json"), "utf8"));
const cues = cuesAll[name];
if (!cues) {
  console.error(`cues.json no tiene la pieza "${name}"`);
  process.exit(1);
}
const video = path.join(here, "out", `${name}${vertical ? "-vertical" : ""}.mp4`);
if (!fs.existsSync(video)) {
  console.error(`no existe ${video}: renderizalo primero`);
  process.exit(1);
}

function peakDb(file) {
  const r = spawnSync(FFMPEG, ["-v", "info", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  return parseFloat(r.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)[1]);
}

function integratedLufs(file, upTo) {
  const r = spawnSync(FFMPEG, ["-v", "info", "-nostats", "-i", file, "-af", `atrim=0:${upTo},ebur128`, "-f", "null", "-"], { encoding: "utf8" });
  const m = [...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  return parseFloat(m[m.length - 1][1]);
}

// Tempo por autocorrelación del flujo de energía (ventanas de 5 ms), buscando
// el período más fuerte entre 0,4 y 0,8 s (75 a 150 BPM).
function musicTempo(file) {
  const r = spawnSync(FFMPEG, ["-v", "error", "-i", file, "-t", "30", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const HOP = 240;
  const env = [];
  for (let i = 0; i + HOP <= x.length; i += HOP) {
    let s = 0;
    for (let j = i; j < i + HOP; j++) s += x[j] * x[j];
    env.push(Math.log(1e-9 + Math.sqrt(s / HOP)));
  }
  const flux = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v)));
  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const fz = flux.map((v) => v - mean);
  let best = -Infinity;
  let bestLag = 120;
  for (let lag = 80; lag <= 160; lag++) {
    let s = 0;
    for (let i = 0; i + lag < fz.length; i++) s += fz[i] * fz[i + lag];
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  return 60 / ((bestLag * HOP) / 48000);
}

function duration(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const d = parseFloat(r.stdout);
  if (r.status !== 0 || !Number.isFinite(d)) throw new Error(`ffprobe no pudo leer ${file}: ${r.stderr.trim()}`);
  return d;
}

// ─── validación ──────────────────────────────────────────────────────────────
const errors = [];
const vDur = duration(video);
if (Math.abs(vDur - cues.duracion_s) > TOL) {
  errors.push(`el mp4 dura ${vDur.toFixed(3)} s y cues.json dice ${cues.duracion_s} s: los cues son de otro corte`);
}

const lines = cues.lineas.map((c) => {
  const wav = path.join(here, "assets/vo", `${c.id}.wav`);
  const has = fs.existsSync(wav);
  return { ...c, wav, has, dur: has ? duration(wav) : c.maximo };
});

console.log(`${path.basename(video)}: ${vDur.toFixed(3)} s`);
lines.forEach((l, i) => {
  const end = l.at + l.dur;
  const limit = i + 1 < lines.length ? lines[i + 1].at - AIRE : vDur - COLA;
  const src = l.has ? "wav" : "máximo del guion";
  const over = end - limit;
  const tag = over > 1e-6 ? "PASA" : "ok  ";
  console.log(`  ${tag} ${l.id}  ${l.at.toFixed(2)} → ${end.toFixed(2)} s  (${l.dur.toFixed(2)} s, ${src}; límite ${limit.toFixed(2)})`);
  if (over > 1e-6) {
    const next = i + 1 < lines.length ? `pisa a ${lines[i + 1].id}` : "se cae fuera del video";
    errors.push(`${l.id} ${next} por ${over.toFixed(2)} s: alargar esa escena (y re-renderizar) o mover los cues`);
  }
});

// ─── efectos y música ────────────────────────────────────────────────────────
const SFX_SPEC = path.join(here, "assets/sfx/spec.json");
const sfxSpec = fs.existsSync(SFX_SPEC) ? JSON.parse(fs.readFileSync(SFX_SPEC, "utf8")) : null;
const sfxCues = sfxSpec?.cues?.[name]?.lineas ?? [];
const sfxCat = Object.fromEntries((sfxSpec?.catalogo ?? []).map((c) => [c.id, c]));
const findAsset = (dir, id) => ["wav", "mp3"].map((e) => path.join(here, dir, `${id}.${e}`)).find((f) => fs.existsSync(f));
const sfxIds = [...new Set(sfxCues.map((c) => c.id))];
const sfxFiles = Object.fromEntries(sfxIds.map((id) => [id, findAsset("assets/sfx", id)]));
const sfxMissing = sfxIds.filter((id) => !sfxFiles[id]);
// Los reels comparten una sola cama (assets/music/reels.*) salvo que la pieza
// tenga la suya.
const musicFile = findAsset("assets/music", name) ?? (name.startsWith("reel-") ? findAsset("assets/music", "reels") : undefined);
if (sfxCues.length) {
  for (const c of sfxCues) {
    if (!sfxCat[c.id]) errors.push(`el cue ${c.id} en ${c.at} s no está en el catálogo`);
    const f = sfxFiles[c.id];
    const dur = f ? duration(f) - (sfxCat[c.id]?.recorte_inicio_s ?? 0) : sfxCat[c.id]?.duracion_s ?? 0;
    if (c.at + dur > vDur + 0.01) errors.push(`${c.id} en ${c.at} s se sale del video`);
  }
  console.log(`  efectos: ${sfxCues.length} cues de ${sfxIds.length} sonidos${sfxMissing.length ? `, faltan ${sfxMissing.join(", ")}` : ", todos presentes"}`);
}
if (musicFile) {
  const md = duration(musicFile);
  if (md < vDur) errors.push(`la música dura ${md.toFixed(2)} s y el video ${vDur.toFixed(2)} s`);
  console.log(`  música: ${path.basename(musicFile)} (${md.toFixed(2)} s)`);
  // Los reels cortan sobre una grilla de 100 BPM: la música tiene que estar a
  // ese tempo, o los golpes visuales no caen con ella.
  if (name.startsWith("reel-")) {
    const bpm = musicTempo(musicFile);
    const ok = [100, 50, 200].some((b) => Math.abs(bpm - b) <= 2);
    console.log(`  tempo de la música: ${bpm.toFixed(1)} BPM ${ok ? "(ok, grilla de 100)" : "(NO coincide con la grilla de 100 BPM)"}`);
    if (!ok) errors.push(`la música está a ${bpm.toFixed(1)} BPM y los reels están cortados a 100 BPM`);
  }
}

const missing = lines.filter((l) => !l.has).map((l) => l.id);
if (errors.length) {
  console.error("\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
if (checkOnly) {
  console.log(missing.length ? `\nTiempos consistentes. Faltan wav: ${missing.join(", ")}` : "\nTiempos consistentes y todos los wav presentes.");
  process.exit(0);
}
if (missing.length || sfxMissing.length) {
  console.error(`faltan archivos: ${[...missing, ...sfxMissing].join(", ")}`);
  process.exit(1);
}

// ─── mezcla ──────────────────────────────────────────────────────────────────
const ST = "aformat=sample_rates=48000:channel_layouts=stereo";
// Relleno acotado: un apad sin límite es una fuente infinita, y si el fin de
// atrim no llega a propagarse ffmpeg queda girando sin escribir (pasó en
// reel-formularios y en reel-hoy, de forma intermitente).
const END = `apad=whole_dur=${vDur.toFixed(3)},atrim=0:${vDur.toFixed(3)}`;
// Tope por llamada: si ffmpeg se cuelga igual, que falle en vez de esperar para siempre.
const FF_TIMEOUT_MS = 180000;
const layered = sfxCues.length > 0 || !!musicFile;
const voiceChains = (base) =>
  lines
    .map((l, i) => `[${i + base}:a]${ST},adelay=${Math.round(l.at * 1000)}:all=1[v${i}]`)
    .concat(`${lines.map((_, i) => `[v${i}]`).join("")}amix=inputs=${lines.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000`);
const voiceInputs = lines.flatMap((l) => ["-i", l.wav]);

function ff(args, what) {
  const r = spawnSync(FFMPEG, ["-y", "-v", "error", ...args], { stdio: "inherit", timeout: FF_TIMEOUT_MS });
  if (r.status !== 0) {
    console.error(`ffmpeg falló en ${what}${r.error?.code === "ETIMEDOUT" ? " (colgado, cortado a los " + FF_TIMEOUT_MS / 1000 + " s)" : ""}; el video original quedó intacto`);
    process.exit(1);
  }
}

let inputs;
let graph;
if (!layered) {
  // Solo voz (las piezas publicitarias): igual que siempre.
  inputs = ["-i", video, ...voiceInputs];
  const vc = voiceChains(1);
  vc[vc.length - 1] += `,${END}[a]`;
  graph = vc.join(";");
} else {
  // Tres capas. Cada una se renderiza sola a un wav (quedan en build/mix/ para
  // medirlas) y después se suman. Grafos chicos e independientes: con todo en
  // uno, repartir un efecto a cues separados por minutos traba a ffmpeg.
  const dir = path.join(here, "build", "mix", `${name}${vertical ? "-vertical" : ""}`);
  fs.mkdirSync(dir, { recursive: true });
  const stems = [];
  {
    const vc = voiceChains(0);
    vc[vc.length - 1] += `,${END}[o]`;
    ff([...voiceInputs, "-filter_complex", vc.join(";"), "-map", "[o]", "-c:a", "pcm_s24le", path.join(dir, "voz.wav")], "la voz");
    stems.push(path.join(dir, "voz.wav"));
  }
  if (sfxCues.length) {
    // Una entrada por cue: cada efecto se lleva a -1 dBFS de pico, se recorta si
    // el catálogo lo pide, recibe su gain_db y se ubica en su momento.
    const norm = Object.fromEntries(sfxIds.map((id) => [id, -1 - peakDb(sfxFiles[id])]));
    const ins = sfxCues.flatMap((c) => ["-i", sfxFiles[c.id]]);
    const ch = sfxCues.map((c, i) => {
      const trim = sfxCat[c.id]?.recorte_inicio_s ?? 0;
      return `[${i}:a]${ST},atrim=start=${trim},asetpts=PTS-STARTPTS,volume=${(norm[c.id] + c.gain_db).toFixed(2)}dB,adelay=${Math.round(c.at * 1000)}:all=1[e${i}]`;
    });
    ch.push(`${sfxCues.map((_, i) => `[e${i}]`).join("")}amix=inputs=${sfxCues.length}:normalize=0:dropout_transition=0,${END}[o]`);
    ff([...ins, "-filter_complex", ch.join(";"), "-map", "[o]", "-c:a", "pcm_s24le", path.join(dir, "efectos.wav")], "los efectos");
    stems.push(path.join(dir, "efectos.wav"));
  }
  if (musicFile) {
    // Música a -30 LUFS, con ducking de -8 dB mientras habla la voz: la
    // envolvente vale 1 durante cada línea (rampa de 150 ms antes y 600 ms
    // después) y 0 en los silencios.
    const gain = -30 - integratedLufs(musicFile, vDur);
    const terms = lines.map((l) => {
      const a0 = (l.at - 0.15).toFixed(3);
      const b0 = (l.at + l.dur + 0.6).toFixed(3);
      return `min(clip((t-${a0})/0.15\\,0\\,1)\\,clip((${b0}-t)/0.6\\,0\\,1))`;
    });
    const duck = terms.reduce((acc, x) => (acc ? `max(${acc}\\,${x})` : x), "");
    const ch = `[0:a]${ST},atrim=0:${vDur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${gain.toFixed(2)}dB,volume='pow(10\\,-0.4*(${duck}))':eval=frame,afade=t=in:d=1.5,afade=t=out:st=${(vDur - 2.5).toFixed(3)}:d=2.5,${END}[o]`;
    ff(["-i", musicFile, "-filter_complex", ch, "-map", "[o]", "-c:a", "pcm_s24le", path.join(dir, "musica.wav")], "la música");
    stems.push(path.join(dir, "musica.wav"));
  }
  inputs = ["-i", video, ...stems.flatMap((f) => ["-i", f])];
  graph = `${stems.map((_, i) => `[${i + 1}:a]`).join("")}amix=inputs=${stems.length}:normalize=0:dropout_transition=0,${END}[a]`;
  console.log(`  capas en ${dir}`);
}

const tmp = video.replace(/\.mp4$/, ".con-voz.tmp.mp4");
const args = ["-y", "-v", "error", ...inputs, "-filter_complex", graph, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp];
const r = spawnSync(FFMPEG, args, { stdio: "inherit", timeout: FF_TIMEOUT_MS });
if (r.status !== 0) {
  fs.rmSync(tmp, { force: true });
  console.error("ffmpeg falló; el video original quedó intacto");
  process.exit(1);
}
const outDur = duration(tmp);
if (Math.abs(outDur - vDur) > TOL) {
  fs.rmSync(tmp, { force: true });
  console.error(`la mezcla dura ${outDur.toFixed(3)} s y el video ${vDur.toFixed(3)} s; no se reemplazó nada`);
  process.exit(1);
}
fs.renameSync(tmp, video);
console.log(`\n${layered ? "voz, efectos y música mezclados" : "locución mezclada"} en ${video}`);
