// El punto: el actor que cruza cada costura (tratamiento final 2.9).
//
// Vuela por Béziers cúbicas re-parametrizadas por largo de arco (así la
// velocidad en pantalla la decide la curva de timing, no la forma del camino) y
// puede llegar con una velocidad final exacta, para que el siguiente movimiento
// arranque sin salto. También se transforma en rectángulos redondeados
// (casilla, avatar, tile, burbuja) interpolando geometría y color.

import { clamp, lerp, mix } from "../engine/math.js";

// ─── Bézier cúbica con largo de arco ─────────────────────────────────────────

const bezCache = new Map();
function bezTable(P0, P1, P2, P3, n = 200) {
  const key = [P0, P1, P2, P3].flat().join(",");
  let tb = bezCache.get(key);
  if (tb) return tb;
  const pts = [];
  const cum = [0];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    pts.push([
      m * m * m * P0[0] + 3 * m * m * u * P1[0] + 3 * m * u * u * P2[0] + u * u * u * P3[0],
      m * m * m * P0[1] + 3 * m * m * u * P1[1] + 3 * m * u * u * P2[1] + u * u * u * P3[1],
    ]);
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  tb = { pts, cum, L: cum[n] };
  bezCache.set(key, tb);
  return tb;
}

function atLength(tb, s) {
  const { pts, cum, L } = tb;
  s = clamp(s, 0, L);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const a = pts[lo];
  const b = pts[hi];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])];
}

// Largo de una cúbica (útil para planear velocidades).
export const bezLength = (P0, P1, P2, P3) => bezTable(P0, P1, P2, P3).L;

// Vuelo con curva de timing `ease` (0..1 → 0..1) entre t0 y t1.
// Devuelve { x, y, angle, k } (k = progreso 0..1 por largo).
export function flight(t, { t0, t1, P0, P1, P2, P3, ease = (u) => u }) {
  const tb = bezTable(P0, P1, P2, P3);
  const k = ease(clamp((t - t0) / (t1 - t0)));
  const [x, y, angle] = atLength(tb, k * tb.L);
  return { x, y, angle, k };
}

// Vuelo con velocidades de salida y llegada exactas (px/f). El progreso por
// largo es una Hermite cúbica: p(0)=0, p(1)=1, p'(0)=v0·T/L, p'(1)=v1·T/L.
// La velocidad pico sale sola de la geometría.
export function flightV(t, { t0, t1, P0, P1, P2, P3, v0 = 0, v1 = 0 }) {
  const tb = bezTable(P0, P1, P2, P3);
  const T = t1 - t0;
  const m0 = (v0 * T) / tb.L;
  const m1 = (v1 * T) / tb.L;
  let u = (t - t0) / T;
  let k;
  if (u <= 0) k = 0;
  else if (u >= 1) {
    // Después de llegar sigue a la velocidad final en la dirección de salida.
    const [x, y, ang] = atLength(tb, tb.L);
    const extra = (u - 1) * T * v1;
    return { x: x + Math.cos(ang) * extra, y: y + Math.sin(ang) * extra, angle: ang, k: 1 };
  } else {
    const u2 = u * u;
    const u3 = u2 * u;
    k = -2 * u3 + 3 * u2 + m0 * (u3 - 2 * u2 + u) + m1 * (u3 - u2);
  }
  const [x, y, angle] = atLength(tb, clamp(k, 0, 1) * tb.L);
  return { x, y, angle, k };
}

// Arco cuadrático simple entre dos puntos con el control `lift` px arriba del
// punto medio (los vuelos de pastillas, avatares y tiles).
export function arc(t, { t0, t1, from, to, lift = 120, ease = (u) => u }) {
  const u = ease(clamp((t - t0) / (t1 - t0)));
  const cx = (from[0] + to[0]) / 2;
  const cy = (from[1] + to[1]) / 2 - lift;
  const m = 1 - u;
  return {
    x: m * m * from[0] + 2 * m * u * cx + u * u * to[0],
    y: m * m * from[1] + 2 * m * u * cy + u * u * to[1],
    u,
  };
}

// ─── morph de punto a rectángulo ─────────────────────────────────────────────
// Un rect redondeado {x, y, w, h, r} (r número o [tl, tr, br, bl]) con relleno y
// borde. El punto es el caso w = h = d, r = d/2.

export const dotRect = (cx, cy, d) => ({ x: cx - d / 2, y: cy - d / 2, w: d, h: d, r: d / 2 });

export function lerpRect(a, b, k) {
  const ra = Array.isArray(a.r) ? a.r : [a.r, a.r, a.r, a.r];
  const rb = Array.isArray(b.r) ? b.r : [b.r, b.r, b.r, b.r];
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    w: lerp(a.w, b.w, k),
    h: lerp(a.h, b.h, k),
    r: ra.map((v, i) => lerp(v, rb[i], k)),
  };
}

// Dibuja un rect redondeado con relleno y/o borde (colores en hex, se mezclan en
// OKLab con `fillK` / `strokeK` cuando se pasan pares [de, a]).
export function drawRect(ctx, R, { fill = null, stroke = null, lineWidth = 0, alpha = 1 } = {}) {
  if (alpha <= 0.001 || R.w <= 0 || R.h <= 0) return;
  const r = (Array.isArray(R.r) ? R.r : [R.r, R.r, R.r, R.r]).map((v) => Math.max(0, Math.min(v, R.w / 2, R.h / 2)));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.roundRect(R.x, R.y, R.w, R.h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.beginPath();
    const h = lineWidth / 2;
    ctx.roundRect(R.x + h, R.y + h, R.w - lineWidth, R.h - lineWidth, r.map((v) => Math.max(0, v - h)));
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

// Mezcla de color con k (atajo de mix en OKLab que devuelve CSS).
export const col = (a, b, k) => (k <= 0 ? a : k >= 1 ? b : mix(a, b, k));
