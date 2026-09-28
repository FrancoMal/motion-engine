// Piezas de UI propias de S4 "Una instrucción." (tratamiento final 3.5): la
// fila punteada que se vuelve línea (KD), las bandas de inserto, la tarjeta
// del informe de Alex, las mini tarjetas y la instrucción. Todo en
// coordenadas de mundo; los estados animables se pasan ya resueltos (0..1).

import { drawText, textWidth, setType } from "../../engine/text.js";
import { clamp, lerp, mix, rgba } from "../../engine/math.js";
import { EASE } from "../../shared/system.js";
import { C, icon, checkbox } from "../../shared/ui.js";

// Verde del inserto (tokens de la app: diff insert).
export const G = { band: "#ecfccb", flash: "#d9f99d", ink: "#3f6212" };

export function rrPath(ctx, x, y, w, h, r) {
  const rr = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), rr);
}

// Sombra en dos capas + relleno de un rect redondeado. Skia no escala el blur
// de la sombra con la transformación, así que se pasa la escala de pantalla.
export function shadowFill(ctx, x, y, w, h, r, fill, { k = 1, a = 1, tint = "28,25,23", scr = 1 } = {}) {
  ctx.save();
  if (a > 0) {
    ctx.shadowColor = `rgba(${tint},${0.07 * a})`;
    ctx.shadowBlur = 6 * k * scr;
    ctx.shadowOffsetY = 2 * k * scr;
    rrPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = `rgba(${tint},${0.14 * a})`;
    ctx.shadowBlur = 44 * k * scr;
    ctx.shadowOffsetY = 22 * k * scr;
    ctx.fill();
    ctx.shadowColor = "rgba(0,0,0,0)";
  }
  rrPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// ─── KD "Punteado a continuo" ────────────────────────────────────────────────
// Fila de guiones de cabeza redonda de largo 0.1 (se ven como puntos de
// diámetro d). show 0..1 los hace aparecer de izquierda a derecha (el trim de
// entrada). Desde `solidAt` cada guion estira su largo de 0.1 a p (pitch) en
// `dur` f con `pen`, escalonados de izquierda a derecha a lo largo de
// `spread` f: los puntos se estiran hasta tocarse y la fila queda una línea.
export function dottedRow(ctx, { x0, x1, y, d, pitch, color, show = 1, t = 0, solidAt = Infinity, dur = 3.5, spread = 2.5, alpha = 1 }) {
  if (show <= 0 || alpha <= 0) return;
  const n = Math.max(2, Math.round((x1 - x0) / pitch) + 1);
  const pp = (x1 - x0) / (n - 1);
  const shown = show * n;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = d;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = clamp(shown - i);
    if (a <= 0) break;
    const xi = x0 + i * pp;
    if (a < 1) continue; // punto naciendo: va en el segundo pase
    let len = 0.1;
    if (i < n - 1 && t > solidAt) {
      const s = solidAt + (i / (n - 1)) * spread;
      len = lerp(0.1, pp, EASE.pen(clamp((t - s) / dur)));
    }
    ctx.moveTo(xi, y);
    ctx.lineTo(xi + len, y);
  }
  ctx.stroke();
  // Los puntos que nacen (trim de entrada) son círculos rellenos que crecen.
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = clamp(shown - i);
    if (a <= 0 || a >= 1) continue;
    const xi = x0 + i * pp;
    ctx.moveTo(xi + (d / 2) * a, y);
    ctx.arc(xi, y, (d / 2) * a, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

// Progreso de solidez de una fila (para el destello de las bandas).
export const flashAmt = (t, T) => (t < T ? 0 : t < T + 1 ? (t - T) : t < T + 3 ? 1 - (t - T - 1) / 2 : 0);

// ─── texto con palabra que pasa a negrita ────────────────────────────────────
// Dos diagramaciones cacheadas (reposo y negrita): la palabra se dibuja al
// peso animado y el resto del renglón se corre el delta medido, con la misma
// curva que el peso (tratamiento 2.8, "reflow real").
export function lineWithBold(ctx, text, word, x, y, style, color, k) {
  const wR = textWidth(ctx, word, style);
  const wB = textWidth(ctx, word, { ...style, weight: 700 });
  const delta = (wB - wR) * k;
  drawText(ctx, word, x, y, { ...style, weight: lerp(style.weight, 700, k) }, { color });
  drawText(ctx, text.slice(word.length), x + wR + delta, y, style, { color });
  return { wR, delta };
}

// ─── botón de acento con ícono + texto ───────────────────────────────────────
// Contenido centrado en (cx, cy); dy desplaza (para el rodillo de la etiqueta).
export function buttonLabel(ctx, label, iconName, cx, cy, { size = 28, color = "#fff", dy = 0, alpha = 1, iconProgress = 1 } = {}) {
  if (alpha <= 0) return;
  const style = { size, weight: 700, tracking: 0 };
  const tw = textWidth(ctx, label, style);
  const iw = size;
  const gap = 12;
  const x0 = cx - (tw + iw + gap) / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  icon(ctx, iconName, x0 + iw / 2, cy + dy, iw, { color, width: 2.6, progress: iconProgress });
  drawText(ctx, label, x0 + iw + gap, cy + dy + 10.5, style, { color });
  ctx.restore();
}

// Onda de toque: círculo que crece recortado a un rect redondeado.
export function ripple(ctx, rect, r, cx, cy, t, t0, { color = C.accentSoft, maxR = 320, dur = 9, a0 = 0.55 } = {}) {
  if (t < t0 || t > t0 + dur) return;
  const k = EASE.glide(clamp((t - t0) / dur));
  ctx.save();
  rrPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.clip();
  ctx.globalAlpha *= a0 * (1 - clamp((t - t0) / dur));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0.1, maxR * k), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Curva de presión de un toque: 0 → 1 en 1.5 f (brake) y vuelta con snap
// (pasa apenas de largo: el botón rebota).
export function pressCurve(t, H, spr) {
  if (t < H) return 0;
  if (t < H + 1.5) return EASE.brake((t - H) / 1.5);
  return 1 - spr(t, H + 1.5);
}

// ─── mini tarjeta de informe ─────────────────────────────────────────────────
// o: { x, y, name, bars[], insRow (0-based), insW[2], open 0..1, band {w, h}
//      bandColor, rowsShow 0..1, dots {show[2], solidAt[2]}, t, rise, alpha }
export function miniCard(ctx, o) {
  const { x, t } = o;
  const y = o.y + (o.rise ?? 0);
  const W = 190;
  const H = 300;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  shadowFill(ctx, x, y, W, H, 16, C.card, { k: 0.55, scr: o.scr ?? 1 });
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  rrPath(ctx, x + 0.75, y + 0.75, W - 1.5, H - 1.5, 15.25);
  ctx.stroke();
  checkbox(ctx, x + 12, y + 12, 20, 1);
  drawText(ctx, o.name, x + 40, y + 28, { size: 16, weight: 700 }, { color: C.ink });
  const rowTop = (k) => y + 60 + 22 * k;
  const shift = 44 * (o.open ?? 0);
  ctx.fillStyle = C.border;
  o.bars.forEach((bw, k) => {
    const yy = rowTop(k) + (k >= o.insRow ? shift : 0);
    rrPath(ctx, x + 16, yy, bw, 8, 4);
    ctx.fill();
  });
  // Inserto: banda verde con dos renglones y su subrayado punteado.
  if (o.band && o.band.w > 0.5) {
    const by = rowTop(o.insRow) - 5;
    const bx = x + 10;
    ctx.save();
    rrPath(ctx, bx, by + (43 - o.band.h) / 2, o.band.w, o.band.h, 6);
    ctx.fillStyle = o.bandColor ?? G.band;
    ctx.fill();
    ctx.clip();
    for (let j = 0; j < 2; j++) {
      const ry = rowTop(o.insRow + j);
      const a = clamp((o.rowsShow ?? 1) * 2 - j);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.fillStyle = rgba(G.ink, 0.62);
      rrPath(ctx, x + 16, ry + (1 - a) * 6, o.insW[j], 7, 3.5);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    for (let j = 0; j < 2; j++) {
      const ry = rowTop(o.insRow + j) + 13;
      dottedRow(ctx, { x0: x + 18, x1: x + 14 + o.insW[j], y: ry, d: 4, pitch: 10, color: G.ink, show: o.dots.show[j], t, solidAt: o.dots.solidAt[j], dur: 3, spread: 1.6 });
    }
  }
  ctx.restore();
}

export { C, lerp, mix, clamp, rgba, setType };
