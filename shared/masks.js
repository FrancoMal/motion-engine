// Máscaras de transición (tratamiento final 2.11). Las que son rellenos se usan
// con ctx.clip(); las que necesitan borde suave o trazo van por fx.masked().

import { Path2D } from "@napi-rs/canvas";
import { shapeOf, tracePortion } from "../engine/paths.js";

// Recorte circular (iris). Llamar entre save/restore.
export function clipCircle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  ctx.clip();
}

// Recorte a todo MENOS un círculo (iris inverso, con regla evenodd).
export function clipOutsideCircle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.rect(-6000, -6000, 14000, 14000);
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  ctx.clip("evenodd");
}

// Recorte a un rect redondeado.
export function clipRRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}

// Iris con borde difuso: dibuja en un ctx de máscara (fx.masked) un disco con
// gradiente radial de `feather` px. inside = true pinta el adentro.
export function featherDisc(m, cx, cy, r, feather, inside = true) {
  const r0 = Math.max(0, r - feather / 2);
  const r1 = r + feather / 2;
  const g = m.createRadialGradient(cx, cy, r0, cx, cy, Math.max(r0 + 0.1, r1));
  g.addColorStop(0, inside ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)");
  g.addColorStop(1, inside ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)");
  m.fillStyle = g;
  m.fillRect(-4000, -4000, 12000, 12000);
}

// Borde del barrido de swash (P1 TW): región a la IZQUIERDA de una polilínea
// que baja vertical, curva como el swash del logo escalado x34 y sigue vertical
// con el talón adelantado `lead` px.
export function swashEdgePath(X, { yh = 370, lead = 272, top = -4000, bottom = 6000 } = {}) {
  const p = new Path2D();
  p.moveTo(-4000, top);
  p.lineTo(X, top);
  p.lineTo(X, yh);
  // Swash M 32 40 Q 32 48, 40 50 escalado x34 desde (X, yh): el control cae
  // 8·34 = 272 abajo y el final queda 8·34 a la derecha y 10·34 abajo.
  p.quadraticCurveTo(X, yh + 272, X + lead, yh + 340);
  p.lineTo(X + lead, bottom);
  p.lineTo(-4000, bottom);
  p.closePath();
  return p;
}

// Unión de círculos como camino de recorte (T17: el texto se revela a través
// de las partículas).
export function clipUnionCircles(ctx, pts, r) {
  ctx.beginPath();
  for (const [x, y] of pts) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.clip("nonzero");
}

// Borde suave vertical para máscaras (fx.masked): pinta a la izquierda de xe
// con un degradé de `feather` px.
export function softEdgeLeft(m, xe, feather, H = 6000) {
  const g = m.createLinearGradient(xe - feather / 2, 0, xe + feather / 2, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  m.fillStyle = g;
  m.fillRect(-4000, -4000, xe + feather / 2 + 4000, H + 8000);
}

// Trazo grueso a lo largo de un path SVG como máscara (el pincel que revela).
export function brushMask(m, d, from, to, width, density = 0.5) {
  m.save();
  m.lineCap = "round";
  m.lineJoin = "round";
  m.lineWidth = width;
  m.strokeStyle = "#000";
  m.beginPath();
  tracePortion(m, shapeOf(d, density), from, to);
  m.stroke();
  m.restore();
}
