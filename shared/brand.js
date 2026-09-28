// Marca de Trazo Inicial: paleta real (app/src/app/globals.css, data-palette
// ámbar) y el logo con su geometría original (app/src/components/brand/logo.tsx).

import { shapeOf, tracePortion, dotsAlong } from "../engine/paths.js";

export const C = {
  // Ámbar, modo claro.
  accent: "#c2410c",
  accentSoft: "#fde9d3",
  accentInk: "#7c2d12",
  surface: "#faf6ef",
  card: "#ffffff",
  ink: "#1c1917",
  inkSoft: "#57534e",
  inkMute: "#a8a29e",
  border: "#ebe4d6",
  borderStrong: "#d6cdba",
  success: "#3f6212",
  successSoft: "#ecfccb",
  info: "#312e81",
  infoSoft: "#e0e7ff",
  warn: "#9a3412",
  warnSoft: "#fed7aa",
  // Ámbar, modo oscuro.
  dAccent: "#fb923c",
  dAccentSoft: "#451a03",
  dAccentInk: "#fed7aa",
  dSurface: "#1a1614",
  dCard: "#26201c",
  dInk: "#f5f1ea",
  dInkSoft: "#a8a29e",
  dInkMute: "#78716c",
  dBorder: "#3a322c",
  // Ícono PWA.
  paper: "#f7f3ec",
  logoInk: "#1f1b16",
};

// Paths del logo en su viewBox de 64x64.
export const LOGO = {
  arcSolid: "M 9.50 45.00 A 26 26 0 1 1 45.00 54.52",
  arcDots: "M 45.00 54.52 A 26 26 0 0 1 9.50 45.00",
  bar: "M 19 24 L 45 24",
  stem: "M 32 24 L 32 40",
  swash: "M 32 40 Q 32 48, 40 50",
};

// Dibuja el símbolo con cada trazo controlado por separado (0..1):
//   solid  arco sólido en tinta (se dibuja en el sentido del path)
//   dots   cantidad de puntos del tramo punteado que ya aparecieron (0..1)
//   bar    barra de la T (crece desde el centro)
//   stem   fuste de la T (baja desde la barra)
//   swash  swash naranja que sale del pie
// size = lado en px del viewBox 64. (cx, cy) = centro del símbolo.
export function drawMark(ctx, cx, cy, size, p = {}, colors = {}) {
  const ink = colors.ink ?? C.logoInk;
  const accent = colors.accent ?? C.accent;
  const k = size / 64;
  const dens = Math.max(1, k * 0.8);
  const solid = p.solid ?? 1;
  const dots = p.dots ?? 1;
  const bar = p.bar ?? 1;
  const stem = p.stem ?? 1;
  const swash = p.swash ?? 1;
  const dotScale = p.dotScale ?? ((i) => 1);

  ctx.save();
  ctx.translate(cx - 32 * k, cy - 32 * k);
  ctx.scale(k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (solid > 0) {
    ctx.beginPath();
    tracePortion(ctx, shapeOf(LOGO.arcSolid, dens), 0, solid);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  if (dots > 0) {
    // El original usa stroke-dasharray "0.1 5.5" con cap redondo: puntos de
    // diámetro 2.4 cada ~5.6 unidades. Los dibujamos como círculos para poder
    // animarlos uno por uno.
    const sh = shapeOf(LOGO.arcDots, dens);
    const pts = dotsAlong(sh, 5.6, 0);
    const shown = dots * pts.length;
    ctx.fillStyle = accent;
    pts.forEach((pt, i) => {
      const a = Math.min(1, Math.max(0, shown - i));
      if (a <= 0) return;
      const r = 1.2 * a * dotScale(i, pts.length);
      if (r <= 0.01) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = ink;
  if (bar > 0) {
    ctx.beginPath();
    const h = 13 * bar;
    ctx.moveTo(32 - h, 24);
    ctx.lineTo(32 + h, 24);
    ctx.stroke();
  }
  if (stem > 0) {
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(32, 24 + 16 * stem);
    ctx.stroke();
  }
  if (swash > 0) {
    ctx.beginPath();
    tracePortion(ctx, shapeOf(LOGO.swash, dens), 0, swash);
    ctx.strokeStyle = accent;
    ctx.stroke();
  }
  ctx.restore();
}
