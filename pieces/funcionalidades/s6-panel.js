// S6 T13' (tratamiento final 3.7): el panel de planificaciones que S6 recibe de
// S5 en f280 (contrato C-P1-16) y encoge hasta volverse el ícono instalado.
//
// Es el mismo panel que dibuja S5 (3.6): mismos números que s5-layout.js,
// copiados acá para que un archivo de S5 a medio editar no rompa esta escena.
// Si S5 cambia su panel, hay que copiar el cambio (constantes PANEL, CARD,
// TILE y CARDS).

import { drawText, textWidth } from "../../engine/text.js";
import { rr, icon } from "../../shared/ui.js";
import { C } from "../../shared/brand.js";

// El panel real de S5 (en vertical va debajo del chat): se toma de su layout.
import { PANEL as PANEL_S5 } from "./s5-layout.js";
export const PANEL = { ...PANEL_S5 };
const HEADER = { dx: 24, baseline: 60, text: "Planificaciones" };
const CARD = { dx: 24, dys: [80, 256, 432], w: 472, h: 160, r: 20 };
const TILE = { dx: 24, dy: 24, s: 72, r: 18 };

// Títulos de 3.6; el de la tarjeta 2 es el acortado de S5 ("Contamos lo que
// plantamos" no entra en 328 px a 28 w800).
const CARDS = [
  { tile: "#15803d", icon: "leaf", title: "La huerta de la sala", label: "Proyecto", meta: "Dos semanas · Sala de 4 años · 8 propuestas" },
  { tile: "#c2410c", icon: "blocks", title: "Contamos lo plantado", label: "Secuencia Didáctica", meta: "Una semana · Sala de 4 años · 6 propuestas" },
  { tile: "#b45309", icon: "book-open", title: "Cuentos de la huerta", label: "Unidad Didáctica", meta: "Dos semanas · Sala de 4 años · 6 propuestas" },
];

// Contenido del panel en coordenadas locales (0,0)-(520,640), sin sombra (la
// sombra la pone quien lo proyecta). El fondo blanco llena todo el rect: el
// recorte redondeado lo hace el que llama.
export function drawPanelContent(ctx) {
  ctx.fillStyle = C.card;
  ctx.fillRect(0, 0, PANEL.w, PANEL.h);
  // Encabezado "Planificaciones · 3".
  const hs = { size: 40, weight: 800, tracking: -0.01 };
  drawText(ctx, HEADER.text, HEADER.dx, HEADER.baseline, hs, { color: C.ink });
  const hw = textWidth(ctx, HEADER.text, hs);
  drawText(ctx, " · 3", HEADER.dx + hw, HEADER.baseline, { size: 40, weight: 500 }, { color: C.inkMute });

  CARDS.forEach((cd, k) => {
    const x = CARD.dx;
    const y = CARD.dys[k];
    rr(ctx, x, y, CARD.w, CARD.h, CARD.r);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.border;
    rr(ctx, x + 0.75, y + 0.75, CARD.w - 1.5, CARD.h - 1.5, CARD.r - 0.75);
    ctx.stroke();
    // Tile de color con el ícono en blanco.
    rr(ctx, x + TILE.dx, y + TILE.dy, TILE.s, TILE.s, TILE.r);
    ctx.fillStyle = cd.tile;
    ctx.fill();
    icon(ctx, cd.icon, x + TILE.dx + TILE.s / 2, y + TILE.dy + TILE.s / 2, 36, { color: "#ffffff", width: 2.4 });
    const ts = fitStyle(ctx, cd.title, { size: 28, weight: 800, tracking: -0.01 }, CARD.w - 120 - 20);
    drawText(ctx, cd.title, x + 120, y + 54, ts, { color: C.ink });
    drawText(ctx, cd.label, x + 120, y + 86, { size: 20, weight: 700 }, { color: C.inkMute });
    // Divisor y meta.
    ctx.fillStyle = C.border;
    ctx.fillRect(x + 24, y + 108, CARD.w - 48, 1.5);
    drawText(ctx, cd.meta, x + 24, y + 140, { size: 20, weight: 500 }, { color: C.inkMute });
  });
}

// Achica el cuerpo si el texto no entra (en vez de desbordar la tarjeta).
function fitStyle(ctx, text, style, maxW) {
  const w = textWidth(ctx, text, style);
  if (w <= maxW) return style;
  return { ...style, size: Math.floor(style.size * (maxW / w) * 10) / 10 };
}

