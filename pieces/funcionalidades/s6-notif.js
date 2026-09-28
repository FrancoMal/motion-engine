// S6: la notificación push real de Trazo Inicial en sus dos diagramaciones
// (tratamiento final 3.7). "Base" es el aviso chico que cae adentro del
// teléfono; "hero" es la misma notificación despegada hacia cámara, legible a
// 64 px. Título real "Trazo Inicial", cuerpo real "Ya están listos tus 12
// informes.", sin botones ni vista previa.
//
// Todo se dibuja en coordenadas locales de la tarjeta: la base en (0,0)-(400,110)
// y el hero en (0,0)-(1000,330). Quien llama pone la transformación (plano del
// teléfono, vuelo, o pantalla).

import { drawText } from "../../engine/text.js";
import { clamp, lerp } from "../../engine/math.js";
import { makePhrase, drawPhrase } from "../../shared/phrase.js";
import { rr } from "../../shared/ui.js";
import { C, drawMark } from "../../shared/brand.js";
import { EASE } from "../../shared/system.js";

export const BASE = { w: 400, h: 110, r: 24 };
export const HERO = { x: 510, y: 395, w: 1000, h: 330, r: 44 };
export const CARD_FILL = "rgba(250,246,239,0.97)";
export const BODY = "Ya están listos tus 12 informes.";

// Cuerpo del hero, diagramado una vez a su peso de reposo (w800, -0.02em).
export const L1 = makePhrase({ text: "Ya están listos", size: 64, wght: 800, tracking: -0.02, x: 200, baseline: 190, color: C.ink });
export const L2 = makePhrase({ text: "tus 12 informes.", size: 64, wght: 800, tracking: -0.02, x: 200, baseline: 268, color: C.ink });

// Punto final del hero (el actor de T15), en coordenadas del hero. En pantalla
// cae en (1178, 656), d 13 (contrato C-P1-19).
export const PERIOD = { x: 668, y: 261, d: 13 };

// Ícono de la app (PWA): papel #F7F3EC con el símbolo, borde y sombra suaves.
export function appTile(ctx, cx, cy, s, { r = s * 0.23, alpha = 1, shadow = 0.25, border = true } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow > 0) {
    ctx.save();
    const k = ctx.getTransform().a || 1;
    ctx.shadowColor = `rgba(20,12,8,${shadow})`;
    ctx.shadowBlur = s * 0.16 * k;
    ctx.shadowOffsetY = s * 0.05 * k;
    rr(ctx, cx - s / 2, cy - s / 2, s, s, r);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, cx - s / 2, cy - s / 2, s, s, r);
  ctx.fillStyle = C.paper;
  ctx.fill();
  if (border) {
    ctx.lineWidth = Math.max(1, s / 64);
    ctx.strokeStyle = "rgba(214,205,186,0.9)";
    rr(ctx, cx - s / 2 + 0.5, cy - s / 2 + 0.5, s - 1, s - 1, r - 0.5);
    ctx.stroke();
  }
  drawMark(ctx, cx, cy, s * 0.625);
  ctx.restore();
}

// Fondo de la tarjeta (relleno + filo). w, h en unidades locales.
export function cardBg(ctx, w, h, r, { alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, 0, 0, w, h, r);
  ctx.fillStyle = CARD_FILL;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(235,228,214,0.9)";
  rr(ctx, 0.75, 0.75, w - 1.5, h - 1.5, r - 0.75);
  ctx.stroke();
  ctx.restore();
}

// Diagramación base (400 x 110): ícono 40, "Trazo Inicial" 19 w700, "ahora"
// 16, cuerpo 20 w500 en una línea.
export function drawBaseContent(ctx, { alpha = 1 } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  appTile(ctx, 38, 38, 40, { r: 10, shadow: 0.12 });
  drawText(ctx, "Trazo Inicial", 70, 42, { size: 19, weight: 700 }, { color: C.inkSoft });
  drawText(ctx, "ahora", 382, 42, { size: 16, weight: 500 }, { align: "right", color: C.inkMute });
  drawText(ctx, BODY, 70, 78, { size: 20, weight: 500 }, { color: C.ink });
  ctx.restore();
}

// Diagramación hero (1000 x 330). ink 0..1 carga la tinta del cuerpo en el
// lugar (w520 → w800) mientras la base se funde. withPeriod dibuja el punto
// adentro (en vuelo); en reposo el punto es un actor aparte.
export function drawHeroContent(ctx, t, { alpha = 1, ink = 1, withPeriod = false } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  appTile(ctx, 100, 100, 120, { r: 28, shadow: 0.14 });
  drawText(ctx, "Trazo Inicial", 200, 84, { size: 40, weight: 700 }, { color: C.inkSoft });
  drawText(ctx, "ahora", 960, 84, { size: 30, weight: 500 }, { align: "right", color: C.inkMute });
  const w = lerp(520, 800, EASE.ink(clamp(ink)));
  const prog = ink >= 1 ? [] : [(tt, g, st) => (st.weight = w)];
  drawPhrase(ctx, L1, t, prog);
  drawPhrase(ctx, L2, t, prog);
  if (withPeriod) {
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(PERIOD.x, PERIOD.y, PERIOD.d / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
