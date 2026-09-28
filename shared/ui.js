// Kit de UI de Trazo Inicial redibujado para el video: mismos tokens, radios,
// bordes y jerarquías que la app real (ver capturas en app/public/landing/),
// idealizado para que respire en movimiento. Todo en coordenadas de mundo.
//
// Los estados animables (selected, checked, press, progress) son números 0..1
// para poder interpolarlos: un chip no "cambia" de estado, se inunda.

import { ICONS } from "../engine/icons-data.js";
import { shapeOf, tracePortion } from "../engine/paths.js";
import { setType, glyphs, drawText, wrap, textWidth } from "../engine/text.js";
import { clamp, lerp, mix, rgba } from "../engine/math.js";
import { C, drawMark } from "./brand.js";

// ─── primitivas ──────────────────────────────────────────────────────────────

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}

// Sombra en dos capas (contacto + ambiente), como las tarjetas de la app pero
// con un poco más de cuerpo para que las capas se lean a distintas alturas.
export function softShadow(ctx, drawShape, { lift = 1, alpha = 1, color = "28,25,23" } = {}) {
  if (lift <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.shadowColor = `rgba(${color},${0.1 * alpha})`;
  ctx.shadowBlur = 6 * lift;
  ctx.shadowOffsetY = 2 * lift;
  drawShape();
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fill();
  ctx.shadowColor = `rgba(${color},${0.16 * alpha})`;
  ctx.shadowBlur = 42 * lift;
  ctx.shadowOffsetY = 22 * lift;
  ctx.fill();
  ctx.restore();
}

// Tarjeta blanca con borde y sombra.
export function card(ctx, x, y, w, h, { r = 22, fill = C.card, border = C.border, lift = 1, alpha = 1, borderWidth = 1.5 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (lift > 0) {
    // La sombra se dibuja con la forma rellena y después se tapa con la
    // tarjeta: así el borde no se ensucia.
    ctx.save();
    ctx.shadowColor = "rgba(28,25,23,0.10)";
    ctx.shadowBlur = 8 * lift;
    ctx.shadowOffsetY = 3 * lift;
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "rgba(28,25,23,0.13)";
    ctx.shadowBlur = 48 * lift;
    ctx.shadowOffsetY = 26 * lift;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    rr(ctx, x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth, r - borderWidth / 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Ícono de lucide. progress < 1 dibuja el trazo parcial (se "escribe").
export function icon(ctx, name, cx, cy, size, { color = C.ink, width = 2, progress = 1, alpha = 1, fill = null } = {}) {
  const ds = ICONS[name];
  if (!ds || progress <= 0 || alpha <= 0) return;
  const k = size / 24;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  const dens = Math.max(1, k * 1.5);
  for (const d of ds) {
    ctx.beginPath();
    if (progress >= 1) {
      const sh = shapeOf(d, dens);
      for (const sub of sh.subs) {
        const P = sub.points;
        ctx.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
        if (sub.closed) ctx.closePath();
      }
    } else tracePortion(ctx, shapeOf(d, dens), 0, progress);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ─── piezas de la app ────────────────────────────────────────────────────────

// Avatar con iniciales (como "AE", "JE" en el formulario).
export function avatar(ctx, cx, cy, r, initials, { bg = C.accent, color = "#fff", ring = null, ringWidth = 3, alpha = 1, scale = 1 } = {}) {
  if (scale <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (ring) {
    ctx.beginPath();
    ctx.arc(0, 0, r + ringWidth, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const style = { size: r * 0.72, weight: 700, tracking: -0.01 };
  const lay = glyphs(ctx, initials, style);
  drawText(ctx, initials, 0, lay.cap / 2, style, { align: "center", color });
  ctx.restore();
}

// Chip de sugerencia. selected 0..1 inunda el fondo con accent-soft y vira el
// borde y el texto; check 0..1 dibuja el tilde. Devuelve { w, h }.
export function chip(ctx, x, y, text, { size = 26, selected = 0, check = selected, maxWidth = 900, padX = 26, padY = 18, weight = 500, alpha = 1, dotted = false } = {}) {
  const style = { size, weight: lerp(weight, 600, selected), tracking: -0.005 };
  const lines = wrap(ctx, text, maxWidth - padX * 2 - (check > 0 ? size * 1.3 : 0), style);
  const lh = size * 1.32;
  const tw = Math.max(...lines.map((l) => textWidth(ctx, l, style)));
  const iconW = check > 0 || selected > 0 ? size * 1.3 : 0;
  const w = tw + padX * 2 + iconW;
  const h = lines.length * lh + padY * 2 - (lh - size);
  const r = Math.min(h / 2, size * 1.1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = mix("#fbf8f3", C.accentSoft, selected);
  ctx.fill();
  ctx.lineWidth = lerp(1.5, 2.5, selected);
  ctx.strokeStyle = mix(C.border, C.accent, selected);
  if (dotted) ctx.setLineDash([2, 6]);
  rr(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.stroke();
  ctx.setLineDash([]);
  const color = mix(C.inkSoft, C.accentInk, selected);
  let tx = x + padX;
  if (iconW) {
    icon(ctx, "check", tx + size * 0.45, y + padY + size * 0.42, size * 0.95, { color: C.accent, width: 2.6, progress: check });
    tx += iconW;
  }
  lines.forEach((l, i) => drawText(ctx, l, tx, y + padY + size * 0.8 + i * lh, style, { color }));
  ctx.restore();
  return { w, h };
}

// Botón. variant: 'accent' | 'outline' | 'dark' | 'success'. press 0..1 lo hunde.
export function button(ctx, x, y, w, h, label, { variant = "accent", iconName = null, iconSide = "right", press = 0, alpha = 1, size = 28, r = null } = {}) {
  const bg = variant === "accent" ? C.accent : variant === "dark" ? C.ink : variant === "success" ? C.success : C.card;
  const fg = variant === "outline" ? C.ink : "#fff";
  const s = 1 - 0.05 * press;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
  const rad = r ?? h * 0.36;
  if (variant !== "outline") {
    ctx.save();
    ctx.shadowColor = rgba(variant === "accent" ? C.accent : C.ink, 0.28 * (1 - press));
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10 * (1 - press);
    rr(ctx, 0, 0, w, h, rad);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, 0, 0, w, h, rad);
  ctx.fillStyle = bg;
  ctx.fill();
  if (variant === "outline") {
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const style = { size, weight: 700, tracking: -0.01 };
  const tw = textWidth(ctx, label, style);
  const iw = iconName ? size * 1.1 : 0;
  const total = tw + (iconName ? iw + size * 0.4 : 0);
  let tx = (w - total) / 2;
  const cy = h / 2;
  if (iconName && iconSide === "left") {
    icon(ctx, iconName, tx + iw / 2, cy, iw, { color: fg, width: 2.4 });
    tx += iw + size * 0.4;
  }
  const cap = glyphs(ctx, label, style).cap;
  drawText(ctx, label, tx, cy + cap / 2, style, { color: fg });
  if (iconName && iconSide === "right") icon(ctx, iconName, tx + tw + size * 0.4 + iw / 2, cy, iw, { color: fg, width: 2.4 });
  ctx.restore();
}

// Tag chico ("listo", "EN CURSO"). tone: success | accent | mute | info.
export function tag(ctx, x, y, text, { tone = "success", size = 20, alpha = 1, scale = 1, upper = false } = {}) {
  const [bg, fg] = {
    success: [C.successSoft, C.success],
    accent: [C.accentSoft, C.accentInk],
    mute: ["#f1ece3", C.inkSoft],
    info: [C.infoSoft, C.info],
  }[tone];
  const label = upper ? text.toUpperCase() : text;
  const style = { size, weight: 700, tracking: upper ? 0.08 : 0 };
  const tw = textWidth(ctx, label, style);
  const h = size * 1.7;
  const w = tw + size * 1.2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const cap = glyphs(ctx, label, style).cap;
  drawText(ctx, label, -tw / 2, cap / 2, style, { color: fg });
  ctx.restore();
  return { w, h };
}

// Checkbox cuadrado con el tilde que se dibuja.
export function checkbox(ctx, x, y, s, checked = 0, { alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, x, y, s, s, s * 0.26);
  ctx.fillStyle = mix(C.card, C.accent, clamp(checked * 1.6));
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = mix(C.borderStrong, C.accent, clamp(checked * 1.6));
  ctx.stroke();
  if (checked > 0) icon(ctx, "check", x + s / 2, y + s / 2, s * 0.78, { color: "#fff", width: 3.2, progress: clamp(checked * 1.4 - 0.25) });
  ctx.restore();
}

// Barra de progreso con extremo redondeado.
export function progressBar(ctx, x, y, w, h, p, { color = C.accent, track = "#efe8dc", glow = 0 } = {}) {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = track;
  ctx.fill();
  const pw = Math.max(0, Math.min(1, p)) * w;
  if (pw <= 0.5) return;
  ctx.save();
  if (glow > 0) {
    ctx.shadowColor = rgba(color, 0.55 * glow);
    ctx.shadowBlur = 18;
  }
  rr(ctx, x, y, Math.max(h, pw), h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Párrafo con ajuste de línea. highlight: palabras que van en negrita (el nombre
// del alumno, como NombreResaltado en la vista de lectura). lineFn(i, n)
// devuelve { alpha, dy, clip } por renglón para revelar por máscaras.
export function paragraph(ctx, text, x, y, maxW, style, { color = C.ink, lineHeight = 1.5, highlight = [], hlColor = null, lineFn = null } = {}) {
  const lines = wrap(ctx, text, maxW, style);
  const lh = style.size * lineHeight;
  lines.forEach((line, i) => {
    const o = lineFn ? lineFn(i, lines.length) : {};
    if ((o.alpha ?? 1) <= 0) return;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    const by = y + i * lh + (o.dy ?? 0);
    if (o.clip !== undefined) {
      ctx.beginPath();
      ctx.rect(x - 4, by - style.size * 1.1, (maxW + 8) * o.clip, lh + 4);
      ctx.clip();
    }
    // Negritas: se dibuja palabra por palabra solo si hay algo que resaltar.
    if (highlight.length && highlight.some((h) => line.includes(h))) {
      const words = line.split(" ");
      let cx = x;
      for (const wd of words) {
        const clean = wd.replace(/[.,;:]$/, "");
        const bold = highlight.includes(clean);
        const st = bold ? { ...style, weight: 780 } : style;
        drawText(ctx, wd, cx, by, st, { color: bold ? hlColor ?? color : color });
        cx += textWidth(ctx, wd + " ", st);
      }
    } else drawText(ctx, line, x, by, style, { color });
    ctx.restore();
  });
  return { lines: lines.length, height: lines.length * lh };
}

// Ícono de la app (PWA): papel redondeado con el símbolo.
export function appIcon(ctx, cx, cy, size, { alpha = 1, markProgress = {} } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const r = size * 0.1875;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.04;
  rr(ctx, cx - size / 2, cy - size / 2, size, size, r);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();
  drawMark(ctx, cx, cy, size * 0.625, markProgress);
  ctx.restore();
}

// Teléfono genérico (Android, sin marca). drawScreen(ctx, w, h) dibuja la
// pantalla en coordenadas locales (0,0)-(w,h), ya recortada.
export function phone(ctx, x, y, w, h, drawScreen, { bezel = 14, r = 64, body = "#1b1917", alpha = 1, lift = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (lift > 0) {
    ctx.save();
    ctx.shadowColor = "rgba(28,25,23,0.28)";
    ctx.shadowBlur = 70 * lift;
    ctx.shadowOffsetY = 36 * lift;
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = body;
  ctx.fill();
  // Filo lateral más claro.
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
  ctx.stroke();
  const sx = x + bezel;
  const sy = y + bezel;
  const sw = w - bezel * 2;
  const sh = h - bezel * 2;
  ctx.save();
  rr(ctx, sx, sy, sw, sh, r - bezel);
  ctx.clip();
  ctx.translate(sx, sy);
  drawScreen(ctx, sw, sh);
  ctx.restore();
  // Cámara perforada.
  ctx.beginPath();
  ctx.arc(x + w / 2, sy + 26, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#0c0a09";
  ctx.fill();
  ctx.restore();
}

// Notificación estilo Android. drop 0..1 la baja desde arriba con overshoot
// controlado desde afuera (pasar ya el valor con easing).
export function notification(ctx, x, y, w, { title = "Trazo Inicial", body = "", time = "ahora", alpha = 1, dark = false } = {}) {
  const bodyLines = wrap(ctx, body, w - 140, { size: 28, weight: 500 }).length;
  const h = 112 + bodyLines * 36.4;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  rr(ctx, x, y, w, h, 34);
  ctx.fillStyle = dark ? "#2a2522" : "#fdfbf7";
  ctx.fill();
  ctx.restore();
  appIcon(ctx, x + 58, y + 58, 58);
  const ink = dark ? C.dInk : C.ink;
  const soft = dark ? C.dInkSoft : C.inkSoft;
  drawText(ctx, title, x + 104, y + 52, { size: 26, weight: 700 }, { color: ink });
  drawText(ctx, "· " + time, x + 104 + textWidth(ctx, title, { size: 26, weight: 700 }) + 10, y + 52, { size: 24, weight: 500 }, { color: soft });
  paragraph(ctx, body, x + 104, y + 96, w - 140, { size: 28, weight: 500 }, { color: ink, lineHeight: 1.3 });
  ctx.restore();
  return { h };
}

export { C };
