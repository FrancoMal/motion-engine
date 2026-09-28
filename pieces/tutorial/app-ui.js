// Interfaz de la app redibujada en píxeles CSS, con las medidas reales de los
// componentes (app/src/components/ui/btn.tsx, tag.tsx, avatar-natalia.tsx,
// layout/desktop-sidebar.tsx y desktop-topbar.tsx). El tutorial la muestra
// literal: mismos textos, mismos tamaños, mismos colores de la paleta ámbar.
//
// Todo se dibuja en el "espacio de la app" (px CSS de una ventana de escritorio)
// y la cámara del tutorial lo lleva a pantalla. Cada pieza devuelve su rect para
// que el guion sepa dónde apuntar el cursor.

import { createCanvas } from "@napi-rs/canvas";
import { C, drawMark } from "../../shared/brand.js";
import { rr, icon } from "../../shared/ui.js";
import { drawText, textWidth } from "../../engine/text.js";
import { clamp, lerp, mix } from "../../engine/math.js";

const MC = createCanvas(8, 8).getContext("2d");

// Medida de texto (Manrope, la tipografía de la app).
export const tw = (text, size, weight = 400) => textWidth(MC, text, { size, weight, tracking: 0 });

export function txt(ctx, text, x, y, size, weight = 400, color = C.ink, align = "left", tracking = 0) {
  return drawText(ctx, text, x, y, { size, weight, tracking }, { color, align });
}

// Línea de base para centrar un texto de tamaño s en una caja [y, y + h].
export const mid = (y, h, s) => y + h / 2 + s * 0.36;

export const rect = (x, y, w, h) => ({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });

function fillRR(ctx, x, y, w, h, r, fill, stroke = null, lw = 1) {
  rr(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    rr(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
export { fillRR };

// ─── botón (Btn) ─────────────────────────────────────────────────────────────
const BTN = {
  sm: { h: 36, px: 14, fs: 13, r: 10, ic: 14 },
  md: { h: 46, px: 18, fs: 14, r: 12, ic: 16 },
  lg: { h: 54, px: 22, fs: 15, r: 12, ic: 16 },
};

export function btnWidth(label, { size = "md", icon: ic = null, iconRight = null } = {}) {
  const S = BTN[size];
  const icons = (ic ? S.ic + 8 : 0) + (iconRight ? S.ic + 8 : 0);
  return S.px * 2 + tw(label, S.fs, 600) + icons;
}

// variant: primary | secondary | ghost | quiet. press 0..1 (active:scale 0.98).
// spin: el ícono es un Loader2 girando (ángulo en radianes).
export function btn(ctx, x, y, label, { size = "md", variant = "primary", icon: ic = null, iconRight = null, w = null, press = 0, disabled = false, spin = null, alpha = 1 } = {}) {
  const S = BTN[size];
  const bw = w ?? btnWidth(label, { size, icon: ic, iconRight });
  const R = rect(x, y, bw, S.h);
  ctx.save();
  ctx.globalAlpha *= alpha * (disabled ? 0.5 : 1);
  const s = 1 - 0.02 * press;
  ctx.translate(R.cx, R.cy);
  ctx.scale(s, s);
  ctx.translate(-R.cx, -R.cy);
  let fg = C.ink;
  if (variant === "primary") {
    fillRR(ctx, x, y, bw, S.h, S.r, press > 0 ? mix(C.accent, "#9a3412", 0.25 * press) : C.accent);
    fg = "#ffffff";
  } else if (variant === "secondary") fillRR(ctx, x, y, bw, S.h, S.r, "#ffffff", C.borderStrong, 1);
  else if (variant === "quiet") {
    fillRR(ctx, x, y, bw, S.h, S.r, C.accentSoft);
    fg = C.accentInk;
  }
  const lw = tw(label, S.fs, 600);
  const total = lw + (ic ? S.ic + 8 : 0) + (iconRight ? S.ic + 8 : 0);
  let cx = R.cx - total / 2;
  if (ic) {
    if (spin !== null) {
      ctx.save();
      ctx.translate(cx + S.ic / 2, R.cy);
      ctx.rotate(spin);
      icon(ctx, "loader-circle", 0, 0, S.ic, { color: fg, width: 2.2 });
      ctx.restore();
    } else icon(ctx, ic, cx + S.ic / 2, R.cy, S.ic, { color: fg, width: 2.2 });
    cx += S.ic + 8;
  }
  txt(ctx, label, cx, mid(y, S.h, S.fs), S.fs, 600, fg, "left", -0.01);
  cx += lw + 8;
  if (iconRight) {
    if (spin !== null && !ic) {
      ctx.save();
      ctx.translate(cx + S.ic / 2, R.cy);
      ctx.rotate(spin);
      icon(ctx, "loader-circle", 0, 0, S.ic, { color: fg, width: 2.2 });
      ctx.restore();
    } else icon(ctx, iconRight, cx + S.ic / 2, R.cy, S.ic, { color: fg, width: 2.2 });
  }
  ctx.restore();
  return R;
}

// ─── tag (Tag) ───────────────────────────────────────────────────────────────
const TONES = {
  neutral: ["#ffffff", C.inkSoft, C.borderStrong],
  accent: [C.accentSoft, C.accentInk, null],
  success: [C.successSoft, C.success, null],
  info: [C.infoSoft, C.info, null],
  warn: [C.warnSoft, C.warn, null],
};
export function tag(ctx, x, y, text, tone = "neutral", { h = 22, fs = 11, alpha = 1 } = {}) {
  const [bg, fg, bd] = TONES[tone];
  const w = tw(text, fs, 600) + 16;
  ctx.save();
  ctx.globalAlpha *= alpha;
  fillRR(ctx, x, y, w, h, 6, bg, bd, 1);
  txt(ctx, text, x + 8, mid(y, h, fs), fs, 600, fg, "left", 0.02);
  ctx.restore();
  return rect(x, y, w, h);
}

// ─── avatar (AvatarN) ────────────────────────────────────────────────────────
const PALETTE = ["#9f3d2c", "#4d7c0f", "#1e3a8a", "#9a3412", "#365314", "#7c2d12", "#1e40af", "#581c87"];
const hashName = (n) => n.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
function initialsOf(name) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "";
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[Math.ceil(p.length / 2)][0]).toUpperCase();
}
export function avatarN(ctx, cx, cy, size, name, { color = null, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color ?? PALETTE[hashName(name) % PALETTE.length];
  ctx.fill();
  txt(ctx, initialsOf(name), cx, cy + size * 0.38 * 0.36, size * 0.38, 700, "#ffffff", "center");
  ctx.restore();
}

// ─── campos ──────────────────────────────────────────────────────────────────
export function fieldLabel(ctx, text, x, y) {
  txt(ctx, text, x, y + 12, 12, 600, C.inkSoft);
}

// Input h 46, rounded 12. focus 0..1 (borde de acento + halo accent-soft).
// caret: true si se ve el cursor de texto al final.
export function input(ctx, x, y, w, { value = "", placeholder = "", focus = 0, caret = false, h = 46, fs = 14, bg = "#ffffff" } = {}) {
  if (focus > 0.01) {
    ctx.save();
    ctx.globalAlpha *= focus;
    fillRR(ctx, x - 3, y - 3, w + 6, h + 6, 15, C.accentSoft);
    ctx.restore();
  }
  fillRR(ctx, x, y, w, h, 12, bg, mix(C.borderStrong, C.accent, focus), 1);
  const by = mid(y, h, fs);
  if (value) txt(ctx, value, x + 14, by, fs, 400, C.ink);
  else if (placeholder) txt(ctx, placeholder, x + 14, by, fs, 400, C.inkMute);
  if (caret) {
    const cx = x + 14 + (value ? tw(value, fs, 400) + 1 : 0);
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx, y + h / 2 - 9, 1.5, 18);
  }
  return rect(x, y, w, h);
}

// Select nativo (flecha a la derecha).
export function select(ctx, x, y, w, value, { h = 46 } = {}) {
  fillRR(ctx, x, y, w, h, 12, "#ffffff", C.borderStrong, 1);
  txt(ctx, value, x + 14, mid(y, h, 14), 14, 400, C.ink);
  icon(ctx, "chevron-down", x + w - 20, y + h / 2, 16, { color: C.inkSoft, width: 2 });
  return rect(x, y, w, h);
}

// Tarjeta de la app (rounded 16, borde, blanca).
export function card(ctx, x, y, w, h, { r = 16, fill = "#ffffff", border = C.border, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  fillRR(ctx, x, y, w, h, r, fill, border, 1);
  ctx.restore();
  return rect(x, y, w, h);
}

export function cardTitle(ctx, text, x, y, { iconName = null } = {}) {
  let tx = x;
  if (iconName) {
    icon(ctx, iconName, x + 9, y + 10, 18, { color: C.accent, width: 2 });
    tx += 26;
  }
  txt(ctx, text, tx, y + 15, 15, 700, C.ink, "left", -0.01);
}

// Checkbox cuadrado (accent cuando está marcado).
export function checkbox(ctx, x, y, s, on, { r = 4 } = {}) {
  if (on > 0.5) {
    fillRR(ctx, x, y, s, s, r, C.accent);
    icon(ctx, "check", x + s / 2, y + s / 2, s * 0.72, { color: "#ffffff", width: 3 });
  } else fillRR(ctx, x, y, s, s, r, "#ffffff", C.borderStrong, 1.5);
  return rect(x, y, s, s);
}

// Pastilla de selección (Período, Opciones por indicador).
export function pill(ctx, x, y, w, h, label, active, { fs = 13, r = 12 } = {}) {
  fillRR(ctx, x, y, w, h, r, active ? C.accent : "#ffffff", active ? C.accent : C.border, 1);
  txt(ctx, label, x + w / 2, mid(y, h, fs), fs, 600, active ? "#ffffff" : C.ink, "center");
  return rect(x, y, w, h);
}

// Rótulo de sección en versalitas (SectionLabel).
export function sectionLabel(ctx, text, x, y, extra = null) {
  txt(ctx, text.toUpperCase(), x, y + 11, 11, 700, C.inkMute, "left", 0.08);
  if (extra) txt(ctx, extra, x + tw(text.toUpperCase(), 11, 700) * 1.09 + 6, y + 11, 11, 400, C.inkMute);
}

// Zona para soltar archivos (borde punteado).
export function dropZone(ctx, x, y, w, h, title, hint) {
  fillRR(ctx, x, y, w, h, 14, "#ffffff");
  ctx.save();
  rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.borderStrong;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  icon(ctx, "upload", x + w / 2, y + h / 2 - 20, 20, { color: C.inkSoft, width: 2 });
  txt(ctx, title, x + w / 2, y + h / 2 + 10, 13, 600, C.ink, "center");
  txt(ctx, hint, x + w / 2, y + h / 2 + 28, 11, 400, C.inkMute, "center");
  return rect(x, y, w, h);
}

// ─── cascarón de escritorio ──────────────────────────────────────────────────
export const APP_W = 1264;
export const APP_H = 806;
export const SIDEBAR_W = 240;

const NAV = [
  { key: "home", label: "Inicio", icon: "house" },
  { key: "groups", label: "Salas", icon: "users" },
  { key: "informes", label: "Informes", icon: "file-text" },
  { key: "planif", label: "Planificación", icon: "notebook-pen" },
  { key: "settings", label: "Ajustes", icon: "settings" },
];

// Barra lateral fija (w-60). y0: desplazamiento vertical (la barra no scrollea
// con la página: se dibuja en la ventana).
export function sidebar(ctx, active, y0 = 0) {
  ctx.save();
  ctx.translate(0, y0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIDEBAR_W, APP_H);
  ctx.fillStyle = C.border;
  ctx.fillRect(SIDEBAR_W - 1, 0, 1, APP_H);
  // Logo: símbolo + "Trazo Inicial" (800 + 400).
  drawMark(ctx, 36, 36, 26);
  txt(ctx, "Trazo", 56, 42, 16, 800, C.ink);
  txt(ctx, "Inicial", 56 + tw("Trazo", 16, 800) + 4.5, 42, 16, 400, C.ink);
  let y = 72;
  for (const it of NAV) {
    const on = it.key === active;
    if (on) fillRR(ctx, 14, y, SIDEBAR_W - 28, 36, 8, C.accentSoft);
    icon(ctx, it.icon, 14 + 10 + 8.5, y + 18, 17, { color: on ? C.accentInk : C.inkSoft, width: on ? 2 : 1.6 });
    txt(ctx, it.label, 14 + 10 + 17 + 10, mid(y, 36, 13), 13, on ? 600 : 500, on ? C.accentInk : C.inkSoft);
    y += 40;
  }
  y += 8;
  icon(ctx, "circle-question-mark", 14 + 10 + 8.5, y + 18, 17, { color: C.inkSoft, width: 1.6 });
  txt(ctx, "Ayuda", 51, mid(y, 36, 13), 13, 500, C.inkSoft);
  y += 44;
  icon(ctx, "moon", 14 + 10 + 8.5, y + 18, 17, { color: C.inkSoft, width: 1.6 });
  txt(ctx, "Modo oscuro", 51, mid(y, 36, 13), 13, 500, C.inkSoft);
  // Pie: perfil y plan.
  ctx.fillStyle = C.border;
  ctx.fillRect(14, APP_H - 70, SIDEBAR_W - 28, 1);
  avatarN(ctx, 38, APP_H - 38, 32, "Ana Ejemplo", { color: C.accent });
  txt(ctx, "Ana E.", 62, APP_H - 42, 13, 600, C.ink);
  txt(ctx, "Plan Gratis", 62, APP_H - 26, 11, 400, C.inkMute);
  ctx.restore();
}

// Barra superior (DesktopTopbar): título 22 bold, subtítulo 12, acciones a la
// derecha. Devuelve los rects de las acciones por etiqueta. alt: 86.
export const TOPBAR_H = 86;
export function topbar(ctx, title, subtitle, actions = [], { x0 = SIDEBAR_W, press = {}, labels = {} } = {}) {
  ctx.fillStyle = C.surface;
  ctx.fillRect(x0, 0, APP_W - x0, TOPBAR_H);
  ctx.fillStyle = C.border;
  ctx.fillRect(x0, TOPBAR_H - 1, APP_W - x0, 1);
  txt(ctx, title, x0 + 32, subtitle ? 44 : 50, 22, 700, C.ink, "left", -0.02);
  if (subtitle) txt(ctx, subtitle, x0 + 32, 64, 12, 400, C.inkMute);
  const R = {};
  let x = APP_W - 32;
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    const label = labels[a.key] ?? a.label;
    const w = btnWidth(label, a);
    x -= w;
    R[a.key] = btn(ctx, x, (TOPBAR_H - 46) / 2, label, { ...a, press: press[a.key] ?? 0 });
    x -= 8;
  }
  return R;
}

// Fondo de la página.
export function page(ctx) {
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, APP_W, 4000);
}

export { C, icon, clamp, lerp, mix };
