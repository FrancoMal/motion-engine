#!/usr/bin/env node
// CLI de render. Reparte frames entre workers, los reordena y los manda crudos
// (rgb24) por pipe a ffmpeg. Sin archivos intermedios.
//
//   node render.mjs <pieza> [opciones]
//
//   --out <archivo.mp4>     salida (default out/<pieza>.mp4)
//   --from N --to N         rango de frames (to exclusivo)
//   --scale 0.5             resolución relativa (preview)
//   --samples N             fuerza la cantidad de sub-frames del motion blur
//   --workers N             default: núcleos - 2
//   --codec nvenc|x264|fast nvenc = entrega (default), fast = preview rápido
//   --still 12,40,300       en vez de video, PNGs de esos frames en out/stills/
//   --still-story 140,196   idem, con frames del guion original (pasan por el mapa)
//   --sheet [cada=6]        hoja de contactos PNG en out/sheets/ (1 de cada N frames)
//   --nograde               sin grano/viñeta/tono (para depurar)
//   --format v              versión vertical 1080x1920 (out/<pieza>-vertical.mp4)
//
// Piezas en pieces/<pieza>/index.js (default export con width, height, fps,
// duration, draw(ctx, t), y opcionales motion(f) y grade(f)).

import { Worker } from "node:worker_threads";
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { setType } from "./engine/text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// En esta máquina la variable FFMPEG apunta a la carpeta, no al ejecutable.
const FFMPEG = (() => {
  const v = process.env.FFMPEG_EXE || process.env.FFMPEG;
  if (v && /\.exe$|ffmpeg$/i.test(v)) return v;
  if (v && fs.existsSync(path.join(v, "ffmpeg.exe"))) return path.join(v, "ffmpeg.exe");
  return "C:/ffmpeg/bin/ffmpeg.exe";
})();

// ─── argumentos ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const name = argv[0];
if (!name || name.startsWith("--")) {
  console.error("uso: node render.mjs <pieza> [--out f.mp4] [--from N --to N] [--scale 0.5] [--still a,b] [--sheet 6]");
  process.exit(1);
}
const opt = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2);
  const next = argv[i + 1];
  if (next !== undefined && !next.startsWith("--")) {
    opt[k] = next;
    i++;
  } else opt[k] = true;
}

// Formato: horizontal (default) o vertical. Se fija ANTES de cargar la pieza:
// las escenas leen el formato cuando se evalúan (engine/format.js), y los
// workers heredan la variable.
const vertical = opt.format === "v" || opt.format === "vertical";
if (vertical) process.env.TRAZO_FORMAT = "v";
const tag = vertical ? `${name}-vertical` : name;
const pieceFile = path.join(here, "pieces", name, "index.js");
const pieceUrl = pathToFileURL(pieceFile).href;
const piece = (await import(pieceUrl)).default;
const scale = opt.scale ? parseFloat(opt.scale) : 1;
const nWorkers = opt.workers ? parseInt(opt.workers, 10) : Math.max(1, cpus().length - 2);
const samplesOverride = opt.samples ? parseInt(opt.samples, 10) : undefined;

let frames;
let mode = "video";
if (opt.still || opt["still-story"]) {
  mode = "still";
  // --still-story toma frames del guion original y los pasa por el mapa de
  // re-temporización (útil para revisar un momento puntual del tratamiento).
  frames = opt.still
    ? String(opt.still).split(",").map((s) => parseInt(s, 10))
    : String(opt["still-story"]).split(",").map((s) => Math.round(piece.warp ? piece.warp.out(parseFloat(s)) : parseFloat(s)));
} else if (opt.sheet) {
  mode = "sheet";
  const every = opt.sheet === true ? 6 : parseInt(opt.sheet, 10);
  frames = [];
  for (let f = 0; f < piece.duration; f += every) frames.push(f);
  if (frames[frames.length - 1] !== piece.duration - 1) frames.push(piece.duration - 1);
} else {
  const from = opt.from ? parseInt(opt.from, 10) : 0;
  const to = opt.to ? parseInt(opt.to, 10) : piece.duration;
  frames = [];
  for (let f = from; f < to; f++) frames.push(f);
}

const sheetScale = mode === "sheet" ? (opt.scale ? scale : 0.25) : scale;
const W = Math.round(piece.width * sheetScale);
const H = Math.round(piece.height * sheetScale);

// ─── salida ──────────────────────────────────────────────────────────────────
fs.mkdirSync(path.join(here, "out"), { recursive: true });
let ff = null;
let ffDone = null;
if (mode === "video") {
  const out = opt.out ? path.resolve(opt.out) : path.join(here, "out", `${tag}.mp4`);
  const codec = opt.codec || "nvenc";
  const enc =
    codec === "nvenc"
      ? ["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-multipass", "fullres", "-rc", "vbr", "-cq", "16", "-b:v", "0",
         "-maxrate", "30M", "-bufsize", "60M", "-profile:v", "high", "-spatial-aq", "1", "-temporal-aq", "1",
         "-rc-lookahead", "32", "-bf", "3", "-g", "60"]
      : codec === "x264"
        ? ["-c:v", "libx264", "-preset", "slow", "-crf", "14", "-profile:v", "high", "-g", "60"]
        : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21"];
  const args = [
    "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(piece.fps), "-i", "-",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p",
    ...enc,
    "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-movflags", "+faststart", out,
  ];
  ff = spawn(FFMPEG, args, { stdio: ["pipe", "inherit", "inherit"] });
  ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res(out) : rej(new Error("ffmpeg salió con " + c)))));
}

// ─── workers ─────────────────────────────────────────────────────────────────
const t0 = performance.now();
const results = new Map();
let nextWrite = 0; // índice dentro de `frames`
let dispatched = 0;
const windowSize = nWorkers * 3;
let finished = 0;
let msTotal = 0;
const sheetFrames = [];

const workers = [];
await new Promise((resolveAll, rejectAll) => {
  let ready = 0;
  const count = Math.min(nWorkers, frames.length);
  for (let i = 0; i < count; i++) {
    const w = new Worker(path.join(here, "engine", "worker.mjs"), {
      workerData: { pieceUrl, scale: sheetScale, samplesOverride, gradeOff: !!opt.nograde },
    });
    w.busy = false;
    // Un error en un worker aborta el render entero: si no, el proceso se
    // quedaría esperando un frame que nunca llega.
    w.on("error", (err) => {
      console.error(`
error en un worker: ${err && err.stack ? err.stack : err}`);
      rejectAll(err);
      process.exit(1);
    });
    w.on("exit", (code) => {
      if (code !== 0 && finished < frames.length) {
        console.error(`
un worker terminó con código ${code}`);
        process.exit(1);
      }
    });
    w.on("message", async (msg) => {
      if (msg.type === "ready") {
        if (++ready === count) resolveAll();
        return;
      }
      if (msg.type === "done") {
        w.busy = false;
        msTotal += msg.ms;
        results.set(msg.frame, msg.rgb);
        await flush();
        pump();
      }
    });
    workers.push(w);
  }
});

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  while (nextWrite < frames.length && results.has(frames[nextWrite])) {
    const f = frames[nextWrite];
    const rgb = results.get(f);
    results.delete(f);
    if (mode === "video") {
      if (!ff.stdin.write(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength))) {
        await new Promise((r) => ff.stdin.once("drain", r));
      }
    } else if (mode === "still") {
      writePng(rgb, path.join(here, "out", "stills", `${tag}-${String(f).padStart(4, "0")}.png`));
    } else {
      sheetFrames.push({ f, rgb });
    }
    nextWrite++;
    finished++;
    if (finished % 30 === 0 || finished === frames.length) {
      const el = (performance.now() - t0) / 1000;
      process.stdout.write(`\r${name}: ${finished}/${frames.length} frames · ${el.toFixed(1)} s · ${(msTotal / finished).toFixed(0)} ms/frame por worker   `);
    }
  }
  flushing = false;
}

function pump() {
  for (const w of workers) {
    if (dispatched >= frames.length) break;
    if (w.busy) continue;
    if (dispatched >= nextWrite + windowSize) break;
    w.busy = true;
    w.postMessage({ type: "frame", frame: frames[dispatched++] });
  }
}

pump();
await new Promise((res) => {
  const iv = setInterval(() => {
    if (finished >= frames.length) {
      clearInterval(iv);
      res();
    }
  }, 50);
});
for (const w of workers) await w.terminate();
process.stdout.write("\n");

if (mode === "video") {
  ff.stdin.end();
  const out = await ffDone;
  console.log(`listo: ${out} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
} else if (mode === "sheet") {
  const every = opt.sheet === true ? 6 : parseInt(opt.sheet, 10);
  const cols = 6;
  const pad = 6;
  const label = 22;
  const rows = Math.ceil(sheetFrames.length / cols);
  const sheet = createCanvas(cols * (W + pad) + pad, rows * (H + pad + label) + pad);
  const sc = sheet.getContext("2d");
  sc.fillStyle = "#111";
  sc.fillRect(0, 0, sheet.width, sheet.height);
  sheetFrames.forEach(({ f, rgb }, i) => {
    const c = createCanvas(W, H);
    const cx = c.getContext("2d");
    cx.putImageData(rgbToImageData(cx, rgb, W, H), 0, 0);
    const x = pad + (i % cols) * (W + pad);
    const y = pad + Math.floor(i / cols) * (H + pad + label);
    sc.drawImage(c, x, y + label);
    setType(sc, { size: 15, weight: 600 });
    sc.fillStyle = "#ddd";
    sc.fillText(`f${f}  ${(f / piece.fps).toFixed(2)}s`, x + 2, y + 16);
  });
  const file = path.join(here, "out", "sheets", `${tag}-cada${every}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sheet.toBuffer("image/png"));
  console.log("hoja: " + file);
} else {
  console.log("stills en " + path.join(here, "out", "stills"));
}

function rgbToImageData(ctx, rgb, w, h) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
    d[i] = rgb[j];
    d[i + 1] = rgb[j + 1];
    d[i + 2] = rgb[j + 2];
    d[i + 3] = 255;
  }
  return img;
}

function writePng(rgb, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const c = createCanvas(W, H);
  const cx = c.getContext("2d");
  cx.putImageData(rgbToImageData(cx, rgb, W, H), 0, 0);
  fs.writeFileSync(file, c.toBuffer("image/png"));
}
