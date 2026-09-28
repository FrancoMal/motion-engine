// Tipografía cinética a mano sobre Manrope variable.
//
// Dos detalles de Skia que condicionan todo esto (medidos el 2026-09-25):
//  - El peso de `ctx.font` NO mueve el eje wght de la fuente variable. El peso
//    se fija con `ctx.fontVariationSettings = '"wght" N'`, y así es continuo:
//    se puede animar de 200 a 800 sin saltos.
//  - `save()`/`restore()` NO restaura fontVariationSettings. Por eso cada
//    dibujo de texto pasa por `setType`, que fija todo de forma explícita.
//
// El layout por glifo usa el ancho medido del prefijo, así cada letra queda
// exactamente donde la pondría el shaper, con kerning incluido. Separar en
// spans sueltos perdería los pares ("Vo" se abriría).

import { GlobalFonts } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(path.join(here, "..", "assets", "fonts", "Manrope-Variable.ttf"), "Manrope");

export const FAMILY = "Manrope";

// style: { size (px), weight (200-800), tracking (em, ej. -0.03) }
export function setType(ctx, { size, weight = 400, tracking = 0 }) {
  ctx.font = `${size}px ${FAMILY}`;
  ctx.fontVariationSettings = `"wght" ${Math.round(weight * 10) / 10}`;
  ctx.letterSpacing = `${(tracking * size).toFixed(3)}px`;
}

const layoutCache = new Map();

// Layout por glifo: [{ ch, x, w }] con x relativo al inicio de la línea.
export function glyphs(ctx, text, style) {
  const key = `${style.size}|${style.weight ?? 400}|${style.tracking ?? 0}|${text}`;
  let lay = layoutCache.get(key);
  if (lay) return lay;
  setType(ctx, style);
  const chars = Array.from(text);
  const items = [];
  let prefix = "";
  let prevW = 0;
  const trackPx = (style.tracking ?? 0) * style.size;
  for (const ch of chars) {
    const x = prevW;
    prefix += ch;
    const wPrefix = ctx.measureText(prefix).width;
    items.push({ ch, x, w: wPrefix - x - trackPx });
    prevW = wPrefix;
  }
  const m = ctx.measureText("Hxg");
  lay = {
    items,
    width: prevW - trackPx,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
    cap: capHeight(ctx, style),
  };
  layoutCache.set(key, lay);
  return lay;
}

const capCache = new Map();
export function capHeight(ctx, style) {
  const key = `${style.size}|${style.weight ?? 400}`;
  let v = capCache.get(key);
  if (v === undefined) {
    setType(ctx, { ...style, tracking: 0 });
    v = ctx.measureText("H").actualBoundingBoxAscent;
    capCache.set(key, v);
  }
  return v;
}

export function textWidth(ctx, text, style) {
  return glyphs(ctx, text, style).width;
}

// Dibuja una línea. align: 'left' | 'center' | 'right'. y es la línea de base.
export function drawText(ctx, text, x, y, style, { align = "left", color = "#1c1917" } = {}) {
  const lay = glyphs(ctx, text, style);
  const ox = align === "center" ? -lay.width / 2 : align === "right" ? -lay.width : 0;
  setType(ctx, style);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(text, x + ox, y);
  return lay;
}

// Texto cinético: cada glifo con su propia transformación. fn(i, g, n) devuelve
// { dx, dy, rot, scale, sx, sy, alpha, color, weight, skew } (todo opcional).
// El pivote de cada glifo es el centro de su caja sobre la línea de base
// (pivotY en fracciones de la altura de mayúscula: 0 = base, 0.5 = medio).
export function kinetic(ctx, text, x, y, style, fn, { align = "left", color = "#1c1917", pivotY = 0.5 } = {}) {
  const lay = glyphs(ctx, text, style);
  const ox = align === "center" ? -lay.width / 2 : align === "right" ? -lay.width : 0;
  const n = lay.items.length;
  const py = -lay.cap * pivotY;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i < n; i++) {
    const g = lay.items[i];
    if (g.ch === " ") continue;
    const o = fn(i, g, n) || {};
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.001) continue;
    const cx = x + ox + g.x + g.w / 2 + (o.dx ?? 0);
    const cy = y + py + (o.dy ?? 0);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    if (o.skew) ctx.transform(1, 0, Math.tan(o.skew), 1, 0, 0);
    const sc = o.scale ?? 1;
    ctx.scale(sc * (o.sx ?? 1), sc * (o.sy ?? 1));
    setType(ctx, { ...style, weight: o.weight ?? style.weight, tracking: 0 });
    ctx.fillStyle = o.color ?? color;
    ctx.fillText(g.ch, -g.w / 2, -py);
    ctx.restore();
  }
  return lay;
}

// Palabras con su x de inicio y ancho, para animar por palabra.
export function wordLayout(ctx, text, style) {
  const lay = glyphs(ctx, text, style);
  const words = [];
  let cur = null;
  lay.items.forEach((g, i) => {
    if (g.ch === " ") {
      cur = null;
      return;
    }
    if (!cur) {
      cur = { text: "", x: g.x, w: 0, from: i };
      words.push(cur);
    }
    cur.text += g.ch;
    cur.w = g.x + g.w - cur.x;
    cur.to = i;
  });
  return { ...lay, words };
}

// Corta un texto en renglones que entren en maxWidth.
export function wrap(ctx, text, maxWidth, style) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (line && textWidth(ctx, test, style) > maxWidth) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
