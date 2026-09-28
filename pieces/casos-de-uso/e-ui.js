// Escena E, piezas de UI propias: marcos afines (la tarjeta que vuela es un
// paralelogramo), avatar de la app, tag de estado, tile del Resumen y botones.
// Todo en coordenadas locales; quien llama pone la transformación.

import { C } from "../../shared/brand.js";
import { rr, icon } from "../../shared/ui.js";
import { drawText, glyphs, textWidth } from "../../engine/text.js";
import { clamp, lerp, mix, TAU } from "../../engine/math.js";

export const AV = "#7c2d12"; // tono real de los avatares de la app
export const PAPER = "#faf6ef";
export const BAR = "#e7dfd1";

// ─── marcos afines ───────────────────────────────────────────────────────────
// Un marco es { O, U, V }: el espacio local (0..sw, 0..sh) va al paralelogramo
// O + x/sw·U + y/sh·V. Interpolar dos marcos afines da otro marco afín, así la
// hoja inclinada de la pila se "desinclina" sin mesh warp y el texto queda
// vectorial (nítido) en todo el vuelo.

export function para(cx, cy, w, h, shearX = 0, rot = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const U = [w * c, w * s];
  const V = [shearX * c - h * s, shearX * s + h * c];
  return { O: [cx - U[0] / 2 - V[0] / 2, cy - U[1] / 2 - V[1] / 2], U, V };
}

export function applyFrame(ctx, F, sw, sh) {
  ctx.transform(F.U[0] / sw, F.U[1] / sw, F.V[0] / sh, F.V[1] / sh, F.O[0], F.O[1]);
}

export function framePt(F, sw, sh, x, y) {
  return [F.O[0] + (x / sw) * F.U[0] + (y / sh) * F.V[0], F.O[1] + (x / sw) * F.U[1] + (y / sh) * F.V[1]];
}

// Escala de pantalla media de un marco para un espacio local dado.
export const frameScale = (F, sw, sh) => Math.sqrt((Math.hypot(F.U[0], F.U[1]) / sw) * (Math.hypot(F.V[0], F.V[1]) / sh));

// ─── piezas ──────────────────────────────────────────────────────────────────

// Avatar de la app: círculo #7c2d12, iniciales #faf6ef w800 a 0,4 del diámetro.
export function avatarX(ctx, cx, cy, d, initials, { alpha = 1, scale = 1 } = {}) {
  if (alpha <= 0.002 || scale <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, d / 2, 0, TAU);
  ctx.fillStyle = AV;
  ctx.fill();
  const st = { size: d * 0.4, weight: 800, tracking: 0 };
  const cap = glyphs(ctx, initials, st).cap;
  drawText(ctx, initials, 0, cap / 2, st, { align: "center", color: PAPER });
  ctx.restore();
}

// Tag de estado del Resumen, alineado a la derecha en xr. kind: listo | editado.
export const TAG = {
  listo: { text: "Listo", bg: C.successSoft, fg: C.success },
  editado: { text: "Editado", bg: C.infoSoft, fg: C.info },
};
const TAG_ST = { size: 16, weight: 700, tracking: 0 };
export function tagWidth(ctx, kind) {
  return Math.round(textWidth(ctx, TAG[kind].text, TAG_ST) + 26);
}
export function tagPill(ctx, xr, y, kind, { alpha = 1, sx = 1, sy = 1 } = {}) {
  if (alpha <= 0.002 || sx <= 0.002 || sy <= 0.002) return;
  const k = TAG[kind];
  const w = tagWidth(ctx, kind);
  const h = 28;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(xr - w / 2, y + h / 2);
  ctx.scale(sx, sy);
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = k.bg;
  ctx.fill();
  const cap = glyphs(ctx, k.text, TAG_ST).cap;
  drawText(ctx, k.text, 0, cap / 2, TAG_ST, { align: "center", color: k.fg });
  ctx.restore();
}

// Cara del tile del Resumen (180 x 150, radio 14) con su sombra corta.
export const TW = 180;
export const TH = 150;
export function tileBody(ctx, { alpha = 1, lift = 0.45, fill = "#ffffff", border = C.border, bw = 1.5, r = 14, w = TW, h = TH } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (lift > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(28,25,23,${0.07 * lift})`;
    ctx.shadowBlur = 6 * lift;
    ctx.shadowOffsetY = 2 * lift;
    rr(ctx, 0, 0, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = `rgba(28,25,23,${0.12 * lift})`;
    ctx.shadowBlur = 30 * lift;
    ctx.shadowOffsetY = 16 * lift;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, 0, 0, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (bw > 0) {
    rr(ctx, bw / 2, bw / 2, w - bw, h - bw, r - bw / 2);
    ctx.strokeStyle = border;
    ctx.lineWidth = bw;
    ctx.stroke();
  }
  ctx.restore();
}

// Contenido del tile: avatar 34, tres renglones de prosa y el tag.
// tag: { kind, alpha, sx, sy } o una lista de dos (el viejo y el nuevo).
export function tileContent(ctx, initials, tags = [{ kind: "listo" }], { alpha = 1 } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  avatarX(ctx, 14 + 17, 14 + 17, 34, initials);
  ctx.fillStyle = BAR;
  for (const [y, w] of [
    [70, 150],
    [92, 140],
    [114, 110],
  ]) {
    rr(ctx, 14, y, w, 8, 4);
    ctx.fill();
  }
  for (const tg of tags) tagPill(ctx, TW - 14, 14, tg.kind, tg);
  ctx.restore();
}

// Botón de contorno de acento (Descargar carpeta): borde 2 px, ícono y texto
// en #c2410c. flood 0..1 lo inunda de acento (y el contenido se va).
export function outlineAccentButton(ctx, x, y, w, h, label, iconName, { press = 0, alpha = 1, r = 14, size = 26, contentAlpha = 1, flood = 0, body = true } = {}) {
  if (alpha <= 0.002) return;
  const s = 1 - 0.06 * press;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
  if (body) {
    rr(ctx, 0, 0, w, h, r);
    ctx.fillStyle = mix("#ffffff", C.accent, clamp(flood));
    ctx.fill();
    rr(ctx, 1, 1, w - 2, h - 2, r - 1);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (contentAlpha > 0.002) {
    ctx.globalAlpha *= contentAlpha;
    const fg = mix(C.accent, "#ffffff", clamp(flood));
    const st = { size, weight: 700, tracking: 0 };
    const tw = textWidth(ctx, label, st);
    const iw = size * 1.1;
    const gap = size * 0.4;
    const total = iw + gap + tw;
    const x0 = (w - total) / 2;
    const cap = glyphs(ctx, label, st).cap;
    icon(ctx, iconName, x0 + iw / 2, h / 2, iw, { color: fg, width: 2.4 });
    drawText(ctx, label, x0 + iw + gap, h / 2 + cap / 2, st, { color: fg });
  }
  ctx.restore();
}

// Onda de toque (ripple) recortada al botón.
export function ripple(ctx, x, y, w, h, r, t, H, { color = C.accentSoft, maxR = 260, dur = 10, alpha = 0.7 } = {}) {
  if (t < H || t > H + dur) return;
  const k = clamp((t - H) / dur);
  const e = 1 - Math.pow(1 - k, 3);
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.globalAlpha *= alpha * (1 - k);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, lerp(0, maxR, e), 0, TAU);
  ctx.fill();
  ctx.restore();
}
