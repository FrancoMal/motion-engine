// S2: la tarjeta del indicador (vista General de la app, redibujada).
//
// "Aceptación de normas grupales" con sus tres sugerencias graduadas (el
// default de la app), la fila 1 con 5 alumnos, la fila 3 con 4 y la fila 2
// vacía ("Tocá para asignar alumnos"). Cuando aterrizan los tres avatares la
// fila 2 se inunda de acento suave desde el punto de contacto y el contador
// rueda de 9 / 12 a 12 / 12: 5 + 3 + 4 = 12, consistente.
//
// Todo en coordenadas de mundo (z 0). La tarjeta no dibuja los avatares que
// llegan volando: esos los dibuja la escena encima, con su propio ciclo.

import { createCanvas } from "@napi-rs/canvas";
import { C } from "../../shared/brand.js";
import { drawText, textWidth, glyphs, setType } from "../../engine/text.js";
import { icon } from "../../shared/ui.js";
import { mix, mixHex, clamp, lerp, lerpLog } from "../../engine/math.js";
import { odometer } from "../../shared/odometer.js";
import { EASE, SPR, spr, p as prog } from "../../shared/system.js";
import { makePhrase, drawPhrase } from "../../shared/phrase.js";

// ─── geometría (tratamiento 3.3) ─────────────────────────────────────────────
export const CARD = { x: 1010, y: 300, w: 820, h: 470, r: 28 };
export const TINT = mixHex("#ffffff", C.accentSoft, 0.6); // filas con alumnos
const SHADOW_RGB = "124,45,18"; // sombra de tarjeta sobre Acento

// Contador: la pastilla se arma desde la derecha (x 1803) con el ancho real
// de "12 / 12" en cifras tabulares (como las mide el odómetro), así el ícono
// nunca pisa los dígitos.
const CNT_STYLE = { size: 26, weight: 700, tracking: 0 };
const mctx = createCanvas(8, 8).getContext("2d");
function tabWidth(s) {
  setType(mctx, CNT_STYLE);
  const dw = mctx.measureText("0").width;
  return Array.from(s).reduce((a, ch) => a + (/\d/.test(ch) ? dw : mctx.measureText(ch).width), 0);
}
const CNT_PAD = 14;
const CNT_ICON = 20;
const CNT_GAP = 8;
const CNT_W = tabWidth("12 / 12");
const PILL_W = CNT_PAD + CNT_ICON + CNT_GAP + CNT_W + CNT_PAD;
const PILL = { x: 1803 - PILL_W, y: 328, w: PILL_W, h: 44 };
const ASSIGNED_INK = C.warn; // texto de una sugerencia con alumnos (como en la app)

export const ROWS = [
  { top: 410, level: 1, text: "Cumple espontáneamente las normas acordadas", stack: ["NE", "SE", "DE", "EE", "TE"], count: "5" },
  { top: 530, level: 2, text: "Cumple las normas con recordatorios mínimos", stack: [], count: "" },
  { top: 650, level: 3, text: "Cumple las normas con indicaciones frecuentes", stack: ["PE", "LE", "RE", "FE"], count: "4" },
];

// Destino de los tres avatares en la fila 2 y cuándo aterrizan.
export const TARGETS = [
  [1120, 620],
  [1148, 620],
  [1176, 620],
];
export const LAND = [121, 123.5, 126];
export const AV_D = 40; // diámetro de un avatar de pila
export const AV_FILL = C.accentInk; // #7c2d12, el tono real de los avatares

// Texto de la fila 2 con diagramación fija a su peso final (600): cuando la
// fila se inunda cada glifo entinta 500 → 600 en su lugar, sin deslizarse.
const ROW2 = makePhrase({ text: ROWS[1].text, size: 26, wght: 600, tracking: 0, x: 1100, baseline: ROWS[1].top + 50, color: C.inkSoft });

// ─── utilidades ──────────────────────────────────────────────────────────────

// Escala de dispositivo del ctx (las sombras de canvas van en píxeles de
// dispositivo, no en unidades de mundo).
export function devScale(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

// Avatar de pila: círculo #7c2d12 con iniciales #faf6ef w800 a 0,4 del
// diámetro y un aro del color del fondo de la fila (así se separan al
// superponerse, como en la app).
export function stackAvatar(ctx, cx, cy, d, initials, ringColor, { alpha = 1, ring = 2.5 } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (ringColor && ring > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2 + ring, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = AV_FILL;
  ctx.fill();
  const style = { size: d * 0.4, weight: 800, tracking: 0 };
  const cap = glyphs(ctx, initials, style).cap;
  drawText(ctx, initials, cx, cy + cap / 2, style, { align: "center", color: C.surface });
  ctx.restore();
}

// Insignia de nivel: 40 px. Nivel 1 lleno de acento con numeral blanco; los
// demás con borde #d6cdba y numeral #a8a29e.
function badge(ctx, cx, cy, level) {
  const filled = level === 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = filled ? C.accent : "#ffffff";
  ctx.fill();
  if (!filled) {
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.borderStrong;
    ctx.stroke();
  }
  const style = { size: 20, weight: 800, tracking: 0 };
  const cap = glyphs(ctx, String(level), style).cap;
  drawText(ctx, String(level), cx, cy + cap / 2, style, { align: "center", color: filled ? "#ffffff" : C.inkMute });
}

// ─── estado dinámico ─────────────────────────────────────────────────────────

// Radio de la inundación de la fila 2 desde el primer contacto (6 f, glide,
// interpolado en log porque crece mucho más de 4x).
function floodRadius(t) {
  if (t < LAND[0]) return 0;
  return lerpLog(20, 760, prog(t, LAND[0], LAND[0] + 6, EASE.glide));
}

// Cuánto entintó la inundación un punto de la fila 2 (0..1).
function floodAt(t, x, y) {
  const r = floodRadius(t);
  if (r <= 0) return 0;
  const d = Math.hypot(x - TARGETS[0][0], y - TARGETS[0][1]);
  return clamp((r - d) / 90);
}

// Pulso del contador cuando llega a 12 / 12 (f126): 1 → 1,12 → 1.
function pillPulse(t) {
  const H = LAND[2];
  if (t < H) return 1;
  if (t < H + 2) return lerp(1, 1.12, EASE.brake((t - H) / 2));
  return 1 + 0.12 * (1 - spr(t, H + 2, SPR.snap));
}

// ─── dibujo ──────────────────────────────────────────────────────────────────

// Sombra de tarjeta de dos capas (2.10), con el color de Acento. El shadowBlur
// y los offsets se escalan a píxeles de dispositivo.
function cardShadow(ctx, { lift = 1 } = {}) {
  const ds = devScale(ctx);
  const { x, y, w, h, r } = CARD;
  ctx.save();
  // Ambiente: 0 30 60 -25 (el -25 de spread se simula achicando la forma).
  ctx.shadowColor = `rgba(${SHADOW_RGB},0.35)`;
  ctx.shadowBlur = 60 * ds * lift;
  ctx.shadowOffsetY = 30 * ds * lift;
  rr(ctx, x + 25, y + 25, w - 50, h - 50, r);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // Contacto: 0 2 6.
  ctx.shadowColor = `rgba(${SHADOW_RGB},0.12)`;
  ctx.shadowBlur = 6 * ds;
  ctx.shadowOffsetY = 2 * ds;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

// Tarjeta completa en el tiempo t (sin los avatares que llegan volando).
export function drawCard(ctx, t) {
  const { x, y, w, h, r } = CARD;
  cardShadow(ctx);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Filas (recortadas a la tarjeta: la 3 toca las esquinas de abajo).
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  for (const row of ROWS) {
    if (row.stack.length) {
      ctx.fillStyle = TINT;
      ctx.fillRect(x, row.top, w, 120);
    }
  }
  // Inundación radial de la fila 2 desde el primer avatar.
  const fr = floodRadius(t);
  if (fr > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, ROWS[1].top, w, 120);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(TARGETS[0][0], TARGETS[0][1], fr, 0, Math.PI * 2);
    ctx.fillStyle = TINT;
    ctx.fill();
    ctx.restore();
  }
  // Separadores.
  ctx.fillStyle = C.border;
  for (const row of ROWS) ctx.fillRect(x, row.top - 0.75, w, 1.5);
  ctx.restore();

  // Encabezado.
  drawText(ctx, "Aceptación de normas grupales", 1042, 352, { size: 34, weight: 700 }, { color: C.ink });
  drawText(ctx, "3 sugerencias graduadas", 1042, 388, { size: 24, weight: 500 }, { color: C.inkMute });
  drawCounter(ctx, t);

  // Filas 1 y 3: con alumnos desde antes.
  for (const row of [ROWS[0], ROWS[2]]) {
    badge(ctx, 1062, row.top + 40, row.level);
    drawText(ctx, row.text, 1100, row.top + 50, { size: 26, weight: 600 }, { color: ASSIGNED_INK });
    drawText(ctx, row.count, 1800, row.top + 50, { size: 22, weight: 700 }, { color: ASSIGNED_INK, align: "right" });
    // Como en la app: el primero de la pila queda arriba.
    for (let k = row.stack.length - 1; k >= 0; k--) stackAvatar(ctx, 1120 + 28 * k, row.top + 90, AV_D, row.stack[k], TINT);
  }

  // Fila 2: vacía hasta que llegan los avatares.
  const r2 = ROWS[1];
  badge(ctx, 1062, r2.top + 40, r2.level);
  drawPhrase(ctx, ROW2, t, [
    (tt, g, st) => {
      const k = EASE.ink(floodAt(tt, g.ax + g.w / 2, r2.top + 45));
      st.weight = lerp(500, 600, k);
      st.color = k <= 0 ? C.inkSoft : k >= 1 ? ASSIGNED_INK : mix(C.inkSoft, ASSIGNED_INK, k);
    },
  ]);
  // Pista "Tocá para asignar alumnos" (22 px, derecha, sin itálica).
  const hintA = 1 - prog(t, LAND[0], LAND[0] + 3, EASE.swell);
  if (hintA > 0.002) {
    ctx.save();
    ctx.globalAlpha *= hintA;
    drawText(ctx, "Tocá para asignar alumnos", 1100, 628, { size: 22, weight: 500 }, { color: C.inkMute });
    ctx.restore();
  }
  // Conteo de la fila: "+" (como la app en una sugerencia sin alumnos) que
  // cede el lugar a "3".
  const plusA = 1 - prog(t, LAND[0], LAND[0] + 2);
  if (plusA > 0.002) {
    ctx.save();
    ctx.globalAlpha *= plusA;
    drawText(ctx, "+", 1800, r2.top + 50, { size: 26, weight: 500 }, { color: C.inkMute, align: "right" });
    ctx.restore();
  }
  const T3 = LAND[1] + 0.5; // f124
  if (t >= T3) {
    const s = lerp(0.4, 1, EASE.back(prog(t, T3, T3 + 5)));
    const a = prog(t, T3, T3 + 2);
    const style = { size: 22, weight: 700 };
    const tw = textWidth(ctx, "3", style);
    const cap = glyphs(ctx, "3", style).cap;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(1800 - tw / 2, r2.top + 50 - cap / 2);
    ctx.scale(s, s);
    drawText(ctx, "3", 0, cap / 2, style, { color: ASSIGNED_INK, align: "center" });
    ctx.restore();
  }

  // Borde.
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.border;
  rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r - 0.75);
  ctx.stroke();
  ctx.restore();
}

// Contador del encabezado: ícono Users + "9 / 12" que rueda por dígito (snap,
// 5 f) en cada aterrizaje y late al llegar a 12 / 12.
function drawCounter(ctx, t) {
  const s = pillPulse(t);
  const cx = PILL.x + PILL.w / 2;
  const cy = PILL.y + PILL.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  rr(ctx, PILL.x, PILL.y, PILL.w, PILL.h, PILL.h / 2);
  ctx.fillStyle = C.accentSoft;
  ctx.fill();
  icon(ctx, "users", PILL.x + CNT_PAD + CNT_ICON / 2, cy, CNT_ICON, { color: C.accentInk, width: 2.4 });
  const cap = glyphs(ctx, "0", CNT_STYLE).cap;
  odometer(
    ctx,
    t,
    PILL.x + PILL.w - CNT_PAD,
    cy + cap / 2,
    [
      [0, "9 / 12"],
      [LAND[0], "10 / 12"],
      [LAND[1], "11 / 12"],
      [LAND[2], "12 / 12"],
    ],
    { size: 26, weight: 700, color: C.accentInk, align: "right" },
  );
  ctx.restore();
}

// ─── textura para la entrada en 3D ───────────────────────────────────────────
// La tarjeta entra girando en Y (card3d necesita una imagen). Mientras entra
// está en su estado inicial, así que se dibuja una vez por worker y escala.
// Márgenes para que la sombra entre en la textura.
export const TEX = { x0: 940, y0: 260, w: 960, h: 620 };
let texCache = null;
export function cardTexture(q) {
  if (texCache && texCache.q === q) return texCache.canvas;
  const canvas = createCanvas(Math.ceil(TEX.w * q), Math.ceil(TEX.h * q));
  const c = canvas.getContext("2d");
  c.scale(q, q);
  c.translate(-TEX.x0, -TEX.y0);
  drawCard(c, 0);
  texCache = { q, canvas };
  return canvas;
}
