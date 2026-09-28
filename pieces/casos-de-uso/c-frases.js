// Escenas C y D: las dos frases de la columna (tratamiento final 2.3 KR, 4.4 y
// 4.5). Capa de pantalla: quietas de R a L aunque el mundo haga dolly, punch o
// cámara en mano.
//
//   "Los informes" / "del finde."   KT en f112 y f115,5, punto en f119, R f120
//                                    sube 420 px por la máscara en f160 (KR)
//   "El borrador" / "ya está."      KR: contacto en f168 y f175, entinta 200 a
//                                    760 en 4 f, R f177; onda de peso en f182;
//                                    anillos en f196 y f210; K5 desde f218
//
// Máscara de columna (C-P2-7): x 100-1180, y 250-760. Nunca hay dos frases
// legibles a la vez: la que sale y la que entra ruedan como un carrete.

import { IS_V } from "../../engine/format.js";
import { makePhrase, drawPhrase, tinta, carrete, evaporar, inhala, bumps, glyphsStill } from "../../shared/phrase.js";
import { EASE, SPR, spr, ring } from "../../shared/system.js";
import { emit, env } from "../../engine/env.js";
import { clamp, lerp } from "../../engine/math.js";
import { impulse } from "./c-hoja.js";

// En vertical las frases van ARRIBA de la pila, centradas con ella (x ~1464).
export const MASK = IS_V ? { x0: 926, x1: 2006, y0: -260, y1: 250 } : { x0: 100, x1: 1180, y0: 250, y1: 760 };
const D = 420;
const INK_N = "#f5f1ea"; // tinta sobre Noche (2.8)
const DOT_N = "#fb923c"; // punto sobre Noche
const INK_P = "#1c1917"; // sobre el papel de e-ajustas (K7)
const DOT_P = "#c2410c";

const base = { size: 180, wght: 760, tracking: -0.045, x: IS_V ? 946 : 120, color: INK_N, periodColor: DOT_N };
const B1 = IS_V ? -40 : 470;
const B2 = IS_V ? 140 : 650;
export const C1 = makePhrase({ text: "Los informes", baseline: B1, ...base });
export const C2 = makePhrase({ text: "del finde.", baseline: B2, ...base });
export const D1 = makePhrase({ text: "El borrador", baseline: B1, ...base });
export const D2 = makePhrase({ text: "ya está.", baseline: B2, ...base });

// ─── tiempos ─────────────────────────────────────────────────────────────────
const C_H1 = 112;
const C_H2 = 115.5;
const C_DOT = 119;
const C_OUT = 160;
const D_IN1 = 168;
const D_IN2 = 175;
const D_WAVE = 182;
const D_RINGS = [196, 210];
const D_OUT = 218;
// K5 comprimido: la capa de pantalla se apaga en f224 (topEnd) y el derrame de
// papel de e-ajustas llega a la columna hacia f222, así que los dos renglones
// se evaporan a la vez con 0,3 f de stagger y 3,2 f por glifo: todo termina
// antes de f223,2.
const EVAP = { stagger: 0.3, dur: 3.2 };

// Carrete de salida: la frase sube D px y se va por arriba de la máscara.
const rollOutDy = (t, tOut) => (t > tOut ? -D * EASE.lunge(clamp((t - tOut) / 8)) : 0);
const rollOut = (tOut) => (t, g, st) => {
  st.clip = MASK;
  st.dy += rollOutDy(t, tOut);
};
// Mismo recorrido de entrada que el preset `carrete`, para el punto.
const rollInDy = (t, tIn) => (t < tIn ? lerp(D, 0, EASE.lunge(clamp((t - (tIn - 8)) / 8))) : 0);

// En el pico del lunge el carrete recorre ~130 px/f. Con 12 sub-frames de
// obturador quedaban saltos de ~8 px que en los trazos finos (wght 200) se
// veían como persiana; por eso motion() de la escena pide 32 sub-frames entre
// f159 y f177 (~3 px entre muestras): la estela sale continua.

// K8 con cuerpo: el bulto de tinta viaja por los glifos y los levanta 3 px con
// un 1 % de escala. Queda dentro de la regla de lectura (menos de 2 px/f y
// escala a menos de 1,2 %).
const ondaTinta = (t0) => (t, g, st) => {
  const e = Math.exp(-(((t - t0 - 0.5 * g.i) / 2) ** 2));
  st.wAdd += 90 * e;
  st.scale *= 1 + 0.01 * e;
  st.dy -= 3 * e;
};

// ─── programas por renglón ───────────────────────────────────────────────────
const outC = (t) => rollOutDy(t, C_OUT);
const inD2 = (t) => rollInDy(t, D_IN2);
export const PROG = {
  C1: [rollOut(C_OUT), tinta(C_H1, { stagger: 0.6 }), inhala(156, C_OUT, 700), bumps([154], 50)],
  C2: [rollOut(C_OUT), tinta(C_H2, { stagger: 0.6 }), inhala(156, C_OUT, 700), bumps([154], 50)],
  D1: [carrete({ mask: MASK, D, tIn: D_IN1 }), ondaTinta(D_WAVE), evaporar(D_OUT, EVAP)],
  D2: [carrete({ mask: MASK, D, tIn: D_IN2 }), ondaTinta(D_WAVE + 0.5 * D1.n), evaporar(D_OUT, EVAP)],
};

// ─── puntos ──────────────────────────────────────────────────────────────────
function periodC(t) {
  const p = C2.period;
  if (t < C_DOT) return null;
  // Aterriza con slam desde 1,7 (ya en movimiento) y recibe un golpe en f154.
  let s = lerp(1.7, 1, spr(t, C_DOT, SPR.slam));
  s += 0.3 * impulse(t, 154, SPR.slam);
  return { x: p.cx, y: p.cy + outC(t), d: p.d, s, rings: [C_DOT, 126], a: 1 };
}

function periodD(t) {
  const p = D2.period;
  if (t < D_IN2 - 8) return null;
  let s = 1 + 0.45 * impulse(t, D_IN2, SPR.slam);
  // Sale con el renglón (K5): el punto es el último de la fila.
  const x0 = D_OUT + D2.n * EVAP.stagger;
  let a = 1;
  let dx = 0;
  let dy = inD2(t);
  if (t > x0) {
    const k = EASE.accel(clamp((t - x0) / EVAP.dur));
    a = 1 - k;
    s *= 1 - 0.5 * k;
    dx = 0.3 * D2.size * k;
    dy -= 14 * k;
  }
  return { x: p.cx + dx, y: p.cy + dy, d: p.d, s, rings: [D_IN2, ...D_RINGS], a };
}

function dotS(ctx, P, color, grow = 1) {
  ctx.save();
  ctx.globalAlpha *= P.a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(P.x, P.y, (P.d / 2) * P.s * grow, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeriod(ctx, t, P, color) {
  if (!P || P.a <= 0.002 || P.s <= 0.002) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(MASK.x0, MASK.y0, MASK.x1 - MASK.x0, MASK.y1 - MASK.y0);
  ctx.clip();
  dotS(ctx, P, color);
  for (const H of P.rings) ring(ctx, t, H, P.x, P.y, P.d, color);
  // Los puntos sobre Noche son emisivos (2.7).
  if (color === DOT_N) {
    emit(ctx, (e) => {
      e.beginPath();
      e.rect(MASK.x0, MASK.y0, MASK.x1 - MASK.x0, MASK.y1 - MASK.y0);
      e.clip();
      dotS(e, P, "#fb923c", 1.15);
    });
  }
  ctx.restore();
}

// ─── K7 contra el papel de e-ajustas ─────────────────────────────────────────
// Desde f214 la hoja de arriba es la tarjeta de lectura de e-ajustas y desde
// f218 su derrame de papel crece hacia la columna. Donde hay papel, la frase
// que se evapora se dibuja en tinta #1c1917 con el punto #c2410c; afuera sigue
// crema sobre la noche. La geometría se lee de e-lectura.js (cardFrame, spillAt;
// la cámara de E es la identidad hasta f228). Si ese módulo no carga, se usa
// env.shared.paperSpill ({x, y, w, h, r} en pantalla) si alguien lo publica, y
// si no, la frase solo se evapora.
let EL = null;
try {
  EL = await import("./e-lectura.js");
  if (typeof EL.cardFrame !== "function" || typeof EL.spillAt !== "function") EL = null;
} catch {
  EL = null;
}

function paperPath(ctx, t) {
  ctx.beginPath();
  if (EL && t >= 214) {
    const F = EL.cardFrame(t);
    const [ox, oy] = F.O;
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + F.U[0], oy + F.U[1]);
    ctx.lineTo(ox + F.U[0] + F.V[0], oy + F.U[1] + F.V[1]);
    ctx.lineTo(ox + F.V[0], oy + F.V[1]);
    ctx.closePath();
    const s = EL.spillAt(t);
    if (s) ctx.roundRect(s.x, s.y, s.w, s.h, Math.min(s.r, s.w / 2, s.h / 2));
    return true;
  }
  const sp = env.shared && env.shared.paperSpill;
  if (sp) {
    ctx.roundRect(sp.x, sp.y, sp.w, sp.h, sp.r ?? 0);
    return true;
  }
  return false;
}

function withPaper(ctx, t, fn) {
  fn(false);
  ctx.save();
  if (paperPath(ctx, t)) {
    ctx.clip();
    fn(true);
  }
  ctx.restore();
}

// ─── dibujo ──────────────────────────────────────────────────────────────────
export function drawFrases(ctx, t) {
  if (t >= C_H1 - 4.5 && t < C_OUT + 9) {
    drawPhrase(ctx, C1, t, PROG.C1);
    drawPhrase(ctx, C2, t, PROG.C2);
    drawPeriod(ctx, t, periodC(t), DOT_N);
  }
  if (t >= D_IN1 - 8.5 && t < D_OUT + 7) {
    withPaper(ctx, t, (paper) => {
      const o = paper ? { colorOverride: INK_P } : {};
      drawPhrase(ctx, D1, t, PROG.D1, o);
      drawPhrase(ctx, D2, t, PROG.D2, o);
      drawPeriod(ctx, t, periodD(t), paper ? DOT_P : DOT_N);
    });
  }
}

// ─── lectura (E9) ────────────────────────────────────────────────────────────
// R = primer frame con todos los glifos de los dos renglones quietos, enteros y
// a peso de reposo; L = primer frame después de R en que deja de serlo.
export function measureRL(lines, from, to, step = 0.25) {
  const still = (t) => lines.every(([ph, prog]) => glyphsStill(ph, t, prog));
  let R = null;
  for (let t = from; t <= to; t += step) {
    if (still(t)) {
      R = t;
      break;
    }
  }
  if (R === null) return { R: null, L: null };
  let L = null;
  for (let t = R; t <= to; t += step) {
    if (!still(t)) {
      L = t;
      break;
    }
  }
  return { R, L };
}
