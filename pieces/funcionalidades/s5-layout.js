// S5 "Contale tu idea." (tratamiento final 3.6): geometría y tiempos en un solo
// lugar, para que el chat, el panel y la escena (y S6, que se lleva el panel en
// f280) lean los mismos números.
//
// Vertical (IS_V): la frase va en dos renglones, el chat baja 160 px y el panel
// de planificaciones va DEBAJO del chat, centrado en su columna (en horizontal
// va a la derecha). La barra de entrada no entra en la columna y se omite.

import { IS_V } from "../../engine/format.js";
const DY = IS_V ? 160 : 0;

export const COL = {
  crema: "#fde9d3",
  accent: "#c2410c",
  accentSoft: "#fde9d3",
  accentInk: "#7c2d12",
  ink: "#1c1917",
  inkSoft: "#57534e",
  mute: "#a8a29e",
  border: "#ebe4d6",
  borderStrong: "#d6cdba",
  card: "#ffffff",
  noche: "#1c1917",
  nocheInk: "#f5f1ea",
  nochePeriod: "#fb923c",
};

// ─── tiempos ─────────────────────────────────────────────────────────────────
export const T = {
  panStart: 249, // latigazo (C-P1-14): ox(t) = -1920·whip((t-249)/6)
  panEnd: 255,
  bubble: 262, // S4 entrega la burbuja (C-P1-15)
  avatar: 258,
  // El panel entra como respuesta a "Generar planificaciones": si entrara antes
  // quedaría un rectángulo vacío esperando contenido.
  panelIn: 266, // el panel entra con el toque, desde x +560 (glide, 5,5 f)
  panelLand: 271.5,
  header: 267,
  chipPop: 262,
  chipTap: 266,
  collapse: 266.5, // 266,5-269,5
  // Las tres planificaciones aterrizan antes del traspaso a S6 (f280), así se
  // pueden ver completas y quietas las tres juntas.
  launch: [267.5, 268.5, 269.5],
  land: [272, 273, 274],
  handoff: 280, // S6 se lleva el panel (C-P1-16)
  dropOut: 286, // 286-292
  chatEnd: 292,
};

// ─── chat ────────────────────────────────────────────────────────────────────
export const BUBBLE = { x: 464, y: 400 + DY, w: 716, h: 112, r: [28, 28, 6, 28] };
export const BUBBLE_TEXT = "Quiero armar una unidad sobre la huerta";
export const AVATAR = { cx: 152, cy: 600 + DY, d: 64 };
export const THINK = { xs: [206, 232, 258], y: 600 + DY, d: 14 };
export const CHIP = { x: 200, y: 648 + DY, w: 406, h: 64, label: "Generar planificaciones" };
// El chip se parte en tres puntos de 18 px centrados en (404, 680), a 36 px.
export const SPLIT = { xs: [368, 404, 440], y: 680 + DY, d: 18 };

// Barra de entrada del chat (la real: "Describí tu idea de actividades…").
export const INPUT = { x: 120, y: 892, w: 1060, h: 88, r: 44, placeholder: "Describí tu idea de actividades…", hidden: IS_V };

// ─── panel ───────────────────────────────────────────────────────────────────
const PX = IS_V ? 390 : 1240;
const PY = IS_V ? 920 : 360;
export const PANEL = { x: PX, y: PY, w: 520, h: 640, r: 28 };
export const HEADER = { x: PX + 24, baseline: PY + 60, text: "Planificaciones" };
export const CARD = { x: PX + 24, ys: [PY + 80, PY + 256, PY + 432], w: 472, h: 160, r: 20 };
export const TILE = { dx: 24, dy: 24, s: 72, r: 18 };

// Tarjetas de 3.6. El título de la 2 era "Contamos lo que plantamos" (384 px a
// 28 w800: no entra en los 328 px que deja la tarjeta después del tile). Se
// acortó a "Contamos lo plantado" (304 px), mismo sentido.
export const CARDS = [
  { tile: "#15803d", icon: "leaf", title: "La huerta de la sala", label: "Proyecto", meta: "Dos semanas · Sala de 4 años · 8 propuestas" },
  { tile: "#c2410c", icon: "blocks", title: "Contamos lo plantado", label: "Secuencia Didáctica", meta: "Una semana · Sala de 4 años · 6 propuestas" },
  { tile: "#b45309", icon: "book-open", title: "Cuentos de la huerta", label: "Unidad Didáctica", meta: "Dos semanas · Sala de 4 años · 6 propuestas" },
];

export const cardRect = (k) => ({ x: CARD.x, y: CARD.ys[k], w: CARD.w, h: CARD.h, r: CARD.r });
export const tileCenter = (k) => [CARD.x + TILE.dx + TILE.s / 2, CARD.ys[k] + TILE.dy + TILE.s / 2];

// Qué punto del chip va a qué tarjeta: el de la derecha (el más cercano al
// panel) sale primero hacia la tarjeta de arriba, así nadie salta por encima de
// los que esperan.
export const dotForCard = (k) => 2 - k;
