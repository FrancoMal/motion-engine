// Escena E, primera mitad (tratamiento final 4.5 y 4.6):
//   T20'  la hoja de arriba de la pila se desinclina y se vuelve la tarjeta de
//         lectura de Alex, mientras el papel se derrama desde ella y el campo
//         pasa de noche a papel (f214-230);
//   la tarjeta de lectura: el nombre en negrita solo en lectura, "Editar",
//         edición con caret (selección, "entusiasmo" -> "curiosidad"),
//         "Guardar cambios", Loader y vuelta a lectura (f230-294);
//   T20r  la tarjeta se encoge hasta el tile de Alex en el Resumen (f294-308).
//
// La tarjeta es siempre un paralelogramo afín (marco O, U, V): en f214 coincide
// con el cuadrilátero del contrato C-P2-9 y en f228 con el rect x 780-1800,
// y 150-930 (C-P2-10). El contenido se dibuja en su espacio propio (hoja 460 x
// 540 o tarjeta 1020 x 780) con la transformación del marco: el texto sigue
// siendo vectorial durante todo el vuelo.

import { EASE, SPR, spr, p } from "../../shared/system.js";
import { C } from "../../shared/brand.js";
import { rr, icon, button } from "../../shared/ui.js";
import { drawText, glyphs, textWidth } from "../../engine/text.js";
import { clamp, lerp, lerpLog, mix, deg, TAU } from "../../engine/math.js";
import { emit } from "../../engine/env.js";
import { cubicBezier } from "../../engine/ease.js";
import { alexTags, tileCenter } from "./e-carpeta.js";
import { IS_V } from "../../engine/format.js";
import { para, applyFrame, framePt, frameScale, avatarX, tileBody, tileContent, ripple, PAPER, AV } from "./e-ui.js";

export const CW = 1020; // espacio de la tarjeta de lectura
export const CH = 780;
// En vertical la tarjeta sube derecho desde la pila (mismo eje, x 1464) y la
// frase va arriba de ella.
export const CARD = IS_V ? { x: 954, y: 290, w: CW, h: CH } : { x: 780, y: 150, w: CW, h: CH };
const SW = 460; // espacio de la hoja de la pila (antes del escorzo 0,85)
const SH = 540;
const SX = CW / SW;
const SY = CH / SH;
const TC0 = tileCenter(0);
export const TILE0 = { x: TC0[0] - 90, y: TC0[1] - 75, w: 180, h: 150 }; // tile de Alex

// Contrato C-P2-9: cuadrilátero proyectado de la hoja de arriba en f214.
export const Q214 = { TL: [1258, 287], TR: [1718, 287], BR: [1670, 746], BL: [1210, 746] };
const C0 = [(Q214.TL[0] + Q214.TR[0] + Q214.BR[0] + Q214.BL[0]) / 4, (Q214.TL[1] + Q214.BL[1]) / 2];
const C1 = [CARD.x + CW / 2, CARD.y + CH / 2];

// ─── tiempo ──────────────────────────────────────────────────────────────────
export const T = {
  warp0: 214,
  warp1: 230,
  spill0: 217.75,
  spill1: 229.75, // whip centrado en el downbeat de f224
  alex: 245,
  editar: 259, // toque (contacto en la corchea después de "Ajustás.")
  sel0: 264,
  sel1: 268,
  col1: 270,
  type1: 274,
  guardar: 280,
  spin0: 282,
  save: 286,
  exit: 294,
  tile: 308,
};

// ─── marco de la tarjeta ─────────────────────────────────────────────────────

// "glide" con arranque desde el reposo: la misma frenada larga del easing de
// la app, pero sin la pendiente casi infinita del primer frame (con 12-16
// sub-frames esa pendiente se veía como copias apiladas, no como velocidad).
export const GLIDE0 = cubicBezier(0.25, 0, 0.1, 1);
const WARP_END = 228; // C-P2-10: la tarjeta llega exacta a su rect en f228

// Pulso de la tarjeta al guardar (f280): 1 -> 1,006 -> 1.
function savePulse(t) {
  if (t < T.guardar) return 1;
  if (t < T.guardar + 2) return 1 + 0.006 * EASE.brake((t - T.guardar) / 2);
  return 1 + 0.006 * (1 - spr(t, T.guardar + 2, SPR.snap));
}

// Anticipación antes de T20r: la tarjeta inhala (f290-294).
const inhale = (t) => 1 - 0.012 * EASE.swell(clamp((t - 290) / 4));

// Tamaño del papel en el vuelo de T20' (tamaño en log, glide).
function warpSize(t) {
  const k = p(t, T.warp0, WARP_END, GLIDE0);
  return { k, w: lerpLog(Q214.TR[0] - Q214.TL[0], CW, k), h: lerpLog(Q214.BL[1] - Q214.TL[1], CH, k) };
}

// Escala del contenido de la hoja dentro del espacio de la tarjeta. El papel
// crece más a lo ancho que a lo alto, pero el contenido no se estira: sale del
// escorzo (0,85 -> 1) y crece parejo (1 -> 1,12), anclado arriba a la
// izquierda. En f214 coincide exacto con la hoja de la pila.
function sheetScale(t) {
  const { k, w, h } = warpSize(Math.min(t, T.warp1));
  const su = lerp(1, 1.12, k);
  const fs = lerp(0.85, 1, k);
  return [su / (w / CW), (su * fs) / (h / CH)];
}

// Marco de la tarjeta en coordenadas de mundo (antes de la cámara).
export function cardFrame(t) {
  if (t < T.warp1) {
    const { k, w, h } = warpSize(t);
    const lift = 30 * Math.sin(Math.PI * k);
    return para(lerp(C0[0], C1[0], k), lerp(C0[1], C1[1], k) - lift, w, h, lerp(Q214.BL[0] - Q214.TL[0], 0, k), deg(-2.4) * Math.sin(Math.PI * k));
  }
  if (t < T.exit) {
    const s = savePulse(t) * inhale(t);
    return para(C1[0], C1[1], CW * s, CH * s, 0, 0);
  }
  // T20r: se encoge (tamaño en log) por un arco hasta el tile de Alex.
  const k = p(t, T.exit, T.tile, GLIDE0);
  const s0 = inhale(T.exit);
  const w = lerpLog(CW * s0, TILE0.w, k);
  const h = lerpLog(CH * s0, TILE0.h, k);
  const P2 = [TILE0.x + TILE0.w / 2, TILE0.y + TILE0.h / 2];
  const Pc = IS_V ? [1330, 330] : [780, 300];
  const m = 1 - k;
  const cx = m * m * C1[0] + 2 * m * k * Pc[0] + k * k * P2[0];
  const cy = m * m * C1[1] + 2 * m * k * Pc[1] + k * k * P2[1];
  return para(cx, cy, w, h, 0, deg(2.2) * Math.sin(Math.PI * k));
}

// Área del paralelogramo (para la cobertura del campo).
const frameArea = (F) => Math.abs(F.U[0] * F.V[1] - F.U[1] * F.V[0]);
const A214 = frameArea(cardFrame(214));

function frameBounds(F) {
  const pts = [F.O, [F.O[0] + F.U[0], F.O[1] + F.U[1]], [F.O[0] + F.V[0], F.O[1] + F.V[1]], [F.O[0] + F.U[0] + F.V[0], F.O[1] + F.U[1] + F.V[1]]];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// ─── derrame de papel ────────────────────────────────────────────────────────
// Un rect redondeado #faf6ef que nace del rect de la tarjeta en f218 y crece
// (tamaño en log, whip) hasta pasar el cuadro. El pico de velocidad del whip
// cae en el downbeat de f224, cuando la cobertura pasa el 60 %.

// Arranca escondido DEBAJO de la tarjeta (un poco más chico que ella) y sale
// por sus bordes: así no hay un salto de papel en f218.
const SP0 = (() => {
  const F = cardFrame(T.spill0);
  const b = frameBounds(F);
  const w = Math.hypot(F.U[0], F.U[1]) * 0.86;
  const h = Math.abs(F.V[1]) * 0.86;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
})();
// Lo que ve la cámara en el derrame (en vertical, el encuadre de la lectura).
const VIEW = IS_V ? { x: 864, y: -522, w: 1200, h: 2133 } : { x: 0, y: 0, w: 1920, h: 1080 };
const SP1 = IS_V ? { x: 700, y: -700, w: 1530, h: 2500 } : { x: -180, y: -180, w: 2280, h: 1440 };

export function spillAt(t) {
  if (t < T.spill0) return null;
  const q = p(t, T.spill0, T.spill1, EASE.whip);
  const w = lerpLog(SP0.w, SP1.w, q);
  const h = lerpLog(SP0.h, SP1.h, q);
  const cx = lerp(SP0.x + SP0.w / 2, SP1.x + SP1.w / 2, q);
  const cy = lerp(SP0.y + SP0.h / 2, SP1.y + SP1.h / 2, q);
  return { x: cx - w / 2, y: cy - h / 2, w, h, r: lerp(28, 300, q), q };
}

// Cobertura de papel del cuadro (tarjeta o derrame), 0..1.
export function coverage(t) {
  if (t < T.warp0) return 0;
  if (t >= T.spill1) return 1;
  const A = VIEW.w * VIEW.h;
  // La hoja ya estaba en la pila (bajo la lámpara): cuenta solo lo que crece
  // desde f214, así el grade no salta en la costura con la escena C.
  let a = frameArea(cardFrame(t));
  const s = spillAt(t);
  if (s) {
    const vx1 = VIEW.x + VIEW.w;
    const vy1 = VIEW.y + VIEW.h;
    const ix = Math.max(0, Math.min(vx1, s.x + s.w) - Math.max(VIEW.x, s.x));
    const iy = Math.max(0, Math.min(vy1, s.y + s.h) - Math.max(VIEW.y, s.y));
    // Las esquinas redondeadas descuentan (4 - π)·r² cuando caen adentro.
    let corner = 0;
    if (s.x > VIEW.x || s.y > VIEW.y || s.x + s.w < vx1 || s.y + s.h < vy1) corner = (4 - Math.PI) * s.r * s.r;
    a = Math.max(a, ix * iy - corner);
  }
  return clamp((a - A214) / (A - A214));
}

// Región de papel en pantalla (derrame + tarjeta) para que la escena de al
// lado invierta su frase sobre el papel (K7). Con t < 214 no hay papel.
export function paperRegionPath(ctx, t) {
  ctx.beginPath();
  if (t < T.warp0) return false;
  const s = spillAt(t);
  if (s) ctx.roundRect(s.x, s.y, s.w, s.h, Math.min(s.r, s.w / 2, s.h / 2));
  if (t < T.spill1) {
    const F = cardFrame(t);
    ctx.moveTo(F.O[0], F.O[1]);
    ctx.lineTo(F.O[0] + F.U[0], F.O[1] + F.U[1]);
    ctx.lineTo(F.O[0] + F.U[0] + F.V[0], F.O[1] + F.U[1] + F.V[1]);
    ctx.lineTo(F.O[0] + F.V[0], F.O[1] + F.V[1]);
    ctx.closePath();
  }
  return true;
}

export function spillPath(ctx, s) {
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.w, s.h, Math.min(s.r, s.w / 2, s.h / 2));
}

// Labio del derrame: un filo tibio (capa emisiva) que se apaga a medida que
// el papel gana el cuadro. La luz llega desde la página.
export function drawSpillLip(ctx, t) {
  const s = spillAt(t);
  if (!s || s.q <= 0.004 || s.q >= 0.995) return;
  const a = 0.5 * (1 - s.q) * clamp(s.q * 12);
  emit(ctx, (e) => {
    spillPath(e, s);
    e.lineWidth = 10;
    e.strokeStyle = `rgba(251,146,60,${a})`;
    e.stroke();
  });
  ctx.save();
  spillPath(ctx, s);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(255,243,227,${0.6 * a})`;
  ctx.stroke();
  ctx.restore();
}

// ─── texto de la tarjeta ─────────────────────────────────────────────────────

const PROSE = { size: 38, weight: 400, tracking: 0 };
const LINES = [
  "Alex participa con entusiasmo de las propuestas",
  "de la sala y respeta los acuerdos del grupo. En",
  "el proyecto de la huerta propone ideas y ayuda",
  "a sus compañeros a organizarse.",
];
const PX = 60; // x de la prosa en el espacio de la tarjeta (840 en pantalla)
const BASE = [310, 367, 424, 481]; // líneas de base (460 / 517 / 574 / 631)
const ROW_Y = [190, 260, 330, 400]; // renglones de la hoja (espacio de hoja)

// Medidas en vivo (se calculan una vez con el primer ctx).
let M = null;
function measures(ctx) {
  if (M) return M;
  const w = (s, st = PROSE) => textWidth(ctx, s, st);
  M = {
    line: LINES.map((l) => w(l)),
    alex400: w("Alex"),
    alex700: w("Alex", { ...PROSE, weight: 700 }),
    mid: w(" participa con "),
    ent: w("entusiasmo"),
    cur: w("curiosidad"),
    curPrefix: Array.from({ length: 11 }, (_, n) => w("curiosidad".slice(0, n))),
  };
  M.shift = M.cur - M.ent; // -23,0 px
  return M;
}

// "Alex" en negrita: 0 = w400 (edición), 1 = w700 (lectura).
// El obturador es de cola (muestras en [f - s, f)): lo que arranca justo en
// el golpe H recién se vería en H+1. Los resortes que marcan un golpe
// arrancan LEAD antes para que el frame H ya muestre el cambio.
export const LEAD = 0.75;

export function boldK(t) {
  if (t < T.alex - LEAD) return 0;
  if (t < T.editar) return spr(t, T.alex - LEAD, SPR.snap);
  if (t < T.save) return Math.max(-0.04, 1 - spr(t, T.editar, SPR.snap));
  return spr(t, T.save, SPR.snap);
}

// Modo edición 0..1 (borde, foco, subtítulo).
export function editK(t) {
  if (t < T.editar) return 0;
  if (t < T.save) return p(t, T.editar, T.editar + 3, EASE.brake);
  return 1 - p(t, T.save, T.save + 3, EASE.brake);
}

function caretAt(t, xW, m) {
  // Devuelve la x del caret (espacio de tarjeta) o null si no se ve.
  if (t < T.sel0 - 0.5 || t >= T.spin0) return null;
  if (t < T.sel0) return xW;
  if (t < T.sel1) return xW + m.ent * EASE.pen(p(t, T.sel0, T.sel1));
  if (t < T.col1) return xW + m.ent * (1 - EASE.accel(p(t, T.sel1, T.col1)));
  const n = typedCount(t);
  if (t < T.type1) return xW + m.curPrefix[n];
  // Parpadeo en corcheas.
  const on = Math.floor((t - T.type1) / 3.5) % 2 === 0;
  return on ? xW + m.cur : null;
}
const typedCount = (t) => (t < T.col1 ? 0 : Math.min(10, Math.floor((t - T.col1) * 2.5 + 1e-6)));


// Primera línea con sus piezas móviles (negrita, selección, reemplazo).
function drawLine1(ctx, t, alpha) {
  const m = measures(ctx);
  const b = boldK(t);
  const y = BASE[0];
  ctx.save();
  ctx.globalAlpha *= alpha;
  const xB = PX + lerp(m.alex400, m.alex700, b);
  const xW = xB + m.mid;
  // Resaltado tibio detrás del nombre durante un beat (f245-259).
  const glow = p(t, T.alex - LEAD, T.alex + 1.5) * (1 - p(t, T.alex + 10, T.alex + 14));
  if (glow > 0.002) {
    ctx.save();
    ctx.globalAlpha *= glow;
    rr(ctx, PX - 8, y - 34, lerp(m.alex400, m.alex700, b) + 16, 46, 10);
    ctx.fillStyle = C.accentSoft;
    ctx.fill();
    ctx.restore();
  }
  // Selección sobre "entusiasmo".
  let band = 0;
  if (t >= T.sel0 && t < T.sel1) band = m.ent * EASE.pen(p(t, T.sel0, T.sel1));
  else if (t >= T.sel1 && t < T.col1) band = m.ent * (1 - EASE.accel(p(t, T.sel1, T.col1)));
  if (band > 0.5) {
    rr(ctx, xW - 3, y - 33, band + 6, 45, 6);
    ctx.fillStyle = C.accentSoft;
    ctx.fill();
  }
  drawText(ctx, "Alex", PX, y, { ...PROSE, weight: lerp(400, 700, b) }, { color: C.ink });
  drawText(ctx, " participa con ", xB, y, PROSE, { color: C.ink });
  // La palabra: "entusiasmo" hasta f268, colapsa hacia el caret, y después
  // "curiosidad" tecleada por la docente (2,5 letras por frame).
  if (t < T.sel1) drawText(ctx, "entusiasmo", xW, y, PROSE, { color: C.ink });
  else if (t < T.col1) {
    const sx = 1 - EASE.accel(p(t, T.sel1, T.col1));
    if (sx > 0.01) {
      ctx.save();
      ctx.globalAlpha *= 1 - p(t, T.sel1, T.sel1 + 1.4);
      ctx.translate(xW, 0);
      ctx.scale(sx, 1);
      drawText(ctx, "entusiasmo", 0, y, PROSE, { color: C.ink });
      ctx.restore();
    }
  } else {
    const n = typedCount(t);
    if (n > 0) drawText(ctx, "curiosidad".slice(0, n), xW, y, PROSE, { color: C.ink });
  }
  // El resto del renglón espera mientras "curiosidad" se teclea en el hueco y
  // cierra los -23 px con snap apenas entra la última letra (sin reflujo). Si
  // siguiera al borde letra por letra haría un latigazo de 200 px ida y vuelta
  // que el motion blur vuelve ilegible.
  const shift = m.shift * spr(t, T.type1 - 1, SPR.snap);
  drawText(ctx, " de las propuestas", xW + m.ent + shift, y, PROSE, { color: C.ink });
  const cx = caretAt(t, xW, m);
  if (cx !== null) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(cx - 1.5, y - 33, 3, 44);
  }
  ctx.restore();
}

// Subtítulo con sus tres estados, rodando dentro de su renglón.
const SUBS = [
  { text: "Generado hace 2 h", st: { size: 26, weight: 500 }, color: C.inkMute },
  { text: "Editando el informe", st: { size: 26, weight: 700 }, color: C.accent },
  { text: "Generado hace 2 h · editado hace 1 min", st: { size: 26, weight: 500 }, color: C.inkMute },
];
function drawSubtitle(ctx, t, alpha, intro = 0) {
  const y = 126 + intro;
  const roll = (from, to, t0) => {
    const k = EASE.glide(p(t, t0, t0 + 5));
    return [
      [from, -26 * k, 1 - p(t, t0, t0 + 2)],
      [to, 26 * (1 - k), p(t, t0 + 0.5, t0 + 3)],
    ];
  };
  let items;
  if (t < T.editar) items = [[0, 0, 1]];
  else if (t < T.save) items = roll(0, 1, T.editar);
  else items = roll(1, 2, T.save);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.rect(40, y - 30, 640, 40);
  ctx.clip();
  for (const [i, dy, a] of items) {
    if (a <= 0.002) continue;
    ctx.save();
    ctx.globalAlpha *= a;
    drawText(ctx, SUBS[i].text, 50, y + dy, SUBS[i].st, { color: SUBS[i].color });
    ctx.restore();
  }
  ctx.restore();
}

// ─── cuerpo (papel de la tarjeta) ────────────────────────────────────────────

// Oreja de la hoja (C-P2-8): el triángulo de 44 px de la esquina superior
// derecha doblado. Se despliega en el vuelo (la lectura abre el borrador).
const EAR_A = [CW - 44 * SX, 0];
const EAR_B = [CW, 44 * SY];
const EAR_C = [CW, 0];
const EAR_M = (() => {
  const d = [EAR_B[0] - EAR_A[0], EAR_B[1] - EAR_A[1]];
  const L2 = d[0] * d[0] + d[1] * d[1];
  const u = ((EAR_C[0] - EAR_A[0]) * d[0] + (EAR_C[1] - EAR_A[1]) * d[1]) / L2;
  return [EAR_A[0] + d[0] * u, EAR_A[1] + d[1] * u];
})();
const earFold = (t) => 1 - p(t, 215, 221, EASE.brake);

function bodyPath(ctx, r, fold, rTR) {
  ctx.beginPath();
  if (fold > 0.001) {
    ctx.moveTo(r, 0);
    ctx.lineTo(EAR_A[0], EAR_A[1]);
    ctx.lineTo(EAR_B[0], EAR_B[1]);
    ctx.arcTo(CW, CH, 0, CH, r);
    ctx.arcTo(0, CH, 0, 0, r);
    ctx.arcTo(0, 0, CW, 0, r);
    ctx.closePath();
  } else ctx.roundRect(0, 0, CW, CH, [r, rTR, r, r]);
}

function drawEar(ctx, fold) {
  if (fold <= 0.001) return;
  const c = Math.cos(Math.PI * fold);
  const V = [EAR_M[0] + (EAR_C[0] - EAR_M[0]) * c, EAR_M[1] + (EAR_C[1] - EAR_M[1]) * c];
  ctx.beginPath();
  ctx.moveTo(EAR_A[0], EAR_A[1]);
  ctx.lineTo(EAR_B[0], EAR_B[1]);
  ctx.lineTo(V[0], V[1]);
  ctx.closePath();
  ctx.fillStyle = c < 0 ? mix("#ffffff", C.border, -c) : "#ffffff";
  ctx.fill();
  ctx.strokeStyle = `rgba(28,25,23,${0.1 * Math.max(0, -c)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ─── contenido ───────────────────────────────────────────────────────────────

// La hoja de la pila (C-P2-8) en su espacio, sin los renglones (que se
// transforman aparte).
function sheetHeader(ctx, t, a) {
  if (a <= 0.002) return;
  const [sx, sy] = sheetScale(t);
  ctx.save();
  ctx.scale(sx, sy);
  ctx.globalAlpha *= a;
  // Ruedan hacia arriba y se van: su renglón lo toma el encabezado real.
  ctx.save();
  ctx.globalAlpha *= 1 - p(t, 219, 221.5);
  drawText(ctx, "Informe", 32, 72 - 18 * p(t, 219, 222, EASE.accel), { size: 44, weight: 800 }, { color: C.ink });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= 1 - p(t, 219.5, 222);
  drawText(ctx, "Período Medio", 32, 110 - 14 * p(t, 219.5, 222.5, EASE.accel), { size: 26, weight: 600 }, { color: C.inkMute });
  ctx.restore();
  ctx.restore();
}

// El avatar "AE" de la hoja se vuelve el botón "Editar": viaja en arco (en el
// espacio de la tarjeta) y su círculo se estira hasta la píldora, del tono de
// avatar al acento. Desde f224,5 lo reemplaza el botón real.
const AV_MORPH = [219, 224.5];
function avatarToEditar(ctx, t) {
  if (t >= AV_MORPH[1]) return;
  const [sx, sy] = sheetScale(t);
  const k = EASE.glide(p(t, AV_MORPH[0], AV_MORPH[1]));
  const d0 = 44 * Math.sqrt(sx * sy);
  const x0 = 414 * sx;
  const y0 = 56 * sy;
  const m = 1 - k;
  // Arco cuadrático con el control por encima del punto medio.
  const cx = m * m * x0 + 2 * m * k * ((x0 + 912) / 2) + k * k * 912;
  const cy = m * m * y0 + 2 * m * k * (Math.min(y0, 76) - 46) + k * k * 76;
  const w = lerp(d0, 168, k);
  const h = lerp(d0, 60, k);
  const r = lerp(d0 / 2, 16, k);
  ctx.save();
  ctx.save();
  ctx.shadowColor = `rgba(194,65,12,${0.28 * k})`;
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10 * k;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, r);
  ctx.fillStyle = mix(AV, C.accent, k);
  ctx.fill();
  ctx.restore();
  // Iniciales que se van y etiqueta que llega.
  const ia = 1 - p(t, 219.5, 221.5);
  if (ia > 0.002) {
    ctx.save();
    ctx.globalAlpha *= ia;
    const st = { size: d0 * 0.4, weight: 800, tracking: 0 };
    const cap = glyphs(ctx, "AE", st).cap;
    drawText(ctx, "AE", cx, cy + cap / 2, st, { align: "center", color: PAPER });
    ctx.restore();
  }
  const la = p(t, 222.5, 224.5);
  if (la > 0.002) {
    ctx.save();
    ctx.globalAlpha *= la;
    ctx.beginPath();
    ctx.rect(cx - w / 2, cy - h / 2, w, h);
    ctx.clip();
    button(ctx, cx - 84, cy - 30, 168, 60, "Editar", { iconName: "pencil", iconSide: "left", size: 28, r: 16 });
    ctx.restore();
  }
  ctx.restore();
}

// Renglones sólidos de la hoja que se vuelven las cuatro líneas de prosa.
function rowsMorph(ctx, t) {
  const m = measures(ctx);
  const [sx, sy] = sheetScale(t);
  for (let r = 0; r < 4; r++) {
    const t0 = 219 + 1.2 * r;
    const k = EASE.glide(p(t, t0, t0 + 6));
    const a = 1 - p(t, t0 + 2.5, t0 + 6);
    if (a <= 0.002) continue;
    const x0 = lerp(32 * sx, PX, k);
    const x1 = lerp(384 * sx, PX + m.line[r], k);
    const cy = lerp(ROW_Y[r] * sy, BASE[r] - 10, k);
    const th = lerp(10 * sy, 20, k);
    ctx.save();
    ctx.globalAlpha *= a;
    rr(ctx, x0 - th / 2, cy - th / 2, x1 - x0 + th, th, th / 2);
    ctx.fillStyle = mix(C.inkSoft, "#e7dfd1", k);
    ctx.fill();
    ctx.restore();
  }
}

// Puntos de los renglones: viajan al final de cada línea, pasan de acento a
// tinta y se funden con el texto (en la última, sobre el punto de
// "organizarse.").
function rowDots(ctx, t, F) {
  if (t >= 229) return;
  const m = measures(ctx);
  const sc = frameScale(F, CW, CH);
  const [sx, sy] = sheetScale(t);
  for (let r = 0; r < 4; r++) {
    const t0 = 219.5 + 1.2 * r;
    const k = EASE.glide(p(t, t0, t0 + 5));
    const a = 1 - p(t, t0 + 3, t0 + 6);
    if (a <= 0.002) continue;
    const end = r === 3 ? [PX + m.line[r] - 5.5, BASE[r] - 3] : [PX + m.line[r] + 9, BASE[r] - 5];
    const cx = lerp(398 * sx, end[0], k);
    const cy = lerp(ROW_Y[r] * sy, end[1], k);
    const [X, Y] = framePt(F, CW, CH, cx, cy);
    // Los tres primeros se absorben al llegar al final del renglón; el último
    // se vuelve el punto de "organizarse.".
    const d = lerp(12 * sc * Math.sqrt(sx * sy), 5.5 * sc, k) * (r < 3 ? 1 - EASE.accel(p(t, t0 + 2, t0 + 4.5)) : 1);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = mix(C.accent, C.ink, k);
    ctx.beginPath();
    ctx.arc(X, Y, d / 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function areaCard(ctx, y, h, title, a) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= a;
  rr(ctx, 30, y, 960, h, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  rr(ctx, 30, y, 960, h, 20);
  ctx.clip();
  ctx.fillStyle = PAPER;
  ctx.fillRect(30, y, 960, 76);
  ctx.fillStyle = C.border;
  ctx.fillRect(30, y + 76, 960, 1.5);
  ctx.restore();
  rr(ctx, 30.75, y + 0.75, 958.5, h - 1.5, 19.25);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText(ctx, title, 60, y + 50, { size: 32, weight: 800 }, { color: C.ink });
  ctx.restore();
}

// Contenido de la tarjeta de lectura (y edición) en su espacio.
function cardContent(ctx, t, a) {
  if (a <= 0.002) return;
  const m = measures(ctx);
  ctx.save();
  ctx.globalAlpha *= a;
  // Encabezado.
  const ta = p(t, 221, 223.5);
  if (ta > 0.002) {
    ctx.save();
    ctx.globalAlpha *= ta;
    drawText(ctx, "Alex Ejemplo", 50, 82 + 22 * (1 - EASE.glide(p(t, 221, 227))), { size: 48, weight: 800 }, { color: C.ink });
    ctx.restore();
  }
  drawSubtitle(ctx, t, p(t, 221.8, 224.5), 18 * (1 - EASE.glide(p(t, 221.8, 227.5))));
  // Botón de descarga (contorno) y "Editar".
  const sD = spr(t, 222.5, SPR.snap);
  if (sD > 0.002) {
    ctx.save();
    ctx.translate(782, 76);
    ctx.scale(sD, sD);
    rr(ctx, -30, -30, 60, 60, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    icon(ctx, "download", 0, 0, 28, { color: C.ink, width: 2.4 });
    ctx.restore();
  }
  avatarToEditar(ctx, t);
  let sE = t < AV_MORPH[1] ? 0 : 1;
  if (t >= T.editar && t < T.save) sE = 1 - EASE.brake(p(t, T.editar, T.editar + 3));
  else if (t >= T.save) sE = spr(t, T.save, SPR.snap);
  const press = t < T.editar - 2.5 ? 0 : t < T.editar ? EASE.swell(p(t, T.editar - 2.5, T.editar)) : 1 - p(t, T.editar, T.editar + 2);
  if (sE > 0.002) {
    ctx.save();
    ctx.translate(912, 76);
    ctx.scale(sE, sE);
    button(ctx, -84, -30, 168, 60, "Editar", { iconName: "pencil", iconSide: "left", size: 28, r: 16, press });
    ctx.restore();
  }
  ripple(ctx, 828, 46, 168, 60, 16, t, T.editar, { color: "#ffffff", alpha: 0.5, maxR: 140, dur: 8 });

  // Tarjetas de área.
  const aA = p(t, 221.5, 227);
  areaCard(ctx, 170, 370, "Formación Personal y Social", aA);
  areaCard(ctx, 566, 300, "Matemática", p(t, 223.5, 229));
  // Prosa del área 1: se revela por líneas enteras (nunca palabra por palabra).
  for (let r = 0; r < 4; r++) {
    const t0 = 222 + 1.2 * r;
    const la = p(t, t0, t0 + 3.5);
    if (la <= 0.002) continue;
    if (r === 0) drawLine1(ctx, t, la);
    else {
      ctx.save();
      ctx.globalAlpha *= la;
      drawText(ctx, LINES[r], PX, BASE[r], PROSE, { color: C.ink });
      ctx.restore();
    }
  }
  const a2 = p(t, 225, 229);
  if (a2 > 0.002) {
    ctx.save();
    ctx.globalAlpha *= a2;
    drawText(ctx, "Cuenta hasta diez y compara cantidades en los", PX, 706, PROSE, { color: C.ink });
    drawText(ctx, "juegos de mesa, y registra lo que", PX, 763, PROSE, { color: C.ink });
    ctx.restore();
  }
  // Fundido de abajo: el informe sigue (se scrollea).
  const g = ctx.createLinearGradient(0, 640, 0, CH);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.75, "rgba(255,255,255,0.92)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 640, CW, CH - 640);

  // "Guardar cambios": aparece al entrar en edición, se aprieta en f280,
  // Loader2 f282-286, y se va al volver a lectura.
  // Barra fija de edición: sube desde el borde de abajo y tapa la segunda
  // área (el botón vive en ella, como en un editor real).
  let fy = CH;
  if (t >= T.editar && t < T.save + 5) {
    const fk = t < T.save ? EASE.glide(p(t, T.editar, T.editar + 6)) : 1 - EASE.accel(p(t, T.save + 0.5, T.save + 4.5));
    fy = lerp(CH + 8, 672, fk);
    if (fk > 0.002) {
      ctx.save();
      ctx.shadowColor = "rgba(28,25,23,0.10)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = -8;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-2, fy, CW + 4, CH - fy + 4);
      ctx.restore();
      ctx.fillStyle = C.border;
      ctx.fillRect(0, fy, CW, 1.5);
    }
  }
  if (t >= T.editar + 1 && t < T.save + 4) {
    const sG = spr(t, T.editar + 1.5, SPR.snap);
    const aG = 1 - p(t, T.save, T.save + 3);
    const pr = t < T.guardar - 2 ? 0 : t < T.guardar ? EASE.swell(p(t, T.guardar - 2, T.guardar)) : 1 - spr(t, T.guardar, SPR.snap);
    const lbl = 1 - p(t, T.spin0 - 0.5, T.spin0 + 1);
    ctx.save();
    ctx.globalAlpha *= aG;
    ctx.translate(710 + 143, fy + 28 + 30);
    ctx.scale(sG, sG);
    ctx.translate(-143, -30);
    // Etiqueta que se funde para dejar lugar al Loader2.
    ctx.save();
    ctx.globalAlpha *= lbl;
    button(ctx, 0, 0, 286, 60, "Guardar cambios", { size: 28, r: 16, press: Math.max(0, pr) });
    ctx.restore();
    if (lbl < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - lbl;
      button(ctx, 0, 0, 286, 60, " ", { size: 28, r: 16, press: Math.max(0, pr) });
      ctx.translate(143, 30);
      ctx.rotate(((t - T.spin0) / 12) * TAU);
      icon(ctx, "loader-circle", 0, 0, 30, { color: "#ffffff", width: 2.6 });
      ctx.restore();
    }
    ripple(ctx, 0, 0, 286, 60, 16, t, T.guardar, { color: "#ffffff", alpha: 0.45, maxR: 200, dur: 9 });
    ctx.restore();
  }
  ctx.restore();
}

// ─── dibujo de la tarjeta completa ───────────────────────────────────────────
// Se llama con el ctx ya en coordenadas de mundo (cámara aplicada si corresponde).

export function drawCard(ctx, t) {
  if (t < T.warp0 || t >= T.tile) return;
  const F = cardFrame(t);
  const k20r = p(t, T.exit, T.tile, GLIDE0);
  const sc = frameScale(F, CW, CH);
  // Altura (sombra): levantada en la pila, más alta en el vuelo, apoyada al
  // llegar; en T20r baja hasta la sombra de un tile.
  let lift;
  if (t < T.warp1) {
    const k = p(t, T.warp0, WARP_END, GLIDE0);
    lift = lerp(1.5, 1, k) + 0.9 * Math.sin(Math.PI * k);
  } else lift = lerp(1, 0.45, k20r);
  const ek = editK(t);
  const fold = earFold(t);
  const rTR = 28 * p(t, 221, 224, EASE.brake);
  const r = lerp(28, 76, k20r);
  const bw = lerp(1.5, 3, ek) / sc;

  ctx.save();
  applyFrame(ctx, F, CW, CH);
  // Anillo de foco del modo edición (por fuera del borde).
  if (ek > 0.002) {
    ctx.save();
    ctx.globalAlpha *= ek;
    rr(ctx, -6, -6, CW + 12, CH + 12, r + 6);
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.accentSoft;
    ctx.stroke();
    ctx.restore();
  }
  // Sombra en dos capas (contacto + ambiente); el blur no escala con el marco.
  ctx.save();
  ctx.shadowColor = `rgba(28,25,23,${0.1})`;
  ctx.shadowBlur = 8 * lift;
  ctx.shadowOffsetY = 3 * lift;
  bodyPath(ctx, r, fold, rTR);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = `rgba(28,25,23,${0.16})`;
  ctx.shadowBlur = 48 * lift;
  ctx.shadowOffsetY = 26 * lift;
  ctx.fill();
  ctx.restore();
  bodyPath(ctx, r, fold, rTR);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Contenido recortado al papel.
  ctx.save();
  bodyPath(ctx, r, fold, rTR);
  ctx.clip();
  if (t < 226) sheetHeader(ctx, t, 1 - p(t, 219, 223));
  if (t < 228) rowsMorph(ctx, t);
  // En T20r la prosa se va apenas arranca el viaje (texto fino bajo un
  // encogimiento rápido se ve como copias apiladas, no como velocidad) y el
  // contenido del tile (avatar, renglones, tag) viaja en su lugar.
  const aCard = 1 - p(t, 294.5, 298);
  cardContent(ctx, t, aCard);
  // Contenido del tile (T20r).
  const aTile = p(t, 297, 300.5);
  if (aTile > 0.002) {
    ctx.save();
    ctx.scale(CW / TILE0.w, CH / TILE0.h);
    tileContent(ctx, "AE", alexTags(t), { alpha: aTile });
    ctx.restore();
  }
  ctx.restore();

  // Borde (grosor constante en pantalla).
  bodyPath(ctx, r, fold, rTR);
  ctx.lineWidth = bw;
  ctx.strokeStyle = mix(C.border, C.accent, ek);
  ctx.stroke();
  drawEar(ctx, fold);
  ctx.restore();

  rowDots(ctx, t, F);
}

// Posición de pantalla (antes de la cámara) de un punto del espacio de la
// tarjeta en reposo (para chequear contratos).
export const cardPoint = (x, y) => [CARD.x + x, CARD.y + y];
