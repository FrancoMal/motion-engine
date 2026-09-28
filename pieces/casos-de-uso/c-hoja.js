// Escena C/D: la hoja de informe de la pila (tratamiento final 4.4 y 4.5).
//
// Todo en ESPACIO DE HOJA: 460 x 540, origen arriba a la izquierda, antes de la
// afín de la pila (escala Y 0,85 y skewX -6°). Quien dibuja pone la
// transformación de la hoja en el ctx y llama a estas funciones.
//
// Esta cara es la fuente de verdad de las dos costuras:
//   b-sala (b-hojas.js) la usa en tiempo de ejecución para las hojas que trae
//     volando hasta t_j: drawFaceContent y marksFor de acá, sobre su papel
//     PAPER de esquinas vivas con borde 1,5 #ebe4d6 (C-P2-5). Su réplica de
//     respaldo pone los 12 puntos de 10 px centrados de x 37 a 379.
//   e-ajustas la toma en f214 (e-lectura.js): tarjeta blanca de radio ~12,6
//     en espacio de hoja (CARD_R), sin separador, renglones como barras con
//     centros de x 32 a 384 y los puntos finales en x 398.
// Por eso los puntos van de 37 a 379 y la línea escrita de 32 a 384 (los
// guiones de las puntas se estiran también hacia afuera), y la hoja de arriba
// pasa de un estado al otro mientras se levanta (f208-214): esquinas, papel y
// separador.
//
// La hoja tiene dos estados y el gesto que los une (KD, "punteado a continuo"):
//   punteado  cuatro renglones de 12 puntos grises con dos marcas de acento
//             cada uno: lo que la docente marcó durante el período.
//   escrito   cada renglón es una línea continua y las dos marcas corrieron
//             hasta el final y se volvieron su punto: el renglón termina como
//             una oración. Son líneas, nunca palabras (hoja de verdad).

import { setType } from "../../engine/text.js";
import { clamp, lerp, mix, hash2 } from "../../engine/math.js";
import { spring } from "../../engine/ease.js";
import { EASE, SPR } from "../../shared/system.js";

export const SHEET_W = 460;
export const SHEET_H = 540;
export const PAPER = "#fffdf9"; // papel de la pila (b-hojas lo entrega igual)
export const CARD_PAPER = "#ffffff"; // la tarjeta de lectura de e-ajustas
export const CARD_R = 28 * (SHEET_W / 1020); // radio 28 de la tarjeta, en espacio de hoja

export const ROW_Y = [190, 260, 330, 400];
const NDOT = 12;
const DOT_D = 10;
const X0 = 37; // centro del primer punto (32 + 10/2)
const X1 = 379; // centro del último (384 - 10/2)
const PITCH = (X1 - X0) / (NDOT - 1);
const L0 = 32; // la línea escrita: la barra de e-ajustas en f214
const L1 = 384;
export const PERIOD_X = 398;
const MARK_D = 12;
const PERIOD_D = 12;

const GRAY = "#d6cdba";
const LINE = "#57534e";
const ACCENT = "#c2410c";
const INK = "#1c1917";
const MUTE = "#a8a29e";
const BORDER = "#ebe4d6";
const AVATAR = "#7c2d12";
const AVATAR_INK = "#faf6ef";
const AV = [414, 56];

// Dos marcas por renglón, sembradas y distintas, nunca en los extremos (así
// se leen como marcas dentro de la fila y no como el final). Semilla 5 para
// AE (j = 23) y 40 + j para las demás; b-hojas la llama con esas semillas.
export function marksFor(seed) {
  const out = [];
  for (let r = 0; r < 4; r++) {
    const a = 1 + Math.floor(hash2(seed * 7 + r, 91) * 9); // 1..9
    let b = 1 + Math.floor(hash2(seed * 7 + r, 92) * 9);
    if (Math.abs(b - a) < 2) b = a + 3 > 10 ? a - 3 : a + 3;
    out.push(a < b ? [a, b] : [b, a]);
  }
  return out;
}

// Respuesta a un impulso de un spring, normalizada a pico 1: arranca en 0,
// sube y vuelve oscilando. Sirve para pops que parten del reposo (un punto que
// recibe un golpe) sin saltar de escala en el frame del golpe.
const impulseCache = new Map();
export function impulse(t, H, cfg = SPR.slam) {
  if (t <= H) return 0;
  const key = cfg.stiffness + "|" + cfg.damping + "|" + cfg.mass;
  let peak = impulseCache.get(key);
  if (peak === undefined) {
    peak = 0;
    for (let f = 0; f < 30; f += 0.05) peak = Math.max(peak, Math.abs(resp(f, cfg)));
    impulseCache.set(key, peak);
  }
  return resp(t - H, cfg) / peak;
}
const resp = (f, cfg) => spring(f, { ...cfg, velocity: 1 }) - spring(f, { ...cfg, velocity: 0 });

// ─── estado del renglón ──────────────────────────────────────────────────────
// kd: frame en que arranca el KD del renglón (Infinity = sigue punteado).
// Cada guion se estira en 3 f con `pen`, 0,09 f de stagger de izquierda a
// derecha: el renglón entero tarda ~4 f (4.4).
const dashK = (t, kd, i) => EASE.pen(clamp((t - kd - i * 0.09) / 3));
// Las marcas corren hasta el final del renglón (lunge) y llegan juntas.
const markStart = (kd, which) => kd + 0.55 + which * 0.35;
const MARK_DUR = 2.8;
export const rowArrive = (kd) => markStart(kd, 1) + MARK_DUR;

function drawRow(ctx, y, marks, t, kd, { ringH = null } = {}) {
  ctx.lineCap = "round";
  if (!(t > kd)) {
    // Punteado: guiones de largo casi 0 con cap redondo = puntos.
    ctx.fillStyle = GRAY;
    ctx.beginPath();
    for (let i = 0; i < NDOT; i++) {
      if (i === marks[0] || i === marks[1]) continue;
      const x = X0 + i * PITCH;
      ctx.moveTo(x + DOT_D / 2, y);
      ctx.arc(x, y, DOT_D / 2, 0, Math.PI * 2);
    }
    ctx.fill();
    for (const m of marks) dot(ctx, X0 + m * PITCH, y, MARK_D, ACCENT);
    return;
  }
  ctx.lineWidth = DOT_D;
  if (dashK(t, kd, NDOT - 1) >= 1) {
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(L0, y);
    ctx.lineTo(L1, y);
    ctx.stroke();
  } else {
    for (let i = 0; i < NDOT; i++) {
      const k = dashK(t, kd, i);
      const isMark = i === marks[0] || i === marks[1];
      if (isMark && k <= 0) continue;
      // El guion de una marca arranca sin largo: queda escondido debajo de la
      // marca hasta que ella se va. Los de las puntas se estiran también hacia
      // afuera, hasta el largo de la línea escrita.
      const half = lerp(isMark ? 0 : 0.05, PITCH / 2 + 0.6, k);
      const cx = X0 + i * PITCH;
      const a = Math.max(L0, i === 0 ? lerp(X0, L0, k) : cx - half);
      const b = Math.min(L1, i === NDOT - 1 ? lerp(X1, L1, k) : cx + half);
      ctx.strokeStyle = mix(GRAY, LINE, k);
      ctx.beginPath();
      ctx.moveTo(a, y);
      ctx.lineTo(Math.max(b, a + 0.01), y);
      ctx.stroke();
    }
  }
  // Las marcas se deslizan por la línea hasta el final y se vuelven el punto.
  const arrive = rowArrive(kd);
  if (t < arrive) {
    marks.forEach((m, which) => {
      const u = EASE.lunge(clamp((t - markStart(kd, which)) / MARK_DUR));
      dot(ctx, lerp(X0 + m * PITCH, PERIOD_X, u), y, MARK_D, ACCENT);
    });
  } else {
    // El punto recibe el golpe de las dos marcas: squash corto con slam.
    const s = 1 + 0.42 * impulse(t, arrive, SPR.slam);
    dot(ctx, PERIOD_X, y, PERIOD_D * s, ACCENT);
    if (ringH !== null) ringOn(ctx, t, ringH, PERIOD_X, y, PERIOD_D, ACCENT);
  }
}

function dot(ctx, x, y, d, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, d / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Anillo del pulso (2.1) en el plano de la hoja: queda en perspectiva.
function ringOn(ctx, t, H, cx, cy, d0, color) {
  if (t < H || t > H + 10) return;
  const k = EASE.glide(clamp((t - H) / 10));
  ctx.save();
  ctx.globalAlpha *= lerp(0.8, 0, k);
  ctx.lineWidth = lerp(4, 0.5, k);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, lerp(d0, d0 * 5, k) / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ─── contorno ────────────────────────────────────────────────────────────────
// Rect (con radio opcional) como polígono, para llevarlo a coordenadas de mundo
// punto por punto (sombras, luz, cantos). Con la oreja, la esquina superior
// derecha queda cortada por la diagonal (416, 0)-(460, 44).
const EAR = 44;
const EA = [SHEET_W - EAR, 0];
const EB = [SHEET_W, EAR];
const EC = [SHEET_W, 0];
const EM = [(EA[0] + EB[0]) / 2, (EA[1] + EB[1]) / 2];

export function facePoly(ear = false, r = 0, seg = 5) {
  const pts = [];
  const arc = (cx, cy, a0, a1, px, py) => {
    if (r <= 0.05) {
      pts.push([px, py]);
      return;
    }
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  arc(r, r, Math.PI, 1.5 * Math.PI, 0, 0);
  if (ear) pts.push(EA, EB);
  else arc(SHEET_W - r, r, 1.5 * Math.PI, 2 * Math.PI, SHEET_W, 0);
  arc(SHEET_W - r, SHEET_H - r, 0, 0.5 * Math.PI, SHEET_W, SHEET_H);
  arc(r, SHEET_H - r, 0.5 * Math.PI, Math.PI, 0, SHEET_H);
  return pts;
}
// Canto inferior (el que se ve en la pila).
export const BOTTOM_EDGE = [[0, SHEET_H], [SHEET_W, SHEET_H]];

// ─── oreja (dog-ear) ─────────────────────────────────────────────────────────
// Triángulo de 44 px de la esquina superior derecha que gira sobre su diagonal.
// La proyección de la punta viaja por la perpendicular a la diagonal: en 90°
// la solapa está de canto y en 180° queda apoyada sobre la cara con el revés
// #ebe4d6 (como la dibuja e-ajustas en f214).
function drawEar(ctx, ear, paper) {
  if (ear <= 0) return;
  const c = Math.cos(Math.PI * ear);
  const tip = [EM[0] + (EC[0] - EM[0]) * c, EM[1] + (EC[1] - EM[1]) * c];
  // Sombra de la solapa sobre la cara mientras gira; apoyada, casi nada.
  const sh = clamp(1 - Math.abs(c));
  if (sh > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(28,25,23,${(0.14 * sh).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(EA[0] - 2, EA[1]);
    ctx.lineTo(EB[0], EB[1] + 3);
    ctx.lineTo(tip[0] - 4, tip[1] + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(EA[0], EA[1]);
  ctx.lineTo(EB[0], EB[1]);
  ctx.lineTo(tip[0], tip[1]);
  ctx.closePath();
  ctx.fillStyle = c >= 0 ? paper : mix(CARD_PAPER, BORDER, -c);
  ctx.fill();
  ctx.strokeStyle = `rgba(28,25,23,${(0.1 * Math.max(0, -c)).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── cara completa ───────────────────────────────────────────────────────────
// o: { initials, marks: [[i, j] x 4], kd: [4] (Infinity = punteado), ear 0..1,
//      ringH (anillo del renglón 0; los demás con 1 f de stagger),
//      divider 0..1 (opacidad del separador) }
// No rellena el papel (lo hace quien dibuja, con la luz de su escena). La firma
// drawFaceContent(ctx, t, o) la usa b-hojas: no cambiarla.
export function drawFaceContent(ctx, t, o) {
  const { initials = "AE", marks, kd = [Infinity, Infinity, Infinity, Infinity], ringH = null, divider = 1 } = o;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setType(ctx, { size: 44, weight: 800, tracking: -0.01 });
  ctx.fillStyle = INK;
  ctx.fillText("Informe", 32, 72);
  setType(ctx, { size: 26, weight: 600, tracking: 0 });
  ctx.fillStyle = MUTE;
  ctx.fillText("Período Medio", 32, 110);
  if (divider > 0.002) {
    ctx.save();
    ctx.globalAlpha *= divider;
    ctx.fillStyle = BORDER;
    ctx.fillRect(32, 144, 396, 1.5);
    ctx.restore();
  }
  // Avatar (tokens 2.10): #7c2d12 con iniciales #faf6ef w800 a 0,4 x diámetro.
  dot(ctx, AV[0], AV[1], 44, AVATAR);
  setType(ctx, { size: 17.6, weight: 800, tracking: 0.01 });
  ctx.textAlign = "center";
  ctx.fillStyle = AVATAR_INK;
  ctx.fillText(initials, AV[0], AV[1] + 6.3);
  ctx.textAlign = "left";
  for (let r = 0; r < 4; r++) drawRow(ctx, ROW_Y[r], marks[r], t, kd[r], { ringH: ringH === null ? null : ringH + r });
  ctx.restore();
}

export function drawFaceEar(ctx, ear, paper = PAPER) {
  drawEar(ctx, ear, paper);
}
