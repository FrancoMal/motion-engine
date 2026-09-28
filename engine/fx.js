// Efectos de composición: máscaras con cualquier forma, capas desenfocadas
// (profundidad de campo) y light leaks procedurales.
//
// Canvas 2D solo sabe recortar con rellenos (clip). Para enmascarar con un
// trazo grueso, un degradé o texto, la escena se dibuja en un canvas aparte y
// se combina con la máscara en modo destination-in.

import { offscreen, W, H } from "./camera.js";
import { clamp } from "./math.js";
import { env } from "./env.js";

// Dibuja `content` recortado por `mask` (lo que la máscara pinta opaco se ve).
// Ambos reciben un ctx con la MISMA transformación que tenía el ctx destino
// (cámara incluida). `key` distingue buffers si hay varias máscaras por frame.
export function masked(ctx, key, mask, content, { invert = false, alpha = 1 } = {}) {
  const m = ctx.getTransform();
  const sw = Math.round(env.outW * env.scale);
  const sh = Math.round(env.outH * env.scale);
  const A = offscreen(key + ":c", sw, sh);
  A.ctx.setTransform(m);
  content(A.ctx);
  const B = offscreen(key + ":m", sw, sh);
  B.ctx.setTransform(m);
  mask(B.ctx);
  A.ctx.setTransform(1, 0, 0, 1, 0, 0);
  A.ctx.globalCompositeOperation = invert ? "destination-out" : "destination-in";
  A.ctx.drawImage(B.canvas, 0, 0);
  A.ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(A.canvas, 0, 0);
  ctx.restore();
}

// Dibuja `content` desenfocado `blur` px (en píxeles de salida a escala 1).
// Sirve para profundidad de campo por capa y para transiciones por foco.
export function blurred(ctx, key, blur, content, { alpha = 1 } = {}) {
  if (blur < 0.35) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    content(ctx);
    ctx.restore();
    return;
  }
  const m = ctx.getTransform();
  const sw = Math.round(env.outW * env.scale);
  const sh = Math.round(env.outH * env.scale);
  const A = offscreen(key + ":b", sw, sh);
  A.ctx.setTransform(m);
  content(A.ctx);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.filter = `blur(${(blur * env.scale).toFixed(2)}px)`;
  ctx.drawImage(A.canvas, 0, 0);
  ctx.filter = "none";
  ctx.restore();
}

// Light leak procedural: manchas de luz cálida que se suman en modo screen.
// intensity 0..1. Paleta atada al ámbar (del crema al naranja del acento).
export function lightLeak(ctx, t, { intensity = 1, x = 0.8, y = 0.15, seed = 0 } = {}) {
  if (intensity <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const blobs = [
    { dx: 0, dy: 0, r: 0.75, c: [251, 146, 60], a: 0.55 },
    { dx: -0.18, dy: 0.12, r: 0.45, c: [253, 186, 116], a: 0.5 },
    { dx: 0.1, dy: -0.08, r: 0.3, c: [255, 237, 213], a: 0.6 },
  ];
  for (const [i, b] of blobs.entries()) {
    const wob = Math.sin(t * 0.07 + i * 2.1 + seed) * 0.05;
    const cx = (x + b.dx + wob) * W;
    const cy = (y + b.dy - wob * 0.6) * H;
    const r = b.r * W;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = clamp(b.a * intensity);
    g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${a})`);
    g.addColorStop(0.45, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${a * 0.35})`);
    g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-4000, -4000, 12000, 12000);
  }
  ctx.restore();
}
