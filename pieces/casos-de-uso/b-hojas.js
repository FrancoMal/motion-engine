// Hojas de la sala (P2, escena B, T18'): la planilla mini del grid, la hoja de
// la pila y el morph continuo entre las dos.
//
// La DUEÑA de la pila es la escena C (contrato C-P2-5). En tiempo de ejecución
// este módulo lee de c-pila.js camAt, pileSlot, markSeed y LANDING (el estado
// en que C espera la hoja en t_j: estirada, papel, radio, luz de la lámpara) y
// de c-hoja.js marksFor y drawFaceContent. Si alguno no carga, usa las
// réplicas de abajo, escritas con los mismos valores. Lo que es de B: la
// planilla mini, el morph de planilla a hoja de la pila y el vuelo.
//
// Espacio de hoja de este módulo: origen en el centro del borde inferior, la
// cara ocupa (-w/2, -h) a (w/2, 0). Nada acá guarda estado entre llamadas.

import { createCanvas } from "@napi-rs/canvas";
import { project } from "../../engine/camera.js";
import { setType } from "../../engine/text.js";
import { clamp, lerp, mix, hash2, deg, smoothstep, fbm1 } from "../../engine/math.js";
import { EASE } from "../../shared/system.js";
import { C } from "../../shared/brand.js";

// Enlace con C, sin bloquear la carga (un await acá podría colgar el grafo de
// módulos si algún día C importara esta escena).
export const CLINK = { cp: null, ch: null };
import("./c-pila.js")
  .then((m) => {
    if (m && typeof m.camAt === "function" && typeof m.pileSlot === "function") CLINK.cp = m;
  })
  .catch(() => {});
import("./c-hoja.js")
  .then((m) => {
    if (m && typeof m.drawFaceContent === "function" && typeof m.marksFor === "function") CLINK.ch = m;
  })
  .catch(() => {});

// ─── la sala ─────────────────────────────────────────────────────────────────

// Orden de grilla (fila por fila). Ninguna tiene I mayúscula ni pares I/l.
export const INITIALS = ["AE", "NE", "SE", "DE", "EE", "JE", "CE", "TE", "PE", "LE", "RE", "FE", "GE", "BE", "ME", "VE", "OE", "HE", "ZE", "AP", "NP", "SP", "DP", "TP"];
export const GRID = { cols: 8, rows: 3, x0: 435, pitch: 150, ys: [590, 740, 890], d: 110 };
export const gridCol = (i) => i % GRID.cols;
export const gridRow = (i) => Math.floor(i / GRID.cols);
export const gridPos = (i) => [GRID.x0 + GRID.pitch * gridCol(i), GRID.ys[gridRow(i)]];

// ─── la pila ─────────────────────────────────────────────────────────────────

export const MINI = { w: 96, h: 124, r: 8 };
export const SHEET = { w: 460, h: 540 };
export const PILE_SY = 0.85;
export const PILE_SHIFT = 48;
// skewX en espacio de hoja (y negativa hacia arriba): x += SKEW * y.
export const PILE_SKEW = -PILE_SHIFT / SHEET.h;

// Rango: orden por distancia al pie de la pila (1440, 930), la más cercana
// primero. La más lejana es AE (435, 590): aterriza última, arriba (j = 23).
const distToPile = (i) => {
  const [x, y] = gridPos(i);
  return Math.hypot(x - 1440, y - 930);
};
export const ORDER = [...Array(24).keys()].sort((a, b) => distToPile(a) - distToPile(b) || a - b); // ORDER[j] = índice de grilla
export const RANK = (() => {
  const r = new Array(24);
  ORDER.forEach((i, j) => (r[i] = j));
  return r;
})();
export const landT = (j) => 118 + 0.5 * j;

// Réplicas de c-pila.js (respaldo).
const LANDING_REPLICA = {
  stretch: [0.975, 1.05],
  squash: [1.06, 0.92],
  paper: "#fffdf9",
  radius: 0,
  light: { cx: 1540, cy: 280, r: 1020, stops: [[0, "#ffffff"], [0.3, "#fcf8f2"], [0.55, "#ebe1d4"], [0.78, "#c9baa7"], [1, "#9c8b77"]] },
};
function pileSlotReplica(j) {
  const top = j === 23;
  return { cx: 1440 + (top ? 0 : (hash2(j, 11) * 2 - 1) * 10), bottom: 930 - 8 * j, rot: top ? 0 : deg((hash2(j, 12) * 2 - 1) * 1.5) };
}
function camAtReplica(t) {
  const F = 1400;
  const s = t <= 112 ? 1 : t <= 160 ? lerp(1, 1.06, EASE.swell((t - 112) / 48)) : lerp(1.06, 1.068, clamp((t - 160) / 32));
  const z = F * (1 - 1 / s);
  let x = (1440 - 960) * (1 - 1 / s);
  let y = (560 - 540) * (1 - 1 / s);
  const s0 = F / (F - z);
  x += (1.5 * fbm1(t / 75, 51)) / s0;
  y += (1.5 * fbm1(t / 75 + 3.7, 52)) / s0;
  return { x, y, z, F, zoom: 1, roll: deg(0.15) * fbm1(t / 75 + 9.1, 53) };
}
function marksForReplica(seed) {
  const out = [];
  for (let r = 0; r < 4; r++) {
    const a = 1 + Math.floor(hash2(seed * 7 + r, 91) * 9);
    let b = 1 + Math.floor(hash2(seed * 7 + r, 92) * 9);
    if (Math.abs(b - a) < 2) b = a + 3 > 10 ? a - 3 : a + 3;
    out.push(a < b ? [a, b] : [b, a]);
  }
  return out;
}
const markSeedReplica = (j) => (j === 23 ? 5 : 40 + j);

// Lo que manda C (o su réplica).
export const landing = () => CLINK.cp?.LANDING ?? LANDING_REPLICA;
export const pileCam = (t) => (CLINK.cp ? CLINK.cp.camAt(t) : camAtReplica(t));
export const pileSlotOf = (j) => (CLINK.cp ? CLINK.cp.pileSlot(j) : pileSlotReplica(j)); // { cx, bottom, rot }
export const pileMarks = (j) => {
  const seed = (CLINK.cp?.markSeed ?? markSeedReplica)(j);
  return CLINK.ch ? CLINK.ch.marksFor(seed) : marksForReplica(seed);
};

// ─── marcas de la docente ────────────────────────────────────────────────────
// La hoja de la pila tiene 2 marcas por renglón (las de C). En la planilla
// mini cada par de puntos de la pila es un solo punto (el padre): la marca de
// la planilla es el padre de cada marca de la pila; al crecer la hoja el punto
// se divide en dos y la marca se queda en la hija que corresponde.
function sheetMarks(i) {
  return pileMarks(RANK[i]).map((pile) => ({ pile, mini: [...new Set(pile.map((d) => d >> 1))] }));
}

// ─── geometría de la cara ────────────────────────────────────────────────────

const ROWS_MINI = [46, 64, 82, 100];
const ROWS_PILE = [190, 260, 330, 400];
const PX0 = 37; // centro del primer punto de la pila (c-hoja: 32 + 10/2)
const PPITCH = (379 - 37) / 11;
const GRAY = C.borderStrong; // #d6cdba

// Pose → matriz afín [a b c d e f]: T(x, y) R(rot) S(sx, sy) K(skew, psy).
export function poseMatrix(p) {
  const cr = Math.cos(p.rot || 0);
  const sr = Math.sin(p.rot || 0);
  const a = cr * p.sx;
  const b = sr * p.sx;
  const c = -sr * p.sy;
  const d = cr * p.sy;
  const k = p.skew || 0;
  const q = p.psy ?? 1;
  return [a, b, a * k + c * q, b * k + d * q, p.x, p.y];
}
const ap = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

// Contorno (rect redondeado como polilínea) en coordenadas del mundo: la luz y
// las sombras se pintan en el espacio de la escena, no en el de la hoja.
function outline(M, w, h, r) {
  const x0 = -w / 2;
  const y0 = -h;
  if (r < 0.4) return [ap(M, x0, y0), ap(M, x0 + w, y0), ap(M, x0 + w, 0), ap(M, x0, 0)];
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= 5; k++) {
      const a = a0 + (k / 5) * (Math.PI / 2);
      pts.push(ap(M, cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  corner(x0 + r, y0 + r, Math.PI);
  corner(x0 + w - r, y0 + r, -Math.PI / 2);
  corner(x0 + w - r, -r, 0);
  corner(x0 + r, -r, Math.PI / 2);
  return pts;
}
function polyPath(ctx, P, dx = 0, dy = 0) {
  ctx.beginPath();
  ctx.moveTo(P[0][0] + dx, P[0][1] + dy);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0] + dx, P[i][1] + dy);
  ctx.closePath();
}

// Sombra suave precalculada (una por worker): se estira al tamaño de la cara.
const SHADOW = (() => {
  const c = createCanvas(200, 240);
  const x = c.getContext("2d");
  x.filter = "blur(16px)";
  x.fillStyle = "rgba(28,25,23,1)";
  x.beginPath();
  x.roundRect(40, 40, 120, 160, 10);
  x.fill();
  return c;
})();

function dot(ctx, x, y, d, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, d / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Contenido en px de cara (origen arriba a la izquierda, w x h). En k = 1 es la
// cara punteada de c-hoja.js (la dibuja c-hoja si cargó).
function drawContent(ctx, i, w, h, k, mark) {
  const kk = clamp(k);
  const marks = sheetMarks(i);
  if (kk >= 0.985 && CLINK.ch) {
    ctx.save();
    ctx.scale(w / SHEET.w, h / SHEET.h);
    CLINK.ch.drawFaceContent(ctx, 0, { initials: INITIALS[i], marks: marks.map((m) => m.pile) });
    ctx.restore();
    return;
  }
  const NX = (m, p) => w * lerp(m, p, kk);
  const NY = (m, p) => h * lerp(m, p, kk);
  const sT = smoothstep(0.3, 0.72, kk);

  // Encabezado: la barra de la planilla se vuelve "Informe / Período Medio".
  if (sT < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - sT;
    const bh = h * lerp(8 / MINI.h, 30 / SHEET.h, kk);
    ctx.beginPath();
    ctx.roundRect(NX(10 / MINI.w, 32 / SHEET.w), NY(14 / MINI.h, 44 / SHEET.h), w * lerp(40 / MINI.w, 170 / SHEET.w, kk), bh, bh / 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.restore();
  }
  if (sT > 0) {
    ctx.save();
    ctx.globalAlpha *= sT;
    ctx.scale(w / SHEET.w, h / SHEET.h);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    setType(ctx, { size: 44, weight: 800, tracking: -0.01 });
    ctx.fillStyle = C.ink;
    ctx.fillText("Informe", 32, 72);
    setType(ctx, { size: 26, weight: 600, tracking: 0 });
    ctx.fillStyle = C.inkMute;
    ctx.fillText("Período Medio", 32, 110);
    ctx.fillStyle = C.border;
    ctx.fillRect(32, 144, 396, 1.5);
    ctx.restore();
  }

  // Avatar con las iniciales, arriba a la derecha.
  const ar = w * lerp(10 / MINI.w, 22 / SHEET.w, kk);
  const acx = NX(76 / MINI.w, 414 / SHEET.w);
  const acy = NY(18 / MINI.h, 56 / SHEET.h);
  dot(ctx, acx, acy, ar * 2, C.accentInk);
  if (ar > 3) {
    setType(ctx, { size: ar * 0.8, weight: 800, tracking: 0.01 });
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.surface;
    ctx.fillText(INITIALS[i], acx, acy + ar * (6.3 / 22));
    ctx.textAlign = "left";
  }

  // Renglones: 12 puntos que nacen de a pares desde los 6 de la planilla y se
  // separan a medida que la hoja crece.
  const dGray = w * lerp(6 / MINI.w, 10 / SHEET.w, kk);
  const dMark = w * lerp(6 / MINI.w, 12 / SHEET.w, kk);
  const split = smoothstep(0.15, 0.55, kk);
  for (let q = 0; q < 4; q++) {
    const y = NY(ROWS_MINI[q] / MINI.h, ROWS_PILE[q] / SHEET.h);
    const rm = marks[q];
    const st = mark ? mark(q) : { on: 1, scale: 1 };
    for (let d = 0; d < 12; d++) {
      if (split <= 0.001 && d & 1) continue; // superpuestas: se dibuja una
      const parent = d >> 1;
      const x = NX((15 + 13 * parent) / MINI.w, (PX0 + PPITCH * d) / SHEET.w);
      const marked = rm.mini.includes(parent);
      const keeper = rm.pile.includes(d);
      const acc = marked ? st.on * (keeper ? 1 : 1 - split) : 0;
      if (acc <= 0.001) dot(ctx, x, y, dGray, GRAY);
      else dot(ctx, x, y, lerp(dGray, dMark, acc) * (keeper || split < 0.5 ? st.scale : 1), acc >= 0.999 ? C.accent : mix(GRAY, C.accent, acc));
    }
  }
}

// Luz de la lámpara de C (LANDING.light: multiply radial en el mundo de C),
// proyectada a pantalla con la cámara de la pila, sobre el contorno de la hoja.
function pileLight(ctx, P, cam, L, light) {
  if (L <= 0.002 || !light) return;
  const s = project(cam, light.cx, light.cy, 0);
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, light.r * s.s);
  for (const [u, col] of light.stops) g.addColorStop(u, col);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha *= L;
  polyPath(ctx, P);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// Dibuja la hoja i con una pose.
//   pose  { x, y, rot, sx, sy, psy, skew, w, h, k }  (x, y = centro del borde
//         inferior en pantalla; w, h = cara en px; k 0 = planilla, 1 = pila)
//   o     { mark(q) → {on, scale}, shade (noche 0..1), flipShade, shadow (suave
//           0..1), lift (altura del vuelo 0..1), light (0..1 hacia el estado de
//           entrega de C), cam (cámara de C), under (hay una hoja debajo) }
export function drawSheetAt(ctx, i, pose, o = {}) {
  const { w, h } = pose;
  if (w <= 0.5 || h <= 0.5) return;
  const k = clamp(pose.k ?? 0);
  const L = clamp(o.light ?? 0);
  const LD = landing();
  const M = poseMatrix(pose);
  // Esquinas: 8 px de la planilla → el radio de entrega de C.
  const rad = w * lerp(MINI.r / MINI.w, (LD.radius ?? 0) / SHEET.w, smoothstep(0.45, 1, k));
  const P = outline(M, w, h, rad);
  const sc = w / lerp(MINI.w, SHEET.w, k) || 1; // escala de cámara aproximada

  ctx.save();
  // Sombra suave (grid y salida del vuelo): se corre, se abre y se pierde.
  const soft = (o.shadow ?? 1) * (1 - smoothstep(0.04, 0.3, k));
  if (soft > 0.002) {
    const lift = o.lift ?? 0;
    const m = w * 0.34 * (1 + 0.6 * lift);
    ctx.save();
    ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    ctx.globalAlpha *= soft * lerp(0.16, 0.09, lift);
    ctx.drawImage(SHADOW, -w / 2 - m, -h - m + h * lerp(0.05, 0.16, lift), w + 2 * m, h + 2 * m);
    ctx.restore();
  }
  // Sombras cortas sobre la hoja de abajo (las de c-pila), al llegar.
  if (o.under && L > 0.002) {
    ctx.save();
    ctx.globalAlpha *= L;
    polyPath(ctx, P, -1.2 * sc, 2.2 * sc);
    ctx.fillStyle = "rgba(33,22,14,0.34)";
    ctx.fill();
    polyPath(ctx, P, -2.5 * sc, 5.5 * sc);
    ctx.fillStyle = "rgba(33,22,14,0.12)";
    ctx.fill();
    ctx.restore();
  }

  // Papel y borde.
  polyPath(ctx, P);
  ctx.fillStyle = L > 0.001 ? mix("#ffffff", LD.paper ?? "#ffffff", L) : "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.5 * sc;
  ctx.strokeStyle = C.border;
  ctx.stroke();

  // Contenido en espacio de cara.
  ctx.save();
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  ctx.translate(-w / 2, -h);
  drawContent(ctx, i, w, h, k, o.mark);
  ctx.restore();

  // Luz de la lámpara (llegando a la pila), noche del anochecer, canto del giro.
  if (o.cam) pileLight(ctx, P, o.cam, L, LD.light);
  const dk = clamp((o.shade ?? 0) + (o.flipShade ?? 0));
  if (dk > 0.002) {
    // Se tapa también el borde (el trazo sale medio píxel afuera del relleno):
    // si no, en la noche queda una grilla de contornos claros.
    polyPath(ctx, P);
    ctx.fillStyle = `rgba(28,25,23,${dk.toFixed(4)})`;
    ctx.fill();
    ctx.lineWidth = 3 * sc;
    ctx.strokeStyle = `rgba(28,25,23,${dk.toFixed(4)})`;
    ctx.stroke();
  }
  ctx.restore();
}
