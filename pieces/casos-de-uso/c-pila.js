// Escenas C y D de "Casos de uso" (tratamiento final 4.4 y 4.5), f104 a f230.
//
// La sala se volvió una pila de 24 hojas de informe con las marcas de la
// docente. Es de noche y hay una lámpara. Toca "Generar informes (24)", un
// trazo de tinta sale del botón y entra en la pila, una onda sube por los
// cantos y en la hoja de arriba los renglones punteados se vuelven líneas
// que terminan con su punto (KD). La pila nunca se va: son borradores para
// revisar. Sin reloj, sin amanecer.
//
// Costuras (index.js):
//   f104-131  se dibuja ARRIBA de b-sala: nada de campo propio. La lámpara
//             desde f110 (C-P2-6), cada hoja desde su aterrizaje t_j (C-P2-5).
//   f131-214  sola: pinta el campo #1c1917.
//   f214-230  debajo de e-ajustas: la hoja 23 ya no se dibuja (C-P2-9), la
//             pila y la lámpara se alejan (z +700, blur 12).
// Las frases van en drawTop (c-frases.js) hasta f224.

import { IS_V } from "../../engine/format.js";
import { createCanvas } from "@napi-rs/canvas";
import { layer, project } from "../../engine/camera.js";
import { emit, env } from "../../engine/env.js";
import { setType, glyphs } from "../../engine/text.js";
import { clamp, lerp, hash2, fbm1, mix } from "../../engine/math.js";
import { EASE, SPR, spr, punch, p as prog } from "../../shared/system.js";
import { icon, rr } from "../../shared/ui.js";
import { SHEET_W, SHEET_H, CARD_R, ROW_Y, PERIOD_X, PAPER, CARD_PAPER, marksFor, facePoly, drawFaceContent, drawFaceEar, impulse, rowArrive } from "./c-hoja.js";
import { lampUnder, lampOver, nightLeak, dust, bokeh } from "./c-ambiente.js";
import { drawFrases, measureRL, C1, C2, D1, D2, PROG } from "./c-frases.js";

const F = 1400; // distancia focal del tratamiento (2.6)
const N = 24;
const TOP = N - 1; // AE, la última en llegar
const BORDER = "#ebe4d6";
const deg = (d) => (d * Math.PI) / 180;

// ─── la costura con b-sala (C-P2-5) ──────────────────────────────────────────
// Esta escena es la dueña de la pila. B trae cada hoja volando hasta t_j y lee
// de acá, en tiempo de ejecución, camAt, pileSlot, markSeed y LANDING (el
// estado de entrega: estirada K4, papel, radio y la luz de la lámpara ya
// aplicada), y de c-hoja.js marksFor y drawFaceContent; así el último frame
// del vuelo es exactamente el primero de la pila. No leer nada de b-hojas acá:
// sería circular.

// ─── la pila (4.4) ───────────────────────────────────────────────────────────
// Hoja j (0 abajo): borde inferior en y = 930 - 8j, cara 460 x 459 (540 x
// 0,85), skewX -6° (el borde de arriba corrido +48 px), centro x 1440 +
// jitter ±10 px, rotación ±1,5°. La 23 no tiene jitter: sus esquinas son el
// contrato C-P2-9 (TL 1258,287 TR 1718,287 BR 1670,746 BL 1210,746).
export const PILE = { cx: 1440, bottom: 930, step: 8, scaleY: 0.85, shift: 48 };
const SY = 0.85;
const KX = PILE.shift / SHEET_H; // corrimiento en x por unidad de y de hoja
// Hoja (0..460, 0..540, origen arriba a la izquierda) → coordenadas locales con
// origen en el centro del borde inferior.
const LOCAL = [1, 0, -KX, SY, -SHEET_W / 2 + PILE.shift, -SHEET_H * SY];

function ownSlot(j) {
  return {
    cx: PILE.cx + (j === TOP ? 0 : (hash2(j, 11) * 2 - 1) * 10),
    bottom: PILE.bottom - PILE.step * j,
    rot: j === TOP ? 0 : deg((hash2(j, 12) * 2 - 1) * 1.5),
  };
}
export const SLOTS = Array.from({ length: N }, (_, j) => ownSlot(j));
export const pileSlot = (j) => SLOTS[j]; // { cx, bottom, rot } en el mundo de C
export const landAt = (j) => 118 + 0.5 * j; // t_j (C-P2-5)

// Iniciales en el orden de llegada: la grilla de b-sala (8 x 3, en orden de
// grilla) ordenada por distancia al pie de la pila, la más cercana primero.
const GRID = "AE NE SE DE EE JE CE TE PE LE RE FE GE BE ME VE OE HE ZE AP NP SP DP TP".split(" ");
const gridXY = (i) => [435 + 150 * (i % 8), [590, 740, 890][Math.floor(i / 8)]];
const dPile = (i) => Math.hypot(gridXY(i)[0] - 1440, gridXY(i)[1] - 930);
const ORDER = GRID.map((_, i) => i).sort((a, b) => dPile(a) - dPile(b) || a - b);
export const INITIALS = ORDER.map((i) => GRID[i]); // INITIALS[23] === "AE"
export const markSeed = (j) => (j === TOP ? 5 : 40 + j);
const MARKS = INITIALS.map((_, j) => marksFor(markSeed(j)));

// Estado de entrega en t_j: lo que b-sala dibuja en el último frame del vuelo
// y desde donde sigue esta escena. B lo lee de acá.
export const LANDING = {
  stretch: [0.975, 1.05], // K4 a media amplitud ("micro squash"), origen en el centro del borde inferior
  squash: [1.06, 0.92], // en t_j + 2, después snap
  paper: PAPER,
  radius: 0,
  lit: 1, // la hoja llega con la luz de la lámpara (light) aplicada entera
  light: { cx: 1540, cy: 280, r: 1020, stops: [[0, "#ffffff"], [0.3, "#fcf8f2"], [0.55, "#ebe1d4"], [0.78, "#c9baa7"], [1, "#9c8b77"]] },
};

// ─── matrices afines [a b c d e f] ───────────────────────────────────────────
const mMul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const mT = (x, y) => [1, 0, 0, 1, x, y];
const mR = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const mS = (x, y) => [x, 0, 0, y, 0, 0];
const mAp = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// ─── tiempos ─────────────────────────────────────────────────────────────────
const LAMP_ON = 119; // el punto de "Toda la sala." llega a la lámpara (b-sala)
const BTN_IN = 126;
const TAP = 154;
const PEN = [155, 161];
const PEN_TAIL = [161, 165];
const waveAt = (j) => 161 + 0.33 * j;
const KD_TOP = [0, 1, 2, 3].map((r) => 166 + 1.2 * r);
const EAR = [170, 174];
const RINGS = 196;
const LIFT = [208, 212];
const HANDOFF = 214;
const RECEDE = [214, 228];

// K4 después del contacto, a media amplitud ("micro squash", h 30): b trae
// la hoja estirada (LANDING.stretch) en t_j, se aplasta en 2 f y vuelve con
// snap.
function squash(t, C) {
  const pre = LANDING.stretch;
  if (t < C) return pre;
  const sq = LANDING.squash;
  if (t < C + 2) {
    const k = (t - C) / 2;
    return [lerp(pre[0], sq[0], k), lerp(pre[1], sq[1], k)];
  }
  const k = spr(t, C + 2, SPR.snap);
  return [lerp(sq[0], 1, k), lerp(sq[1], 1, k)];
}

// Vaivén de las 8 de arriba desde el último aterrizaje (wobble, ~un beat de
// período): hasta ±2,5° en la cima, pesado por la altura. Arranca del reposo
// con velocidad (el empujón de la última hoja, que vino de la izquierda) y se
// apaga hacia f180.
function sway(t, j) {
  if (j < 16) return 0;
  const T0 = landAt(TOP);
  if (t <= T0) return 0;
  // Cola recortada desde f185 (ya vale menos de 0,3 px en la cima): en f214 la
  // hoja de arriba tiene que estar exactamente en el contrato C-P2-9.
  const tail = 1 - EASE.swell(prog(t, 185, 200));
  return deg(2.5) * ((j - 15) / 8) * impulse(t, T0, SPR.wobble) * tail;
}

// La onda de Generar sube por la pila: cada hoja se levanta un poco al pasar.
const waveBump = (t, j) => -2.6 * impulse(t, waveAt(j), SPR.snap);
function edgeFlash(t, j) {
  const u = t - waveAt(j);
  if (u < 0 || u > 2.3) return 0;
  return u < 0.5 ? u / 0.5 : 1 - EASE.swell((u - 0.5) / 1.8);
}

function sheetMatrix(j, t) {
  const sl = SLOTS[j];
  const [sx, sy] = squash(t, landAt(j));
  let m = mT(sl.cx, sl.bottom + waveBump(t, j));
  m = mMul(m, mR(sl.rot));
  m = mMul(m, mS(sx, sy));
  m = mMul(m, LOCAL);
  const a = sway(t, j);
  if (a) m = mMul(mMul(mMul(mT(PILE.cx, PILE.bottom), mR(a)), mT(-PILE.cx, -PILE.bottom)), m);
  return m;
}

const polyOf = (m, pts) => pts.map(([x, y]) => mAp(m, x, y));
function pathPoly(c, P, dx = 0, dy = 0) {
  c.moveTo(P[0][0] + dx, P[0][1] + dy);
  for (let i = 1; i < P.length; i++) c.lineTo(P[i][0] + dx, P[i][1] + dy);
  c.closePath();
}
function fillPoly(c, P, style, dx = 0, dy = 0) {
  c.beginPath();
  pathPoly(c, P, dx, dy);
  c.fillStyle = style;
  c.fill();
}

// Estado de la hoja j en t: renglones (KD), oreja, anillos.
function sheetState(j, t) {
  const kd = j === TOP ? KD_TOP : [0, 1, 2, 3].map((r) => waveAt(j) + 0.5 * r);
  return {
    initials: INITIALS[j],
    marks: MARKS[j],
    kd,
    ear: j === TOP ? EASE.glide(prog(t, EAR[0], EAR[1])) : 0,
    ringH: j === TOP ? RINGS : null,
  };
}

// Luz de la lámpara sobre el papel: multiplica hacia un marrón cálido a medida
// que se aleja de la lámpara. b entrega cada hoja con esta misma luz ya
// aplicada (LANDING.light), así el aterrizaje no salta de tono. Después del
// último aterrizaje una segunda pasada ahonda la caída (la lámpara "asienta")
// en 12 f, sin saltos.
function lampGradient(c) {
  const L = LANDING.light;
  const g = c.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, L.r);
  for (const [o, col] of L.stops) g.addColorStop(o, col);
  return g;
}
function deepGradient(c) {
  const g = c.createRadialGradient(1560, 250, 0, 1560, 250, 1050);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.4, "#ffffff");
  g.addColorStop(0.62, "#efe4d6");
  g.addColorStop(0.85, "#d4c2ac");
  g.addColorStop(1, "#bca58c");
  return g;
}
const deepK = (t) => EASE.swell(prog(t, 129.5, 142));
// Luz al aterrizar: la que trae la hoja de B (LANDING.lit) y el resto en 8 f.
const litAt = (j, t) => LANDING.lit + (1 - LANDING.lit) * EASE.swell(prog(t, landAt(j), landAt(j) + 8));
function shade(c, P, g, strength) {
  if (strength <= 0.002) return;
  c.save();
  c.globalCompositeOperation = "multiply";
  c.globalAlpha *= strength;
  c.beginPath();
  pathPoly(c, P);
  c.fillStyle = g;
  c.fill();
  c.restore();
}

// Sombra de contacto (4.4): elipse 520 x 44, rgba(0,0,0,.45), blur 20, y 940.
function contactShadow(c, n) {
  const k = clamp(n / 5);
  if (k <= 0) return;
  c.save();
  c.translate(PILE.cx, 940);
  c.scale(1, 44 / 520);
  let g = c.createRadialGradient(0, 0, 0, 0, 0, 300);
  g.addColorStop(0, `rgba(0,0,0,${(0.45 * k).toFixed(3)})`);
  g.addColorStop(0.72, `rgba(0,0,0,${(0.36 * k).toFixed(3)})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(-320, -320, 640, 640);
  c.restore();
  // Oclusión apretada justo debajo de la hoja de abajo.
  c.save();
  c.translate(PILE.cx - 4, 931);
  c.scale(1, 7 / 250);
  g = c.createRadialGradient(0, 0, 0, 0, 0, 250);
  g.addColorStop(0, `rgba(0,0,0,${(0.55 * clamp(n)).toFixed(3)})`);
  g.addColorStop(0.85, `rgba(0,0,0,${(0.4 * clamp(n)).toFixed(3)})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(-260, -260, 520, 520);
  c.restore();
}

// Una hoja: sombra propia sobre la de abajo (la lámpara está arriba a la
// derecha), papel y el borde #ebe4d6 de la tarjeta.
function sheetBody(c, P, j, paper = LANDING.paper) {
  if (j > 0) {
    fillPoly(c, P, "rgba(33,22,14,0.34)", -1.2, 2.2);
    fillPoly(c, P, "rgba(33,22,14,0.12)", -2.5, 5.5);
  }
  c.beginPath();
  pathPoly(c, P);
  c.fillStyle = paper;
  c.fill();
  c.lineWidth = 1.5;
  c.strokeStyle = BORDER;
  c.stroke();
}

function drawContent(c, M, t, st, paper = LANDING.paper) {
  c.save();
  c.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  drawFaceContent(c, t, st);
  drawFaceEar(c, st.ear, paper);
  c.restore();
}

// ─── pila en el plano z = 0 (hojas 0 a 22; la 23 va en su propio plano) ──────
function drawPileLayer(c, t, lift) {
  let n = 0;
  for (let j = 0; j < N; j++) if (t >= landAt(j)) n = j + 1;
  if (!n) return;
  contactShadow(c, n);
  const last = Math.min(n - 1, TOP - 1);
  const g = lampGradient(c);
  const dk = deepK(t);
  const gd = dk > 0.002 ? deepGradient(c) : null;
  // Contenido: solo se ve el de la hoja de más arriba. Mientras caen, la última
  // que aterrizó; después, la 22 cuando la 23 se levanta y la deja al
  // descubierto (f214).
  const contentJ = n - 1 < TOP || t >= LIFT[0] - 2 ? last : -1;
  for (let j = 0; j <= last; j++) {
    const M = sheetMatrix(j, t);
    const P = polyOf(M, facePoly(false, LANDING.radius));
    sheetBody(c, P, j);
    if (j === contentJ) drawContent(c, M, t, sheetState(j, t));
    shade(c, P, g, litAt(j, t));
    if (gd) shade(c, P, gd, dk);
  }
  // Sombra de la hoja 23 cuando se levanta: se abre y se oscurece.
  if (lift > 0.001 && n === N) {
    const P = polyOf(sheetMatrix(TOP, t), facePoly(true, lerp(LANDING.radius, CARD_R, lift)));
    const a = c.getTransform().a;
    c.save();
    c.shadowColor = `rgba(0,0,0,${(0.18 + 0.3 * lift).toFixed(3)})`;
    c.shadowBlur = (6 + 22 * lift) * a;
    c.shadowOffsetX = (-10000 - 7 * lift) * a;
    c.shadowOffsetY = 18 * lift * a;
    fillPoly(c, P, "#000", 10000, 0);
    c.restore();
  }
  // La onda: el canto de cada hoja se enciende 2 f al pasar (emisivo).
  for (let j = 0; j <= last; j++) {
    const k = edgeFlash(t, j);
    if (k > 0.001) flashEdge(c, sheetMatrix(j, t), k);
  }
}

function flashEdge(c, M, k) {
  const r = LANDING.radius;
  const [a, b] = [[r, SHEET_H], [SHEET_W - r, SHEET_H]].map(([x, y]) => mAp(M, x, y - 1));
  const line = (cx, w, col, al) => {
    cx.save();
    cx.globalAlpha *= al;
    cx.beginPath();
    cx.moveTo(a[0], a[1]);
    cx.lineTo(b[0], b[1]);
    cx.lineWidth = w;
    cx.lineCap = "round";
    cx.strokeStyle = col;
    cx.stroke();
    cx.restore();
  };
  line(c, 4, "#fb923c", k);
  emit(c, (e) => line(e, 10, "#fb923c", k));
}

// La hoja de arriba, en su propio plano (se levanta hacia la cámara). Mientras
// sube se vuelve la tarjeta que toma e-ajustas en f214: esquinas vivas a ~12,6
// px (el radio 28 de la tarjeta de lectura escalado a la hoja), papel blanco,
// sin separador y sin la sombra de la lámpara (queda iluminada entera).
function drawTopSheet(c, t, lift) {
  const M = sheetMatrix(TOP, t);
  const st = { ...sheetState(TOP, t), divider: 1 - lift };
  const P = polyOf(M, facePoly(st.ear > 0, lerp(LANDING.radius, CARD_R, lift)));
  const paper = lift > 0 ? mix(LANDING.paper, CARD_PAPER, lift) : LANDING.paper;
  sheetBody(c, P, TOP, paper);
  drawContent(c, M, t, st, paper);
  shade(c, P, lampGradient(c), litAt(TOP, t) * (1 - lift));
  if (deepK(t) > 0.002) shade(c, P, deepGradient(c), deepK(t) * (1 - lift));
  const k = edgeFlash(t, TOP);
  if (k > 0.001) flashEdge(c, M, k);
  // Brillo de los puntos cuando reciben el golpe de las marcas y en sus anillos.
  emit(c, (e) => {
    e.save();
    e.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    for (let r = 0; r < 4; r++) {
      // El renglón brilla un instante mientras se vuelve línea (la tinta llega
      // con la onda) y se apaga en ~6 f.
      const u = t - st.kd[r];
      const wet = u > 0 && u < 7 ? 0.55 * Math.sin((Math.PI * u) / 7) : 0;
      if (wet > 0.01) {
        e.globalAlpha = wet;
        e.strokeStyle = "#fb923c";
        e.lineWidth = 16;
        e.lineCap = "round";
        e.beginPath();
        e.moveTo(32, ROW_Y[r]);
        e.lineTo(32 + 352 * clamp(u / 3.5), ROW_Y[r]);
        e.stroke();
      }
      const arr = rowArrive(st.kd[r]);
      const hit = t >= arr ? clamp(1 - (t - arr) / 6) : 0;
      const rg = t >= RINGS + r && t < RINGS + r + 8 ? 0.6 * (1 - (t - RINGS - r) / 8) : 0;
      const a = hit + rg;
      if (a <= 0.01) continue;
      e.globalAlpha = a;
      e.fillStyle = "#fb923c";
      e.beginPath();
      e.arc(PERIOD_X, ROW_Y[r], 9, 0, Math.PI * 2);
      e.fill();
    }
    e.restore();
  });
}

// ─── "Generar informes (24)" (4.4) ───────────────────────────────────────────
// En vertical el botón va DEBAJO de la pila, centrado con ella, y el trazo
// sube de su borde de arriba hasta el frente de la pila.
const BTN = IS_V ? { x: 1254, y: 1010, w: 420, h: 76, r: 18 } : { x: 120, y: 810, w: 420, h: 76, r: 18 };
const TAP_PT = IS_V ? [1602, 1048] : [468, 848];
const LABEL = "Generar informes (24)";
const LABEL_STYLE = { size: 30, weight: 700, tracking: -0.01 };

function btnScale(t) {
  if (t < 150) return 1;
  if (t < TAP) return lerp(1, 0.97, EASE.swell((t - 150) / 4));
  if (t < TAP + 1) return lerp(0.97, 0.94, EASE.brake(t - TAP));
  return lerp(0.94, 1, spr(t, TAP + 1, SPR.snap));
}

function drawButton(c, t) {
  if (t < BTN_IN) return;
  const pop = spr(t, BTN_IN, SPR.snap); // K3: 0 → 1 con overshoot 11,5 %
  let a = clamp((t - BTN_IN) / 2);
  let dy = 24 * (1 - pop);
  // Después del tap el botón ya entregó su tinta: se hunde y se apaga.
  const out = EASE.accel(prog(t, 163, 172));
  a *= 1 - out;
  dy += 18 * out;
  if (a <= 0.002) return;
  const s = pop * btnScale(t);
  const cx = BTN.x + BTN.w / 2;
  const cy = BTN.y + BTN.h / 2;
  c.save();
  c.globalAlpha *= a;
  c.translate(cx, cy + dy);
  c.scale(s, s);
  c.translate(-cx, -cy);
  // Cuerpo con un halo ámbar (sobre Noche la sombra no se ve: brilla).
  c.save();
  c.shadowColor = "rgba(194,65,12,0.5)";
  c.shadowBlur = 34 * c.getTransform().a;
  c.shadowOffsetY = 8 * c.getTransform().a;
  rr(c, BTN.x, BTN.y, BTN.w, BTN.h, BTN.r);
  c.fillStyle = "#c2410c";
  c.fill();
  c.restore();
  const flash = t >= TAP ? clamp(1 - (t - TAP) / 5) : 0;
  rr(c, BTN.x, BTN.y, BTN.w, BTN.h, BTN.r);
  c.fillStyle = flash > 0 ? mix("#c2410c", "#ea6a28", flash) : "#c2410c";
  c.fill();
  // Ripple del tap, adentro del botón (#fde9d3, r 0 → 260 en 10 f).
  if (t >= TAP && t < TAP + 11) {
    const k = EASE.glide(clamp((t - TAP) / 10));
    c.save();
    rr(c, BTN.x, BTN.y, BTN.w, BTN.h, BTN.r);
    c.clip();
    c.globalAlpha *= 0.65 * (1 - k);
    c.fillStyle = "#fde9d3";
    c.beginPath();
    c.arc(TAP_PT[0], TAP_PT[1], 260 * k, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // Contenido: el Sparkles se dibuja por trim y el texto entinta un instante
  // después (entrada escalonada adentro del botón).
  const lay = glyphs(c, LABEL, LABEL_STYLE);
  const iw = 33;
  const gap = 12;
  const total = iw + gap + lay.width;
  const x0 = BTN.x + (BTN.w - total) / 2;
  icon(c, "sparkles", x0 + iw / 2, cy, iw, { color: "#ffffff", width: 2.4, progress: EASE.pen(prog(t, BTN_IN + 1, BTN_IN + 7)) });
  const ta = clamp((t - BTN_IN - 1.5) / 3);
  if (ta > 0) {
    c.save();
    c.globalAlpha *= ta;
    setType(c, LABEL_STYLE);
    c.fillStyle = "#ffffff";
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillText(LABEL, x0 + iw + gap, cy + lay.cap / 2 + 8 * (1 - EASE.glide(ta)));
    c.restore();
  }
  c.restore();
  // Anillos del tap afuera del botón (el segundo 2 f después y más chico): el
  // golpe tiene que leerse en el campo oscuro también a tamaño de celular.
  // Van también a la capa emisiva: el brillo sobrevive al promedio del
  // obturador cuando el anillo se abre rápido.
  for (const [d, R, w0, a0] of [[0, 260, 7, 0.95], [2, 170, 4, 0.6]]) {
    const H = TAP + d;
    if (t < H || t >= H + 11) continue;
    const k = EASE.glide(clamp((t - H) / 10));
    const ringFn = (cx, w, a) => {
      cx.save();
      cx.globalAlpha *= a;
      cx.lineWidth = w;
      cx.strokeStyle = "#fde9d3";
      cx.beginPath();
      cx.arc(TAP_PT[0], TAP_PT[1], lerp(24, R, k), 0, Math.PI * 2);
      cx.stroke();
      cx.restore();
    };
    ringFn(c, lerp(w0, 0.75, k), a0 * (1 - k));
    emit(c, (e) => ringFn(e, lerp(w0 * 2, 2, k), 0.7 * a0 * (1 - k)));
  }
}

// ─── el trazo de Generar (TG) ────────────────────────────────────────────────
// Cuadrática de (540, 848) con control (880, 960) hasta la pila en (1235, 905),
// cabeza con `pen` en f155-161, cola que se mete en la pila en f161-165.
const PQ = IS_V ? [[1464, 1010], [1620, 975], [1262, 915]] : [[540, 848], [880, 960], [1235, 905]];
const PEN_PTS = (() => {
  const pts = [];
  const cum = [0];
  const n = 160;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    pts.push([m * m * PQ[0][0] + 2 * m * u * PQ[1][0] + u * u * PQ[2][0], m * m * PQ[0][1] + 2 * m * u * PQ[1][1] + u * u * PQ[2][1]]);
    if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, L: cum[n] };
})();
function penAt(s) {
  const { pts, cum } = PEN_PTS;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
}
function penPath(c, s0, s1) {
  const { pts, cum } = PEN_PTS;
  c.beginPath();
  const a = penAt(s0);
  c.moveTo(a[0], a[1]);
  for (let i = 0; i < pts.length; i++) if (cum[i] > s0 && cum[i] < s1) c.lineTo(pts[i][0], pts[i][1]);
  const b = penAt(s1);
  c.lineTo(b[0], b[1]);
}

function drawPen(c, t) {
  if (t < PEN[0] || t > PEN_TAIL[1] + 8) return;
  const L = PEN_PTS.L;
  const sH = L * EASE.pen(prog(t, PEN[0], PEN[1]));
  const sT = L * EASE.accel(prog(t, PEN_TAIL[0], PEN_TAIL[1]));
  const head = penAt(sH);
  if (sH - sT > 0.5) {
    const stroke = (cx, w, col) => {
      penPath(cx, sT, sH);
      cx.lineWidth = w;
      cx.lineCap = "round";
      cx.lineJoin = "round";
      cx.strokeStyle = col;
      cx.stroke();
    };
    stroke(c, 8, "#c2410c");
    // Los últimos 90 px, más calientes: la tinta fresca de la cabeza.
    const s0 = Math.max(sT, sH - 90);
    penPath(c, s0, sH);
    const tail = penAt(s0);
    const g = c.createLinearGradient(tail[0], tail[1], head[0], head[1]);
    g.addColorStop(0, "rgba(251,146,60,0)");
    g.addColorStop(1, "rgba(253,186,116,1)");
    c.lineWidth = 8;
    c.lineCap = "round";
    c.strokeStyle = g;
    c.stroke();
    emit(c, (e) => stroke(e, 14, "#fb923c"));
  }
  // Cabeza brillante mientras viaja. Se dibuja como una cápsula desde donde
  // estaba un sub-frame antes (obturador / muestras de motion()): a ~250 px/f
  // las muestras se tocan y la cabeza deja una estela continua, no cuentas.
  const alive = t < PEN[1] + 1 ? 1 : clamp(1 - (t - PEN[1] - 1) / 3);
  if (alive > 0 && sH > 1) {
    const m = motion(Math.ceil(t));
    const prev = penAt(L * EASE.pen(prog(t - m.shutter / m.samples, PEN[0], PEN[1])));
    const capsule = (cx, w, col) => {
      cx.save();
      cx.globalAlpha *= alive;
      cx.beginPath();
      cx.moveTo(prev[0], prev[1]);
      cx.lineTo(head[0] + 0.01, head[1]);
      cx.lineWidth = w;
      cx.lineCap = "round";
      cx.strokeStyle = col;
      cx.stroke();
      cx.restore();
    };
    capsule(c, 15, "#fde9d3");
    emit(c, (e) => capsule(e, 30, "#fde9d3"));
  }
  // Impacto en la base de la pila (f161): un anillo emisivo corto.
  if (t >= PEN[1] && t < PEN[1] + 9) {
    const k = EASE.glide((t - PEN[1]) / 9);
    const [x, y] = PQ[2];
    const ringFn = (cx, a) => {
      cx.save();
      cx.globalAlpha *= a * (1 - k);
      cx.lineWidth = lerp(4, 0.5, k);
      cx.strokeStyle = "#fb923c";
      cx.beginPath();
      cx.ellipse(x, y, lerp(8, 90, k), lerp(4, 30, k), 0, 0, Math.PI * 2);
      cx.stroke();
      cx.restore();
    };
    ringFn(c, 0.9);
    emit(c, (e) => ringFn(e, 1));
  }
}

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Dolly real (cam.z, con paralaje entre capas) de 1,00 a 1,06 hacia
// (1440, 560) en f112-160, un avance casi imperceptible hasta f192 y después
// un retroceso que termina en f214 con la hoja de arriba (z -40) exactamente
// en su lugar (C-P2-9): cam.z = -40, sin corrimiento, sin cámara en mano.
// Desde f214 la cámara sigue alejándose: la pila y la lámpara quedan a z +700.
const FOCUS = [1440, 560];
const PUNCH_AT = [1440, 600];
function dolly(t) {
  if (t <= 112) return 1;
  if (t <= 160) return lerp(1, 1.06, EASE.swell((t - 112) / 48));
  return lerp(1.06, 1.068, clamp((t - 160) / 32));
}
export function camAt(t) {
  const s = dolly(Math.min(t, 192));
  let z = F * (1 - 1 / s);
  let x = (FOCUS[0] - 960) * (1 - 1 / s);
  let y = (FOCUS[1] - 540) * (1 - 1 / s);
  const kb = EASE.swell(clamp((t - 192) / (HANDOFF - 192)));
  z = lerp(z, -40, kb);
  x = lerp(x, 0, kb);
  y = lerp(y, 0, kb);
  if (t > HANDOFF) z -= 700 * EASE.accel(prog(t, RECEDE[0], RECEDE[1]));
  // Cámara en mano (2.6): 1,5 px, 0,4 Hz, roll 0,15°. Se apaga en f208-214.
  const hh = t < 208 ? 1 : 1 - EASE.swell(clamp((t - 208) / 6));
  const s0 = F / (F - z);
  x += (hh * 1.5 * fbm1(t / 75, 51)) / s0;
  y += (hh * 1.5 * fbm1(t / 75 + 3.7, 52)) / s0;
  const roll = hh * deg(0.15) * fbm1(t / 75 + 9.1, 53);
  // Punch 2 (f168), solo el mundo, con el pivote en la pila.
  const k = t < 192 ? punch(t, 168) : 1; // a f192 ya asentó (<1e-6): f214 queda exacto
  if (k !== 1) {
    x = PUNCH_AT[0] - 960 - (PUNCH_AT[0] - x - 960) / k;
    y = PUNCH_AT[1] - 540 - (PUNCH_AT[1] - y - 540) / k;
  }
  return { x, y, z, F, zoom: k, roll };
}

// ─── dibujo ──────────────────────────────────────────────────────────────────
// La lámpara se insinúa desde f110 y se enciende cuando le llega el punto de
// b-sala (f119): 30 % antes, el resto con brake en 5 f.
const lampK = (t) => (0.3 * EASE.swell(prog(t, 110, LAMP_ON)) + 0.7 * EASE.brake(prog(t, LAMP_ON, LAMP_ON + 5))) * (1 - 0.3 * prog(t, RECEDE[0], RECEDE[1]));
const liftK = (t) => EASE.swell(prog(t, LIFT[0], LIFT[1]));

function draw(ctx, t) {
  // Hasta f131 abajo está b-sala (su mundo crema y el iris del anochecer).
  if (t >= 131) {
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(-4000, -4000, 12000, 12000);
  }
  const cam = camAt(t);
  const lk = lampK(t);
  const lift = liftK(t);
  const withTop = t < HANDOFF;
  const recede = prog(t, RECEDE[0], RECEDE[1]);

  nightLeak(ctx, t, lk);
  layer(ctx, cam, 0, (c) => lampUnder(c, lk));

  // Pila (y sombra de contacto). Desde f214 queda quieta y solo la cámara se
  // aleja: se estampa desde su caché desenfocada (hasta 12 px en pantalla).
  if (withTop) {
    layer(ctx, cam, 0, (c) => drawPileLayer(c, t, lift));
    if (t >= landAt(TOP)) layer(ctx, cam, -40 * lift, (c) => drawTopSheet(c, t, lift));
  } else layer(ctx, cam, 0, (c, s) => drawRecession(c, (12 * EASE.accel(recede)) / s));

  layer(ctx, cam, 0, (c) => {
    lampOver(c, lk);
    drawButton(c, t);
    drawPen(c, t);
  });
  dust(ctx, cam, t, lk, { extraBlur: 12 * recede });
  bokeh(ctx, cam, t, EASE.swell(prog(t, 112, 126)));
}

// ─── la pila que se aleja (f214-230) ─────────────────────────────────────────
// Desde f214 la pila (hojas 0 a 22, la 22 ya escrita, la sombra de contacto)
// no cambia: solo la cámara retrocede hasta z +700 mientras el foco pasa a la
// tarjeta de lectura. Se dibuja UNA vez por worker en coordenadas de mundo y se
// guarda en cuatro niveles de desenfoque (0, 4, 8 y 16 px de mundo, como la
// caché de niveles de E8); cada sub-frame estampa los dos vecinos del blur que
// pide y los mezcla. Un filter blur por sub-frame costaba 30-45 ms.
const REC_BOX = { x: 1060, y: 180, w: 860, h: 880 };
const REC_LEVELS = [0, 4, 8, 16];
let recCache = null;
function recessionLevels() {
  const sc = env.scale;
  if (recCache && recCache.scale === sc) return recCache.imgs;
  const w = Math.ceil(REC_BOX.w * sc);
  const h = Math.ceil(REC_BOX.h * sc);
  const base = createCanvas(w, h);
  const b = base.getContext("2d");
  b.setTransform(sc, 0, 0, sc, -REC_BOX.x * sc, -REC_BOX.y * sc);
  // Estado de la pila recién soltada la hoja de arriba (todo ya asentado).
  drawPileLayer(b, HANDOFF, 0);
  const imgs = REC_LEVELS.map((r) => {
    if (!r) return base;
    const c = createCanvas(w, h);
    const x = c.getContext("2d");
    x.filter = `blur(${(r * sc).toFixed(2)}px)`;
    x.drawImage(base, 0, 0);
    x.filter = "none";
    return c;
  });
  recCache = { scale: sc, imgs };
  return imgs;
}

function drawRecession(c, blurWorld) {
  const imgs = recessionLevels();
  let i = 0;
  while (i < REC_LEVELS.length - 2 && blurWorld > REC_LEVELS[i + 1]) i++;
  const f = clamp((blurWorld - REC_LEVELS[i]) / (REC_LEVELS[i + 1] - REC_LEVELS[i]));
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(imgs[i], REC_BOX.x, REC_BOX.y, REC_BOX.w, REC_BOX.h);
  if (f > 0.002) {
    c.globalAlpha *= f;
    c.drawImage(imgs[i + 1], REC_BOX.x, REC_BOX.y, REC_BOX.w, REC_BOX.h);
  }
  c.restore();
}

// Esquinas de la hoja de arriba en pantalla (para e-ajustas: C-P2-9 en f214).
export function topSheetQuad(t = HANDOFF) {
  const cam = camAt(t);
  const z = -40 * liftK(t);
  const M = sheetMatrix(TOP, t);
  return [[0, 0], [SHEET_W, 0], [SHEET_W, SHEET_H], [0, SHEET_H]].map(([x, y]) => {
    const [wx, wy] = mAp(M, x, y);
    const p = project(cam, wx, wy, z);
    return [p.x, p.y];
  });
}

// Cara de la hoja de arriba en espacio de hoja (460 x 540), con papel, para
// que e-ajustas la tome en f214 igual a como la dejó la pila (C-P2-8).
export function drawTopSheetFace(ctx, t = HANDOFF) {
  const lift = liftK(t);
  const st = { ...sheetState(TOP, t), divider: 1 - lift };
  ctx.save();
  ctx.beginPath();
  const pts = facePoly(st.ear > 0, lerp(LANDING.radius, CARD_R, lift));
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  const paper = mix(LANDING.paper, CARD_PAPER, lift);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BORDER;
  ctx.stroke();
  drawFaceContent(ctx, t, st);
  drawFaceEar(ctx, st.ear, paper);
  ctx.restore();
}

// ─── lectura ─────────────────────────────────────────────────────────────────
const rlC = measureRL([[C1, PROG.C1], [C2, PROG.C2]], 108, 175);
const rlD = measureRL([[D1, PROG.D1], [D2, PROG.D2]], 165, 226);

function motion(t) {
  if (t < 138) return { shutter: 0.75, samples: 12 }; // aterrizajes, K3 del botón
  if (t < 153) return { shutter: 0.5, samples: 8 }; // silencio
  if (t < 159) return { shutter: 0.75, samples: 16 }; // tap y trazo (cabeza a ~250 px/f)
  // Carrete a ~130 px/f: con 12 muestras quedaban saltos de 8 px que en los
  // trazos de wght 200 se veían como persiana; con 32 son ~3 px y la estela es
  // continua. También cubre la onda, el KD y el punch 2.
  if (t < 177) return { shutter: 0.75, samples: 32 };
  if (t < 214) return { shutter: 0.5, samples: 8 }; // lectura, lift lento
  return { shutter: 0.75, samples: 12 }; // relevo a la tarjeta, la pila se aleja
}

export default {
  id: "c",
  start: 104,
  end: 230,
  draw,
  drawTop: drawFrases,
  topEnd: 224,
  motion,
  field: (t) => (t >= 120 ? { noche: 1 } : null),
  phrases: [
    // Medidos con glyphsStill (paso 0,25 f) y redondeados al frame; L de D es
    // el arranque del K5 (f218), aunque el primer glifo recién se mueva >2 px
    // un poco después.
    { id: "Los informes del finde.", words: 4, R: Math.ceil(rlC.R), L: Math.ceil(rlC.L) },
    { id: "El borrador ya está.", words: 4, R: Math.ceil(rlD.R), L: Math.min(218, Math.ceil(rlD.L)) },
  ],
  hits: [
    { f: 112, level: "H1", kind: "Los informes (KT)" },
    { f: 115.5, level: "H3", kind: "del finde. (KT)" },
    { f: 119, level: "H3", kind: "punto de del finde." },
    { f: 126, level: "H2", kind: "Generar informes (24) sube; anillo del punto" },
    { f: 154, level: "H2", kind: "tap en Generar (TG)" },
    { f: 161, level: "H3", kind: "el trazo llega a la pila; sube la onda" },
    { f: 168, level: "H1", kind: "El borrador contacta; hoja de arriba escrita; punch 2" },
    { f: 175, level: "H3", kind: "ya está. contacta" },
    { f: 182, level: "H2", kind: "onda de peso" },
    { f: 196, level: "H2", kind: "anillos de los puntos de la hoja" },
    { f: 210, level: "H2", kind: "la hoja se levanta; anillo" },
  ],
  // Para las costuras:
  topSheetQuad,
  drawTopSheetFace,
  pileSlot,
  camAt,
};
