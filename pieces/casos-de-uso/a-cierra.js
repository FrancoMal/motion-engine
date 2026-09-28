// Pieza 2, escena A: "Cierra el período." (tratamiento final 4.2), f0-62, Papel.
//
// La pieza abre con un impacto: el punto de acento (el cabezal) cae sobre la
// línea del período en el primer frame, la línea acusa el golpe como una cuerda
// y el punto corre el tramo "Medio" dejando la tinta de acento detrás (T16). En
// f14 pega contra la marca del final de "Medio", la marca se flexiona como un
// trampolín y lo lanza en arco hasta el lugar del punto final de la frase: el
// período escolar y la oración terminan en el mismo punto. Después el punto
// tiembla, crece (anticipación de T17) y en f56 se lo entrega a B.
//
// Capas (2.6): L0 papel · L1 "Medio" fantasma a z +900 (se entinta con el
// avance del cabezal) · L2 grilla de 12 columnas a z +300 · mundo z 0 (línea,
// marcas, rótulos) · punto en pantalla · L5 motas a z -400. La cámara del mundo
// (arranque ya en movimiento, empujón de f14, pulso de mano) mueve solo las
// capas del mundo, con paralaje por profundidad. La frase vive en drawTop, fija
// a la pantalla, y se evapora arriba del barrido crema de B.
//
// Contrato C-P2-1: en f56 el punto está en (1625, 457), d 34, #c2410c. A deja
// de dibujarlo en t >= 56 (lo dibuja B); la frase se evapora sin su punto.

import { createCanvas } from "@napi-rs/canvas";
import { EASE, SPR, spr, p, ring, punch } from "../../shared/system.js";
import { makePhrase, drawPhrase, drawDot, tinta, inhala } from "../../shared/phrase.js";
import { flight } from "../../shared/punto.js";
import { C } from "../../shared/brand.js";
import { setType, drawText } from "../../engine/text.js";
import { emit } from "../../engine/env.js";
import { cubicBezier, kf, E } from "../../engine/ease.js";
import { clamp, lerp, fbm1, noise1, hash1, smoothstep, deg } from "../../engine/math.js";

// ─── geometría ───────────────────────────────────────────────────────────────

const LINE_Y = 700;
const LX0 = 120;
const LX1 = 1800;
const TICKS = [120, 680, 1240, 1800];
const TICK_W = 4;
const TICK_H = 28;
const LABELS = [
  { text: "Inicial", x: 400 },
  { text: "Medio", x: 960 },
  { text: "Final", x: 1520 },
];
const LABEL_STYLE = { size: 36, weight: 600, tracking: 0 };
const LABEL_BASE = 770;

// Cabezal.
const DOT_D = 30;
const LAND_X = 690; // contacto con la línea en f0
const TC = -0.6; // instante exacto del contacto (dentro del obturador de f0)
const FALL_T = 3.5; // duración de la caída (frames)
const FALL_H = 315; // altura de la caída: llega a ~360 px/f
const RUN_S = 4;
// Contacto con la marca: dentro del obturador de f14 ([13,25, 14]), así el
// frame del beat ya muestra el golpe (punto aplastado, "Cierra" cerrada) con la
// estela detrás, igual que el contacto de f0.
const RUN_H = 13.3;
const PUNCH_F = 14; // punch 1 de la pieza (cámara del mundo), en la grilla
const ARC_T0 = 14; // el punto queda aplastado contra la marca hasta f14 y sale
const RUN_X = 1240 - TICK_W / 2 - DOT_D / 2; // el borde del punto toca la marca
const ANTIC = 8; // retroceso antes de correr
// Corrida acelerada que llega a ~90 px/f (pendiente final 1,6): se ve avanzar
// desde f6 y pega en la marca con velocidad, sin quedarse quieta medio beat.
const RUN_EASE = cubicBezier(0.42, 0, 0.72, 0.55);

// Punto final de la frase (contrato C-P2-1 y handle del layout).
const PERIOD = { x: 1625, y: 457 };
const PERIOD_D = 27; // diámetro de la tinta del "." a 200 px w760 (medido)
const HANDOFF_D = 34;
const LAND = 19; // aterrizaje del punto como punto final

// Arco f14-19: cuadrática con control (1500, 380) escrita como cúbica.
const ARC_C = [1500, 380];
const ARC_P0 = [RUN_X, LINE_Y];
const ARC_P3 = [PERIOD.x, PERIOD.y];
const ARC = {
  t0: ARC_T0,
  t1: LAND,
  P0: ARC_P0,
  P1: [ARC_P0[0] + (2 / 3) * (ARC_C[0] - ARC_P0[0]), ARC_P0[1] + (2 / 3) * (ARC_C[1] - ARC_P0[1])],
  P2: [ARC_P3[0] + (2 / 3) * (ARC_C[0] - ARC_P3[0]), ARC_P3[1] + (2 / 3) * (ARC_C[1] - ARC_P3[1])],
  P3: ARC_P3,
  ease: EASE.brake,
};

// Profundidades (2.6): escala de paralaje F / (F + z) con F = 1400.
const depth = (z) => 1400 / (1400 + z);
const S_GHOST = depth(900); // 0.61
const S_GRID = depth(300); // 0.82
const S_MOTE = depth(-400); // 1.40

// ─── frase ───────────────────────────────────────────────────────────────────

const phrase = makePhrase({
  text: "Cierra el período.",
  size: 200,
  wght: 760,
  tracking: -0.045,
  x: 120,
  baseline: 470,
  color: C.ink,
  periodColor: C.accent,
});

// KC "Cierre" con contacto en la grilla: el tracking se cierra acelerando y
// pega en H con velocidad (el cabezal pega en la marca en el mismo instante),
// se pasa 0,02 em y vuelve como un resorte. El peso carga 300 → 800 con
// el cierre y asienta en 760.
const closeEase = cubicBezier(0.45, 0, 0.8, 0.8);
const cierreGolpe = (H, word) => (t, g, st, ph) => {
  if (g.word !== word) return;
  const S = H - 6;
  st.alpha *= clamp((t - (H - 7)) / 3);
  let tr;
  if (t < S) tr = 0.35;
  else if (t < H) tr = 0.35 * (1 - closeEase((t - S) / 6));
  else {
    // Después del contacto el tracking sigue de largo como un resorte
    // amortiguado (pico -0,02 em a los ~1,4 f) y se apaga antes de f19, así
    // "Cierra" ya está quieta cuando entinta "período".
    const u = t - H;
    tr = -0.043 * Math.sin(((2 * Math.PI) / 8) * u) * Math.exp(-u / 2.2);
  }
  st.dx += g.wordLocal * tr * ph.size;
  st.weight = t < H ? lerp(300, 800, closeEase(clamp((t - S) / 6))) : lerp(800, ph.wght, EASE.swell(clamp((t - H) / 8)));
};

// K5 "Evaporar" comprimido para terminar antes de f62 (topEnd): 0,15 f de
// stagger, 3,1 f por glifo, así el frame 62 ya no tiene restos que desaparezcan
// de golpe cuando drawTop deja de llamarse. La tinta se va primero (el peso cae rápido) y después el
// glifo se deja llevar 0,30 em a la derecha y 14 px arriba, acelerando.
const EVAP = 56;
const EVAP_STAGGER = 0.15;
const EVAP_DUR = 3.1; // el último glifo termina en 56 + 14·0,15 + 3,1 = 61,2
const evaporarA = (X) => (t, g, st, ph) => {
  const s = X + g.i * EVAP_STAGGER;
  if (t <= s) return;
  const u = clamp((t - s) / EVAP_DUR);
  const k = EASE.accel(u);
  st.weight = lerp(st.weight, 200, EASE.ink(u));
  st.dx += 0.3 * ph.size * k;
  st.dy -= 14 * k;
  st.alpha *= 1 - k;
};

const PROGRAM = [
  cierreGolpe(RUN_H, 0), // "Cierra" se cierra con el golpe del cabezal (f14)
  tinta(16.5, { word: 1 }), // "el", pegado al golpe
  (t, g, st) => {
    // "el" no aparece hasta que "Cierra" terminó de cerrarse (no se pisan).
    if (g.word === 1) st.alpha *= clamp((t - 13.6) / 1.2);
  },
  tinta(LAND, { word: 2, stagger: 0.6 }), // "período" entinta cuando llega el punto
  inhala(52, 56, 728), // la frase toma aire antes del estallido
  evaporarA(EVAP),
];

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Afines 2D como las de canvas: [a, b, c, d, e, f].

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const Tm = (x, y) => [1, 0, 0, 1, x, y];
const Sm = (s) => [s, 0, 0, s, 0, 0];
const Rm = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const about = (x, y, m) => mul(Tm(x, y), mul(m, Tm(-x, -y)));
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// Arranque: en f0 zoom 1,06 y roll 1,5°, que llegan a 1 / 0° en f20 con swell.
// La curva empieza en f-6 para que el frame 0 ya esté en movimiento.
const OPEN_T0 = -6;
const OPEN_T1 = 20;
const OPEN_K0 = EASE.swell((0 - OPEN_T0) / (OPEN_T1 - OPEN_T0));
const OPEN_Z = 1 + 0.06 / (1 - OPEN_K0);
const OPEN_ROLL = 1.5 / (1 - OPEN_K0);
const PIVOT_OPEN = [LAND_X, LINE_Y];
const PIVOT_PUNCH = [1240, LINE_Y];

function camParams(t) {
  const k = EASE.swell(clamp((t - OPEN_T0) / (OPEN_T1 - OPEN_T0)));
  const zoom = lerp(OPEN_Z, 1, k);
  const roll = deg(lerp(OPEN_ROLL, 0, k));
  // Dolly lento durante la lectura (~1 %/s) anclado en el extremo izquierdo de
  // la línea (x 120), así la alineación con la frase no se pierde: el mundo
  // crece detrás del texto quieto y las capas se separan por paralaje.
  const push = 1 + 0.014 * EASE.swell(clamp((t - 16) / 46));
  // Grúa suave hacia arriba en la lectura: el mundo sube 16 px (las capas lo
  // siguen según su profundidad) mientras la frase queda quieta.
  const boom = -16 * EASE.swell(clamp((t - 18) / 44));
  const pu = punch(t, PUNCH_F);
  // Pulso de mano (solo P2): 1,5 px, 0,4 Hz, roll 0,15°, semilla fija. Se
  // apaga en los 4 f previos al estallido.
  const hk = 1 - smoothstep(52, 56, t);
  const hx = 1.5 * fbm1(t / 40, 101, 2) * hk;
  const hy = 1.5 * fbm1(t / 40, 202, 2) * hk;
  const hr = deg(0.15) * fbm1(t / 40, 303, 2) * hk;
  return { zoom, roll, push, boom, pu, hx, hy: hy + boom, hr };
}

// Matriz del mundo para una capa con factor de paralaje s (1 = plano z 0).
function camMatrix(t, s = 1) {
  const c = camParams(t);
  let m = Tm(c.hx * s, c.hy * s);
  m = mul(m, about(960, 540, Rm(c.hr)));
  m = mul(m, about(PIVOT_OPEN[0], PIVOT_OPEN[1], mul(Sm(1 + (c.zoom - 1) * s), Rm(c.roll))));
  m = mul(m, about(LX0, LINE_Y, Sm(1 + (c.push - 1) * s)));
  m = mul(m, about(PIVOT_PUNCH[0], PIVOT_PUNCH[1], Sm(1 + (c.pu - 1) * s)));
  return m;
}
const matScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

// ─── la línea como cuerda ────────────────────────────────────────────────────
// El contacto de f0 hunde la línea bajo el punto (resorte amortiguado) y manda
// dos pulsos que corren hacia los extremos. En px, positivo hacia abajo.

function deflect(x, t) {
  if (t < TC || t > 22) return 0;
  const u = t - TC;
  const local = 11 * Math.exp(-u / 2.4) * Math.sin((2 * Math.PI * u) / 4.6) * Math.exp(-(((x - LAND_X) / 160) ** 2));
  const env = 4.2 * Math.exp(-u / 6) * clamp(u / 0.8);
  const c = 95;
  const g = (d) => Math.exp(-((d / 52) ** 2));
  return local + env * (g(x - LAND_X - c * u) + g(x - LAND_X + c * u));
}

// ─── el cabezal: posición, deformación, tamaño ───────────────────────────────

// x del cabezal sobre la línea (mundo) mientras corre.
function runX(t) {
  if (t < 1.5) return LAND_X;
  if (t < RUN_S) return LAND_X - ANTIC * EASE.swell((t - 1.5) / (RUN_S - 1.5));
  return lerp(LAND_X - ANTIC, RUN_X, RUN_EASE(clamp((t - RUN_S) / (RUN_H - RUN_S))));
}

// Punta del relleno de acento de "Medio" (sigue al borde delantero del punto).
function fillEnd(t) {
  if (t < RUN_S) return 680;
  return Math.min(1240, Math.max(680, runX(t) + DOT_D / 2));
}

// Posición del punto en coordenadas de mundo (antes de la cámara) o de
// pantalla (desde el arco). Devuelve { x, y, w } donde w es cuánto vale ya la
// pantalla (0 = mundo, 1 = pantalla).
function dotWorld(t) {
  if (t < TC) {
    const u = clamp((t - (TC - FALL_T)) / FALL_T);
    return { x: LAND_X, y: LINE_Y - FALL_H * (1 - EASE.accel(u)), w: 0 };
  }
  if (t < ARC_T0) {
    const x = runX(t);
    return { x, y: LINE_Y + deflect(x, t), w: 0 };
  }
  if (t < LAND) {
    const f = flight(t, ARC);
    return { x: f.x, y: f.y, w: smoothstep(0, 1, f.k) };
  }
  return { x: PERIOD.x, y: PERIOD.y, w: 1 };
}

// Posición del punto en pantalla.
function dotScreen(t) {
  const d = dotWorld(t);
  if (d.w >= 1) return [d.x, d.y];
  const [sx, sy] = apply(camMatrix(t), d.x, d.y);
  return [lerp(sx, d.x, d.w), lerp(sy, d.y, d.w)];
}

// Temblor de anticipación (f53-56): ±2 px, se junta y queda quieto en f56.
function tremble(t) {
  if (t < 53 || t >= 56) return [0, 0];
  const a = 2 * smoothstep(53, 54.2, t) * clamp((56 - t) / 1.2);
  return [a * noise1(t * 1.7, 71), a * noise1(t * 1.7, 83)];
}

// Diámetro del punto.
function dotDiameter(t) {
  if (t < ARC_T0) return DOT_D;
  if (t < LAND) {
    // En vuelo se acerca a cámara (z -300 a mitad de arco) y llega grande.
    const k = flight(t, ARC).k;
    return lerp(DOT_D, PERIOD_D * 1.3, k) * (1 + 0.22 * Math.sin(Math.PI * k));
  }
  if (t < 53) return PERIOD_D * lerp(1.3, 1, spr(t, LAND, SPR.slam));
  return lerp(PERIOD_D, HANDOFF_D, EASE.swell(p(t, 53, 56)));
}

// Squash y stretch: { along, across, ang, wx, wy } (stretch por velocidad a lo
// largo de la dirección de movimiento, y deformación de contacto en x / y).
const segOf = (t) => (t < TC ? 0 : t < RUN_H ? 1 : t < ARC_T0 ? 2 : t < LAND ? 3 : 4);
function dotDeform(t) {
  // Velocidad por diferencia dentro del mismo tramo (sin mezclar la caída con
  // el contacto ni la corrida con el arco).
  const dt = 0.08;
  const back = segOf(t - dt) === segOf(t);
  const ta = back ? t - dt : t;
  const tb = back ? t : t + dt;
  const [x0, y0] = dotScreen(ta);
  const [x1, y1] = dotScreen(tb);
  const vx = (x1 - x0) / dt;
  const vy = (y1 - y0) / dt;
  const v = Math.hypot(vx, vy);
  const ang = Math.atan2(vy, vx);
  let along = 1;
  if (t < TC) along = 1 + 0.55 * clamp(v / 360);
  else if (t >= RUN_S && t < RUN_H) along = 1 + 0.6 * clamp(v / 220);
  else if (t >= ARC_T0 && t < LAND) along = 1 + 0.85 * clamp(v / 300);
  const across = 1 / Math.sqrt(along);
  // Contactos: aplasta contra la línea en f0 y contra la marca en f14.
  let wx = 1;
  let wy = 1;
  if (t >= TC && t < 12) {
    const k = spr(t, TC, SPR.snap);
    wx *= lerp(1.12, 1, k);
    wy *= lerp(0.84, 1, k);
  }
  if (t >= RUN_H && t < RUN_H + 12) {
    const k = spr(t, RUN_H, SPR.snap);
    wx *= lerp(0.8, 1, k);
    wy *= lerp(1.18, 1, k);
  }
  return { along, across, ang, wx, wy };
}

function drawDotShape(c, x, y, d, def, color, alpha = 1) {
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.rotate(def.ang);
  c.scale(def.along, def.across);
  c.rotate(-def.ang);
  c.scale(def.wx, def.wy);
  c.beginPath();
  c.arc(0, 0, d / 2, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  c.restore();
}

// ─── capas de profundidad ────────────────────────────────────────────────────

// L1: "Medio" fantasma, 700 px, #f1e9dc, recortado a la derecha. Se cachea
// desenfocado (profundidad de campo) a media resolución y por escalón de peso:
// el peso sube con el avance del cabezal sobre "Medio".
const GHOST_SIZE = 700;
const GHOST_X = 905;
const GHOST_BASE = 1150;
const ghostCache = new Map();
function ghostSprite(weight) {
  const wq = Math.round(weight / 25) * 25;
  let sp = ghostCache.get(wq);
  if (sp) return sp;
  const k = 0.5; // resolución del cache (queda desenfocado igual)
  const size = GHOST_SIZE * k;
  const style = { size, weight: wq, tracking: -0.04 };
  const probe = createCanvas(8, 8).getContext("2d");
  setType(probe, style);
  const m = probe.measureText("Medio");
  const pad = 20;
  const w = Math.ceil(m.width + pad * 2);
  const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2);
  const raw = createCanvas(w, h);
  const rc = raw.getContext("2d");
  setType(rc, style);
  rc.fillStyle = "#f1e9dc";
  rc.textBaseline = "alphabetic";
  rc.fillText("Medio", pad, pad + m.actualBoundingBoxAscent);
  const out = createCanvas(w, h);
  const oc = out.getContext("2d");
  oc.filter = "blur(2.6px)";
  oc.drawImage(raw, 0, 0);
  oc.filter = "none";
  sp = { canvas: out, k, pad, ascent: m.actualBoundingBoxAscent };
  ghostCache.set(wq, sp);
  return sp;
}

function drawGhost(ctx, t) {
  const run = clamp((fillEnd(t) - 680) / (1240 - 680));
  const weight = lerp(220, 560, EASE.ink(run));
  const sp = ghostSprite(weight);
  ctx.save();
  ctx.transform(...camMatrix(t, S_GHOST));
  // Deriva propia muy lenta hacia la izquierda: el fondo nunca está muerto.
  const drift = -0.35 * t;
  ctx.globalAlpha *= 0.72;
  ctx.drawImage(sp.canvas, GHOST_X + drift - sp.pad / sp.k, GHOST_BASE - (sp.pad + sp.ascent) / sp.k, sp.canvas.width / sp.k, sp.canvas.height / sp.k);
  ctx.restore();
}

// L2: grilla de 12 columnas (márgenes 120, calle 24, columna 118) en hairline.
function drawGrid(ctx, t) {
  ctx.save();
  ctx.transform(...camMatrix(t, S_GRID));
  ctx.strokeStyle = "rgba(235,228,214,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c < 12; c++) {
    const xl = 120 + c * 142;
    for (const x of [xl, xl + 118]) {
      ctx.moveTo(x + 0.5, -120);
      ctx.lineTo(x + 0.5, 1200);
    }
  }
  // Dos horizontales: la base de la frase y la línea del período.
  for (const y of [470, LINE_Y]) {
    ctx.moveTo(-200, y + 0.5);
    ctx.lineTo(2120, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

// L5: bokeh de acento cerca de cámara (paralaje 1,4): observaciones fuera de
// foco que flotan delante del papel. Discos suaves, sin filtro de blur.
const MOTES = [
  { x: 150, y: 120, d: 150 },
  { x: 1790, y: 150, d: 110 },
  { x: 1830, y: 1000, d: 190 },
  { x: 60, y: 990, d: 130 },
  { x: 700, y: 1060, d: 90 },
].map((m, i) => ({ ...m, a: 0.055 + 0.035 * hash1(i * 17 + 3), seed: 40 + i * 9 }));

function drawMotes(ctx, t) {
  ctx.save();
  ctx.transform(...camMatrix(t, S_MOTE));
  for (const m of MOTES) {
    const x = m.x + 16 * noise1(t / 70, m.seed) - 0.3 * t;
    const y = m.y + 12 * noise1(t / 70, m.seed + 5);
    const r = m.d / 2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(251,146,60,${m.a})`);
    g.addColorStop(0.62, `rgba(251,146,60,${m.a * 0.85})`);
    g.addColorStop(0.82, `rgba(251,146,60,${m.a * 0.35})`);
    g.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── mundo z 0: línea, relleno, marcas, rótulos ─────────────────────────────

// Retracción (f56-62): la línea se recorta desde la izquierda, acelerando.
const retractX = (t) => (t < EVAP ? LX0 : lerp(LX0, LX1 + 12, EASE.accel(p(t, EVAP, 62))));

function strokeAlong(ctx, x0, x1, t, width, color) {
  if (x1 - x0 < 0.5) return;
  const live = t >= TC && t < 22;
  ctx.beginPath();
  if (!live) {
    ctx.moveTo(x0, LINE_Y);
    ctx.lineTo(x1, LINE_Y);
  } else {
    const n = Math.max(2, Math.ceil((x1 - x0) / 6));
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      const y = LINE_Y + deflect(x, t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function tickScaleY(x, t) {
  let s = 1;
  if (x === 1240) {
    // f14: la marca se flexiona 1 → 1,8 → 1 y lanza el punto.
    if (t >= RUN_H && t < RUN_H + 1.5) s = lerp(1, 1.8, EASE.brake((t - RUN_H) / 1.5));
    else if (t >= RUN_H + 1.5) s = lerp(1.8, 1, spr(t, RUN_H + 1.5, SPR.snap));
    // Latido en los anillos del punto (f28, f42).
    for (const H of [28, 42]) {
      if (t >= H && t < H + 12) s *= t < H + 1.5 ? lerp(1, 1.22, EASE.brake((t - H) / 1.5)) : lerp(1.22, 1, spr(t, H + 1.5, SPR.snap));
    }
  }
  // La retracción colapsa cada marca cuando el borde la pasa.
  const xs = retractX(t);
  s *= 1 - clamp((xs - x + 14) / 22);
  return s;
}

// Pulso que corre por el relleno de "Medio" y entra a la marca en cada beat de
// la lectura (f28, f42), junto con el anillo del punto: la línea le pasa el
// golpe al punto final. Gaussiana de 70 px de #fb923c, emisiva.
const SHEEN_BEATS = [28, 42];
function drawSheen(ctx, t) {
  for (const H of SHEEN_BEATS) {
    const t0 = H - 8;
    if (t < t0 || t > H + 1) continue;
    const x = lerp(LX0 - 60, 1240, EASE.lunge(clamp((t - t0) / 8)));
    const a = clamp((t - t0) / 2) * (1 - clamp((t - H) / 1));
    if (a <= 0.01) continue;
    const draw = (c, alpha) => {
      const g = c.createLinearGradient(x - 90, 0, x + 12, 0);
      g.addColorStop(0, "rgba(251,146,60,0)");
      g.addColorStop(0.8, `rgba(251,146,60,${alpha})`);
      g.addColorStop(1, "rgba(251,146,60,0)");
      c.fillStyle = g;
      c.fillRect(Math.max(LX0, x - 90), LINE_Y - 3, Math.min(1240, x + 12) - Math.max(LX0, x - 90), 6);
    };
    draw(ctx, 0.9 * a);
    emit(ctx, (e) => draw(e, a));
  }
}

function drawLine(ctx, t) {
  const xs = retractX(t);
  // Línea del período en tinta.
  strokeAlong(ctx, Math.max(LX0, xs), LX1, t, 4, C.ink);
  // "Inicial" ya hecho + "Medio" que se llena detrás del cabezal.
  strokeAlong(ctx, Math.max(LX0, xs), Math.max(Math.max(LX0, xs), fillEnd(t)), t, 6, C.accent);
  drawSheen(ctx, t);
  // Marcas.
  ctx.fillStyle = C.ink;
  for (const x of TICKS) {
    const sy = tickScaleY(x, t);
    if (sy <= 0.01) continue;
    const y = LINE_Y + deflect(x, t);
    const h = TICK_H * sy;
    // La marca de 1240 crece hacia arriba (base fija en la parte de abajo).
    const y0 = x === 1240 ? y + TICK_H / 2 - h : y - h / 2;
    ctx.fillRect(x - TICK_W / 2, y0, TICK_W, h);
  }
}

function drawLabels(ctx, t) {
  LABELS.forEach((lb, i) => {
    let weight = LABEL_STYLE.weight;
    if (i === 1 && t >= RUN_H)
      weight = kf(t, [
        [RUN_H, 600],
        [RUN_H + 1.5, 800, EASE.brake],
        [RUN_H + 4, 600, EASE.swell],
      ]);
    // Caída en la salida: +30 px y fade, de izquierda a derecha.
    let dy = 0;
    let alpha = 1;
    const s = EVAP + i * 1.2;
    if (t > s) {
      const u = clamp((t - s) / 5);
      dy = 30 * EASE.accel(u);
      alpha = 1 - EASE.swell(u);
      weight = lerp(weight, 300, u);
    }
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    drawText(ctx, lb.text, lb.x, LABEL_BASE + dy, { ...LABEL_STYLE, weight }, { align: "center", color: C.inkSoft });
    ctx.restore();
  });
}

// ─── el punto (en pantalla) ──────────────────────────────────────────────────

function drawTheDot(ctx, t) {
  if (t >= EVAP) return; // desde f56 lo dibuja B (C-P2-1)
  let [x, y] = dotScreen(t);
  const [jx, jy] = tremble(t);
  x += jx;
  y += jy;
  // En el mundo el punto sigue la escala de la cámara (zoom del arranque).
  const w = dotWorld(t).w;
  const camS = lerp(matScale(camMatrix(t)), 1, w);
  const d = dotDiameter(t) * camS;
  const def = dotDeform(t);
  drawFallTrail(ctx, t, x, y, d);
  drawDotShape(ctx, x, y, d, def, C.accent);
  // Brillo de punta (capa emisiva, peso bajo en Papel): mientras es cabezal y
  // en la carga de f53-56.
  const glow = t < LAND ? 1 : t < LAND + 4 ? 1 - (t - LAND) / 4 : t >= 53 ? 0.8 * EASE.swell(p(t, 53, 56)) : 0;
  if (glow > 0.01) emit(ctx, (e) => drawDotShape(e, x, y, d * 1.05, def, "#fb923c", glow));
}

// Estela de la caída (smear): en el contacto de f0 la estela del recorrido
// queda un instante arriba del punto y se recoge en ~1 f. El obturador de cola
// la promedia con la caída real, así el primer frame ya es un impacto con su
// velocidad escrita arriba.
const TRAIL_L = 190;
function drawFallTrail(ctx, t, x, y, d) {
  if (t < TC - 1 || t > TC + 1.2) return;
  const L = t < TC ? TRAIL_L : TRAIL_L * (1 - EASE.brake(clamp((t - TC) / 1.2)));
  if (L < 1) return;
  const top = y - L;
  const g = ctx.createLinearGradient(0, y, 0, top);
  g.addColorStop(0, "rgba(194,65,12,0.72)");
  g.addColorStop(0.4, "rgba(194,65,12,0.3)");
  g.addColorStop(1, "rgba(194,65,12,0)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  const w0 = d * 0.5;
  const w1 = d * 0.34;
  ctx.moveTo(x - w0, y);
  ctx.lineTo(x - w1, top);
  ctx.lineTo(x + w1, top);
  ctx.lineTo(x + w0, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── escena ──────────────────────────────────────────────────────────────────

function draw(ctx, t) {
  // L0: campo de papel.
  ctx.fillStyle = C.surface;
  ctx.fillRect(-4000, -4000, 12000, 12000);

  drawGhost(ctx, t);
  drawGrid(ctx, t);

  // Mundo z 0.
  ctx.save();
  ctx.transform(...camMatrix(t, 1));
  drawLine(ctx, t);
  drawLabels(ctx, t);
  // El impacto de f0 suelta un anillo desde el contacto.
  ring(ctx, t, TC, LAND_X, LINE_Y, DOT_D, C.accent);
  ctx.restore();

  // Anillos del punto final en los beats de la lectura (pantalla).
  for (const H of [28, 42]) ring(ctx, t, H, PERIOD.x, PERIOD.y, PERIOD_D, C.accent);
  drawTheDot(ctx, t);

  drawMotes(ctx, t);
}

// La frase, fija a la pantalla, arriba de todo (se evapora sobre el crema de B).
function drawTop(ctx, t) {
  if (t < RUN_H - 7.2 || t >= 62) return;
  drawPhrase(ctx, phrase, t, PROGRAM);
}

// Motion blur (2.5): 270° en la caída, la corrida, el arco, las entradas y la
// salida; 180° en la lectura.
function motion(t) {
  // Más sub-frames donde el punto va a más de 150 px/f (caída, llegada a la
  // marca, lanzamiento del arco), para que la estela sea continua.
  if (t < 3) return { shutter: 0.75, samples: 16 };
  if (t >= 13 && t < 18) return { shutter: 0.75, samples: 16 };
  if (t < 24) return { shutter: 0.75, samples: 12 };
  if (t < EVAP) return { shutter: 0.5, samples: 8 };
  return { shutter: 0.75, samples: 12 };
}

export const handoff = { frame: EVAP, dot: { x: PERIOD.x, y: PERIOD.y, d: HANDOFF_D, color: C.accent } };

// Expuesto para la verificación (lectura, contratos).
export const _debug = { phrase, PROGRAM, dotScreen, dotDiameter, camMatrix, tremble };

export default {
  id: "a",
  start: 0,
  end: 62,
  topEnd: 62,
  draw,
  drawTop,
  motion,
  field: () => ({ papel: 1 }),
  phrases: [{ id: "cierra-el-periodo", words: 3, R: 22, L: 56 }],
  hits: [
    { f: 0, level: "H1", kind: "impact" },
    { f: 14, level: "H2", kind: "tick" },
    { f: 16.5, level: "H3", kind: "el" },
    { f: 19, level: "H3", kind: "periodo" },
    { f: 28, level: "H2", kind: "ring" },
    { f: 42, level: "H2", kind: "ring" },
  ],
  handoff,
};
