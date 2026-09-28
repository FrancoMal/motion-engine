// S6: el teléfono genérico (tratamiento final 2.10 y 3.7). Sin marca, sin
// reloj, sin badge de tienda. Cada capa (cuerpo, pantalla de inicio, ícono,
// etiqueta) se dibuja plana en una textura (coordenadas locales del teléfono,
// 440 x 920) y se proyecta UNA vez con el warp de cuadrilátero del motor
// (engine/camera.js card3d): rotateY -14°, rotateX 4°, perspectiva 1400 px
// centrada en el teléfono. La formación (iris de la pantalla, trazo del bisel,
// relleno del cuerpo) se hace en pantalla con la misma proyección, sin volver a
// deformar texturas en cada sub-frame. El canto izquierdo y el de arriba (los
// que la rotación acerca a cámara) se ven como un sólido: la envolvente convexa
// de la cara de adelante y la de atrás.

import { createCanvas } from "@napi-rs/canvas";
import { IS_V } from "../../engine/format.js";
import { camera, card3d, project } from "../../engine/camera.js";
import { clamp, lerp, deg, rgba } from "../../engine/math.js";
import { drawText } from "../../engine/text.js";
import { rr, icon } from "../../shared/ui.js";
import { appTile, cardBg, drawBaseContent, BASE } from "./s6-notif.js";

// ─── geometría ───────────────────────────────────────────────────────────────
// En vertical el teléfono va DEBAJO del aviso, centrado con él (en horizontal
// va a la derecha); todo lo del teléfono (cámara, grilla, ranura) cuelga de PH.
export const PH = { cx: IS_V ? 1010 : 1470, cy: IS_V ? 1100 : 560, w: 440, h: 920, r: 64, rx: deg(4), ry: deg(-14), thick: 40 };
export const SCR = { x: 12, y: 12, w: 416, h: 896, r: 52 };
// Grilla de inicio: centros de mundo x 1314/1418/1522/1626, y 300..780 (3.7),
// en locales x 64/168/272/376, y 200/320/440/560/680. El ícono de Trazo Inicial
// va en la fila 2, columna 4 (mundo (1626, 420)): en (1418, 420) lo tapaba el
// hero durante toda la lectura y el badge de f336 no se veía; en la fila 1
// chocaba con "idea." de S5 durante T13'.
export const COLS = [64, 168, 272, 376];
export const ROWS = [200, 320, 440, 560, 680];
export const APP = { x: 376, y: 320, s: 84, r: 22 };
export const DOCK_Y = 800;
// Ranura del aviso: arriba de todo, debajo de la barra de estado.
export const SLOT = { x: 20, y: 44, w: BASE.w, h: BASE.h, r: BASE.r };
// Punto del badge: esquina de arriba a la derecha del ícono.
export const BADGE = { x: APP.x + 37, y: APP.y - 37, d: 16 };

export const TS = 1.5; // supersampleo de la textura
// Cámara con el punto principal en el centro del teléfono: todo lo que se
// proyecta con ella va adentro de ctx.translate(CAM.x, CAM.y).
export const CAM = camera({ F: 1400, x: PH.cx - 960, y: PH.cy - 540 });

// Misma rotación que card3d (Z, luego X, luego Y).
function rot3(x, y, z, rx, ry) {
  let c = Math.cos(rx);
  let s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}

// Punto local del teléfono (lx, ly en la textura, lz hacia atrás) → mundo 3D.
export function toWorld(lx, ly, lz = 0, cx = PH.cx, cy = PH.cy) {
  const [x, y, z] = rot3(lx - PH.w / 2, ly - PH.h / 2, lz, PH.rx, PH.ry);
  return [cx + x, cy + y, z];
}

// Mundo 3D → pantalla (con la traslación de CAM ya sumada).
export function toScreen(p) {
  const q = project(CAM, p[0], p[1], p[2]);
  return [q.x + CAM.x, q.y + CAM.y, q.s];
}

export const projectLocal = (lx, ly, lz = 0, cx = PH.cx) => toScreen(toWorld(lx, ly, lz, cx));

// ─── pantalla de inicio (estática, cacheada) ─────────────────────────────────
const GLYPHS = ["message-circle", "calendar", "music", "search", "palette", "clock", "folder", "sun", "settings", "send", "book", "layout-grid", "bell", "file-text", "users", "archive", "target", "box", "list-checks"];
const DOCK = ["message-circle", "search", "folder", "settings"];

let screenCache = null;
function screenTex() {
  if (screenCache) return screenCache;
  const cv = createCanvas(Math.ceil(PH.w * TS), Math.ceil(PH.h * TS));
  const c = cv.getContext("2d");
  c.scale(TS, TS);
  c.save();
  rr(c, SCR.x, SCR.y, SCR.w, SCR.h, SCR.r);
  c.clip();
  // Fondo de pantalla: degradé cálido y un halo #7c2d12 al 30 % detrás del
  // ícono (3.7: centro de mundo (1400, 300), r 400).
  const g = c.createLinearGradient(0, SCR.y, 0, SCR.y + SCR.h);
  g.addColorStop(0, "#2a1d16");
  g.addColorStop(1, "#120e0c");
  c.fillStyle = g;
  c.fillRect(0, 0, PH.w, PH.h);
  const hx = 1400 - (PH.cx - PH.w / 2);
  const hy = 300 - (PH.cy - PH.h / 2);
  const rg = c.createRadialGradient(hx, hy, 0, hx, hy, 400);
  rg.addColorStop(0, rgba("#7c2d12", 0.3));
  rg.addColorStop(0.55, rgba("#7c2d12", 0.12));
  rg.addColorStop(1, rgba("#7c2d12", 0));
  c.fillStyle = rg;
  c.fillRect(0, 0, PH.w, PH.h);
  const rg2 = c.createRadialGradient(380, 780, 0, 380, 780, 320);
  rg2.addColorStop(0, rgba("#fb923c", 0.07));
  rg2.addColorStop(1, rgba("#fb923c", 0));
  c.fillStyle = rg2;
  c.fillRect(0, 0, PH.w, PH.h);

  // Barra de estado genérica: señal, wifi, batería. Sin hora.
  const sc = "rgba(245,241,234,0.78)";
  icon(c, "signal", 346, 32, 17, { color: sc, width: 2.2 });
  icon(c, "wifi", 369, 32, 17, { color: sc, width: 2.2 });
  icon(c, "battery", 395, 32, 20, { color: sc, width: 2.2 });

  // Grilla de apps genéricas (sin nombres) y el lugar vacío del ícono real.
  let k = 0;
  ROWS.forEach((y, j) => {
    COLS.forEach((x, i) => {
      if (x === APP.x && y === APP.y) return;
      tile(c, x, y, GLYPHS[k++ % GLYPHS.length], j * 4 + i);
    });
  });
  // Dock.
  rr(c, 24, DOCK_Y - 54, PH.w - 48, 108, 34);
  c.fillStyle = "rgba(245,241,234,0.06)";
  c.fill();
  COLS.forEach((x, i) => tile(c, x, DOCK_Y, DOCK[i], 40 + i));
  // Barra de gestos.
  rr(c, PH.w / 2 - 64, 890, 128, 6, 3);
  c.fillStyle = "rgba(245,241,234,0.42)";
  c.fill();
  // Reflejo del vidrio, muy tenue.
  const gl = c.createLinearGradient(0, 0, PH.w, PH.h * 0.6);
  gl.addColorStop(0, "rgba(255,244,230,0.07)");
  gl.addColorStop(0.35, "rgba(255,244,230,0.0)");
  c.fillStyle = gl;
  c.fillRect(0, 0, PH.w, PH.h);
  c.restore();
  screenCache = cv;
  return cv;
}

function tile(c, x, y, glyph, seed) {
  const s = 84;
  rr(c, x - s / 2, y - s / 2, s, s, 22);
  c.fillStyle = ["#3a322c", "#3b332d", "#382f2a"][seed % 3];
  c.fill();
  // Filo de luz arriba, como un ícono con volumen.
  c.save();
  rr(c, x - s / 2, y - s / 2, s, s, 22);
  c.clip();
  const g = c.createLinearGradient(0, y - s / 2, 0, y - s / 2 + 18);
  g.addColorStop(0, "rgba(255,240,225,0.07)");
  g.addColorStop(1, "rgba(255,240,225,0)");
  c.fillStyle = g;
  c.fillRect(x - s / 2, y - s / 2, s, 18);
  c.restore();
  icon(c, glyph, x, y, 32, { color: "rgba(245,241,234,0.15)", width: 2 });
}

// ─── capas planas (texturas locales) ─────────────────────────────────────────
function flatTex(draw) {
  const cv = createCanvas(Math.ceil(PH.w * TS), Math.ceil(PH.h * TS));
  const c = cv.getContext("2d");
  c.scale(TS, TS);
  draw(c);
  return cv;
}

// Cuerpo: relleno, cámara perforada y filo de 2 px con brillo especular.
function bodyTex() {
  return flatTex((c) => {
    rr(c, 0, 0, PH.w, PH.h, PH.r);
    c.fillStyle = "#26201c";
    c.fill();
    c.beginPath();
    c.arc(PH.w / 2, 32, 7, 0, Math.PI * 2);
    c.fillStyle = "#0c0a09";
    c.fill();
    c.beginPath();
    c.arc(PH.w / 2 - 2, 30, 2, 0, Math.PI * 2);
    c.fillStyle = "rgba(120,140,170,0.35)";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = "#3a322c";
    rr(c, 1, 1, PH.w - 2, PH.h - 2, PH.r - 1);
    c.stroke();
    const sp = c.createLinearGradient(0, 0, PH.w, PH.h);
    sp.addColorStop(0, "rgba(255,236,214,0.34)");
    sp.addColorStop(0.22, "rgba(255,236,214,0)");
    sp.addColorStop(0.8, "rgba(255,236,214,0)");
    sp.addColorStop(1, "rgba(255,236,214,0.1)");
    c.lineWidth = 1.5;
    c.strokeStyle = sp;
    rr(c, 1.2, 1.2, PH.w - 2.4, PH.h - 2.4, PH.r - 1.2);
    c.stroke();
  });
}
const appTex = () => flatTex((c) => appTile(c, APP.x, APP.y, APP.s, { r: APP.r, shadow: 0.4, border: false }));
const labelTex = () =>
  flatTex((c) => drawText(c, "Trazo Inicial", APP.x, APP.y + 62, { size: 18, weight: 600 }, { align: "center", color: "#f5f1ea" }));

// ─── sólido: sombra y canto ──────────────────────────────────────────────────
function roundedOutline(x, y, w, h, r, n = 6) {
  const pts = [];
  const corners = [
    [x + w - r, y + r, -90],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, 90],
    [x + r, y + r, 180],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = deg(a0 + (90 * i) / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}
const OUTLINE = roundedOutline(0, 0, PH.w, PH.h, PH.r);

function hull(points) {
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of P) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Envolvente proyectada (pantalla) de la cara de adelante y la de atrás.
export function solidHull(cx = PH.cx) {
  const pts = [];
  for (const [lx, ly] of OUTLINE) {
    pts.push(projectLocal(lx, ly, 0, cx));
    pts.push(projectLocal(lx, ly, PH.thick, cx));
  }
  return hull(pts.map((p) => [p[0], p[1]]));
}

export function pathOf(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Sombra proyectada al fondo y el canto (en coordenadas de pantalla).
function drawSolid(ctx, cx) {
  const H = solidHull(cx);
  ctx.save();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetX = 26;
  ctx.shadowOffsetY = 44;
  pathOf(ctx, H);
  ctx.fillStyle = "#15110f";
  ctx.fill();
  ctx.restore();
  pathOf(ctx, H);
  const g = ctx.createLinearGradient(cx - 260, 0, cx - 180, 0);
  g.addColorStop(0, "#1d1815");
  g.addColorStop(1, "#110e0c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255,236,214,0.08)";
  ctx.stroke();
  ctx.restore();
}

// ─── capas proyectadas (bitmaps de pantalla, una sola vez) ───────────────────
let BOX = null;
function box() {
  if (BOX) return BOX;
  const H = solidHull();
  const pad = 150;
  const x0 = Math.floor(Math.min(...H.map((p) => p[0])) - pad);
  const y0 = Math.floor(Math.min(...H.map((p) => p[1])) - pad);
  const x1 = Math.ceil(Math.max(...H.map((p) => p[0])) + pad);
  const y1 = Math.ceil(Math.max(...H.map((p) => p[1])) + pad);
  BOX = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return BOX;
}

function warp(tex, { solid = false } = {}) {
  const B = box();
  const cv = createCanvas(B.w, B.h);
  const c = cv.getContext("2d");
  c.translate(-B.x, -B.y);
  if (solid) drawSolid(c, PH.cx);
  c.save();
  c.translate(CAM.x, CAM.y);
  c.imageSmoothingQuality = "high";
  card3d(c, CAM, tex, { x: PH.cx, y: PH.cy, z: 0, w: PH.w, h: PH.h, rx: PH.rx, ry: PH.ry, n: 16, shade: 0 });
  c.restore();
  return cv;
}

const layers = {};
export function phoneLayer(kind) {
  if (layers[kind]) return layers[kind];
  if (kind === "body") layers.body = warp(bodyTex(), { solid: true });
  else if (kind === "screen") layers.screen = warp(screenTex());
  else if (kind === "app") layers.app = warp(appTex());
  else if (kind === "label") layers.label = warp(labelTex());
  else if (kind === "full") {
    const B = box();
    const cv = createCanvas(B.w, B.h);
    const c = cv.getContext("2d");
    for (const k of ["body", "screen", "app", "label"]) c.drawImage(phoneLayer(k), 0, 0);
    layers.full = cv;
  }
  return layers[kind];
}

// Teléfono completo desenfocado: niveles cacheados (0, 2, 4, 6, 9, 14 px) y
// mezcla entre los dos vecinos, así el rack de foco no paga un blur por
// sub-frame.
const LEVELS = [0, 2, 4, 6, 9, 14];
const blurCache = new Map();
function blurLevel(i) {
  const b = LEVELS[i];
  if (b === 0) return phoneLayer("full");
  let cv = blurCache.get(b);
  if (cv) return cv;
  const src = phoneLayer("full");
  cv = createCanvas(src.width, src.height);
  const c = cv.getContext("2d");
  c.filter = `blur(${b}px)`;
  c.drawImage(src, 0, 0);
  blurCache.set(b, cv);
  return cv;
}

export function drawPhoneAtRest(ctx, { blur = 0, alpha = 1, dx = 0 } = {}) {
  const B = box();
  const b = clamp(blur, 0, LEVELS[LEVELS.length - 1]);
  let i = 0;
  while (i < LEVELS.length - 2 && b > LEVELS[i + 1]) i++;
  const f = clamp((b - LEVELS[i]) / (LEVELS[i + 1] - LEVELS[i]));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(blurLevel(i), B.x + dx, B.y);
  if (f > 0.01) {
    ctx.globalAlpha *= f;
    ctx.drawImage(blurLevel(i + 1), B.x + dx, B.y);
  }
  ctx.restore();
}

// ─── formación en pantalla ───────────────────────────────────────────────────
// Contorno del bisel en coordenadas locales, desde el centro de arriba hacia
// un lado (sign 1 derecha, -1 izquierda), con largo acumulado para el trim.
function halfRim(sign, n = 10) {
  const i = 2;
  const w = PH.w - 2 * i;
  const h = PH.h - 2 * i;
  const r = PH.r - i;
  const cx = PH.w / 2;
  const X = (x) => (sign > 0 ? x : PH.w - x);
  const pts = [[cx, i]];
  const arc = (ax, ay, a0, a1) => {
    for (let k = 1; k <= n; k++) {
      const a = deg(a0 + ((a1 - a0) * k) / n);
      pts.push([X(ax + r * Math.cos(a)), ay + r * Math.sin(a)]);
    }
  };
  pts.push([X(i + w - r), i]);
  arc(i + w - r, i + r, -90, 0);
  pts.push([X(i + w), i + h - r]);
  arc(i + w - r, i + h - r, 0, 90);
  pts.push([cx, i + h]);
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
const RIMS = [halfRim(1), halfRim(-1)];

function traceRim(ctx, k, dx) {
  ctx.beginPath();
  for (const R of RIMS) {
    const s = k * R.len;
    let p = projectLocal(R.pts[0][0], R.pts[0][1]);
    ctx.moveTo(p[0] + dx, p[1]);
    let j = 1;
    while (j < R.pts.length && R.cum[j] <= s) {
      p = projectLocal(R.pts[j][0], R.pts[j][1]);
      ctx.lineTo(p[0] + dx, p[1]);
      j++;
    }
    if (j < R.pts.length) {
      const u = (s - R.cum[j - 1]) / (R.cum[j] - R.cum[j - 1] || 1);
      const a = R.pts[j - 1];
      const b = R.pts[j];
      p = projectLocal(lerp(a[0], b[0], u), lerp(a[1], b[1], u));
      ctx.lineTo(p[0] + dx, p[1]);
    }
  }
}

// Polígono proyectado de la pantalla (para recortar el aviso que cae).
const SCREEN_POLY = roundedOutline(SCR.x, SCR.y, SCR.w, SCR.h, SCR.r, 8).map(([x, y]) => projectLocal(x, y));

// Aviso base plano (con su sombrita), para proyectarlo en el plano del teléfono.
const NPAD = 24;
let notifTexCache = null;
function notifTex() {
  if (notifTexCache) return notifTexCache;
  const S = 2;
  const cv = createCanvas((SLOT.w + NPAD * 2) * S, (SLOT.h + NPAD * 2) * S);
  const c = cv.getContext("2d");
  c.scale(S, S);
  c.translate(NPAD, NPAD);
  c.save();
  c.shadowColor = "rgba(0,0,0,0.35)";
  c.shadowBlur = 16 * S;
  c.shadowOffsetY = 5 * S;
  rr(c, 0, 0, SLOT.w, SLOT.h, SLOT.r);
  c.fillStyle = "rgba(250,246,239,0.97)";
  c.fill();
  c.restore();
  cardBg(c, SLOT.w, SLOT.h, SLOT.r);
  drawBaseContent(c);
  notifTexCache = cv;
  return cv;
}

// st: { reveal (radio en el plano del teléfono), bezel 0..1, body 0..1,
//       app 0..1, label 0..1, notif {dy, sx, sy} | null }; dx = vibración.
export function drawPhoneForming(ctx, t, st, dx = 0) {
  const B = box();
  const { reveal = 0, bezel = 0, body = 0, app = 0, label = 0, notif = null } = st;
  if (body > 0.002) {
    ctx.save();
    ctx.globalAlpha *= body;
    ctx.drawImage(phoneLayer("body"), B.x + dx, B.y);
    ctx.restore();
  }
  if (reveal >= 1000) ctx.drawImage(phoneLayer("screen"), B.x + dx, B.y);
  else if (reveal > 0) {
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const p = projectLocal(APP.x + reveal * Math.cos(a), APP.y + reveal * Math.sin(a));
      if (k) ctx.lineTo(p[0] + dx, p[1]);
      else ctx.moveTo(p[0] + dx, p[1]);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(phoneLayer("screen"), B.x + dx, B.y);
    ctx.restore();
  }
  if (app > 0.002) {
    ctx.save();
    ctx.globalAlpha *= app;
    ctx.drawImage(phoneLayer("app"), B.x + dx, B.y);
    ctx.restore();
  }
  if (label > 0.002) {
    ctx.save();
    ctx.globalAlpha *= label;
    ctx.drawImage(phoneLayer("label"), B.x + dx, B.y);
    ctx.restore();
  }
  if (notif) {
    // K4 en el plano del teléfono: origen en el borde de abajo de la ranura.
    const w = SLOT.w * notif.sx;
    const h = SLOT.h * notif.sy;
    const lx = SLOT.x + SLOT.w / 2;
    const ly = SLOT.y + SLOT.h + notif.dy - h / 2;
    const [x, y, z] = toWorld(lx, ly, 0, PH.cx + dx);
    ctx.save();
    ctx.beginPath();
    SCREEN_POLY.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py) : ctx.moveTo(px + dx, py)));
    ctx.closePath();
    ctx.clip();
    ctx.translate(CAM.x, CAM.y);
    card3d(ctx, CAM, notifTex(), { x, y, z, w: w + NPAD * 2 * notif.sx, h: h + NPAD * 2 * notif.sy, rx: PH.rx, ry: PH.ry, n: 3, shade: 0 });
    ctx.restore();
  }
  // Trazo del bisel: #3a322c, 4 px, trim desde arriba hacia los dos lados; se
  // funde en el filo definitivo cuando el cuerpo se llena.
  if (bezel > 0 && body < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - body;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3a322c";
    traceRim(ctx, bezel, dx);
    ctx.stroke();
    ctx.restore();
  }
}
