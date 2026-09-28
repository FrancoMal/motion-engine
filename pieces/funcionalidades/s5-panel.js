// S5: el panel "Planificaciones · N" de la derecha (tratamiento final 3.6).
//
// S5 lo dibuja hasta f280; desde f280 es de S6, que lo convierte en el ícono de
// la app (T13'). Por eso esto se exporta como una función pura de t en
// coordenadas de mundo, en su rect del contrato C-P1-16 (x 1240-1760,
// y 360-1000): S6 puede llamarla dentro de su transformación y la tercera
// tarjeta sigue aterrizando (tile, ícono, texto) mientras el panel se achica.
//
// Tarjetas: el punto aterriza en el hueco del tile, se abre en un cuadrado de
// 72 con snap, el ícono se traza, el cuerpo de la tarjeta se desenrolla hacia
// la derecha desde el tile y el texto sube glifo por glifo. Antes de cada
// aterrizaje, el hueco es un contorno punteado: punteado que se vuelve tarjeta.

import { EASE, SPR, spr, p as prog, ring } from "../../shared/system.js";
import { icon, rr } from "../../shared/ui.js";
import { drawText, kinetic, glyphs, setType } from "../../engine/text.js";
import { clamp, lerp, rgba } from "../../engine/math.js";
import { lerpRect, drawRect } from "../../shared/punto.js";
import { COL, T, PANEL, HEADER, CARD, TILE, CARDS, SPLIT, cardRect, tileCenter } from "./s5-layout.js";

// ─── tiempo ──────────────────────────────────────────────────────────────────

// Entrada del panel desde x +560 (glide, 10 f, apoya en f268).
export const panelSlide = (t) => 560 * (1 - prog(t, T.panelIn, T.panelLand, EASE.glide));

// Estado del tile k en t: rect y progreso (null antes de aterrizar).
export function tileState(k, t) {
  const L = T.land[k];
  if (t < L) return null;
  const g = spr(t, L, SPR.snap); // 0 → 1 con overshoot 11,5 %
  const s = lerp(SPLIT.d, TILE.s, g);
  const r = lerp(SPLIT.d / 2, TILE.r, clamp(g));
  const [cx, cy] = tileCenter(k);
  return { rect: { x: cx - s / 2, y: cy - s / 2, w: s, h: s, r }, g, cx, cy, u: t - L };
}

// ─── piezas ──────────────────────────────────────────────────────────────────

// Sombra de tarjeta del kit (2.10): 0 30 60 -25 rgba(28,25,23,.28) más
// 0 2 6 rgba(28,25,23,.06). El spread negativo se hace achicando la forma.
function cardShadow(ctx, R, { lift = 1, alpha = 1 } = {}) {
  if (alpha <= 0.001) return;
  const rad = Array.isArray(R.r) ? R.r[0] : R.r;
  ctx.save();
  ctx.shadowColor = `rgba(28,25,23,${0.28 * alpha})`;
  ctx.shadowBlur = 60 * lift;
  ctx.shadowOffsetY = 30 * lift;
  const inset = 25 * lift;
  rr(ctx, R.x + inset, R.y + inset, Math.max(1, R.w - inset * 2), Math.max(1, R.h - inset * 2), Math.max(0, rad - inset));
  ctx.fillStyle = COL.card;
  ctx.fill();
  ctx.shadowColor = `rgba(28,25,23,${0.06 * alpha})`;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  rr(ctx, R.x, R.y, R.w, R.h, rad);
  ctx.fill();
  ctx.restore();
}

function whiteCard(ctx, R, { lift = 1, shadow = 1, border = COL.border, borderWidth = 1.5 } = {}) {
  cardShadow(ctx, R, { lift, alpha: shadow });
  drawRect(ctx, R, { fill: COL.card, stroke: border, lineWidth: borderWidth });
}

// Contador del encabezado: el dígito rueda hacia arriba y asienta justo en
// cada aterrizaje (brake, 3 f), así en f280 dice "3" quieto (C-P1-16).
function headerCount(ctx, t, x, baseline, style, color) {
  const starts = T.land.map((L) => L - 3);
  let n = 0;
  for (let i = 0; i < starts.length; i++) if (t >= starts[i]) n = i + 1;
  const k = n === 0 ? 1 : EASE.brake(clamp((t - starts[n - 1]) / 3));
  const cur = String(n);
  const prev = String(Math.max(0, n - 1));
  setType(ctx, style);
  const w = ctx.measureText("0").width;
  const cap = glyphs(ctx, "0", style).cap;
  // Pulso chico del número en el aterrizaje (1 → 1,14 → 1).
  let sc = 1;
  for (const L of T.land) {
    if (t >= L && t < L + 12) sc = Math.max(sc, t < L + 2 ? lerp(1, 1.14, EASE.brake((t - L) / 2)) : lerp(1.14, 1, spr(t, L + 2, SPR.snap)));
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, baseline - cap * 1.45, w + 8, cap * 1.75);
  ctx.clip();
  ctx.translate(x + w / 2, baseline - cap / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(x + w / 2), -(baseline - cap / 2));
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setType(ctx, style);
  const off = cap * 1.5;
  if (k < 1) ctx.fillText(prev, x + (w - ctx.measureText(prev).width) / 2, baseline - off * k);
  ctx.fillText(cur, x + (w - ctx.measureText(cur).width) / 2, baseline + off * (1 - k));
  ctx.restore();
}

// ─── desenrollado ────────────────────────────────────────────────────────────
// El cuerpo crece desde el rect del tile hasta la tarjeta (glide, 5 f desde
// medio frame después del contacto). Cada glifo sube cuando el borde del
// cuerpo lo alcanza: el texto aparece con el gesto, no después de él.
const UNROLL = { delay: 0.5, dur: 5 };
const unrollK = (u) => EASE.glide(clamp((u - UNROLL.delay) / UNROLL.dur));

const invCache = new Map();
function invGlide(v) {
  const key = Math.round(v * 1000);
  let r = invCache.get(key);
  if (r !== undefined) return r;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (EASE.glide(mid) < v) lo = mid;
    else hi = mid;
  }
  r = (lo + hi) / 2;
  invCache.set(key, r);
  return r;
}
// Frame (relativo al contacto) en que el borde del cuerpo pasa por una
// fracción v de su recorrido.
const passAt = (v) => (v <= 0 ? UNROLL.delay : UNROLL.delay + UNROLL.dur * invGlide(clamp(v)));

const TILE_R = CARD.x + TILE.dx + TILE.s; // borde derecho del tile (x 1360)
const TILE_B = TILE.dy + TILE.s; // borde inferior del tile, relativo (96)

// Texto de tarjeta en su lugar final; cada glifo sube 10 px (glide, 3 f)
// cuando el borde lo alcanza. lineTop: y relativa de la tinta más alta.
function revealText(ctx, text, x, baseline, style, color, t, L, lineTop) {
  const lay = glyphs(ctx, text, style);
  const ty = lineTop > TILE_B ? passAt((lineTop - TILE_B) / (CARD.h - TILE_B)) : 0;
  const lastX = x + lay.items[lay.items.length - 1].x;
  const tLast = L + Math.max(ty, passAt((lastX - TILE_R) / (CARD.x + CARD.w - TILE_R))) + 0.3;
  if (t >= tLast + 3) {
    drawText(ctx, text, x, baseline, style, { color });
    return;
  }
  kinetic(
    ctx,
    text,
    x,
    baseline,
    style,
    (i, g) => {
      const tx = passAt((x + g.x + g.w / 2 - TILE_R) / (CARD.x + CARD.w - TILE_R));
      const s = L + Math.max(tx, ty) + 0.3;
      if (t < s) return { alpha: 0 };
      return { dy: 10 * (1 - EASE.glide(clamp((t - s) / 3))), alpha: clamp((t - s) / 1.5) };
    },
    { color },
  );
}

// Hueco punteado de la tarjeta k (antes de que aterrice su punto).
function slot(ctx, k, t, alpha) {
  if (alpha <= 0.001) return;
  const R = cardRect(k);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.setLineDash([0.1, 11]);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = "#dccbb6";
  rr(ctx, R.x + 1.6, R.y + 1.6, R.w - 3.2, R.h - 3.2, R.r);
  ctx.stroke();
  // El tile punteado adentro, donde va a caer el punto.
  const [cx, cy] = tileCenter(k);
  rr(ctx, cx - TILE.s / 2, cy - TILE.s / 2, TILE.s, TILE.s, TILE.r);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCard(ctx, k, t) {
  const st = tileState(k, t);
  if (!st) return;
  const c = CARDS[k];
  const R = cardRect(k);
  const { u } = st;
  // Cuerpo: se desenrolla desde el tile hacia la derecha.
  const ku = unrollK(u);
  const body = lerpRect({ ...st.rect, r: st.rect.r }, R, ku);
  whiteCard(ctx, body, { lift: 0.3, shadow: ku });

  // Contenido recortado al cuerpo.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(body.x, body.y, body.w, body.h, Array.isArray(body.r) ? body.r : [body.r, body.r, body.r, body.r]);
  ctx.clip();
  const x = R.x;
  const y = R.y;
  const L = T.land[k];
  // Separador y chevron como en la app.
  const div = prog(t, L + 1.5, L + 5.5, EASE.pen);
  if (div > 0) {
    ctx.fillStyle = "#f1ece3";
    ctx.fillRect(x + 24, y + 106, 424 * div, 1.5);
  }
  icon(ctx, "chevron-right", x + 446, y + 46, 22, { color: "#c9bfb2", width: 2.2, progress: prog(t, L + 2, L + 5, EASE.pen) });
  revealText(ctx, c.title, x + 120, y + 54, { size: 28, weight: 800, tracking: 0 }, COL.ink, t, L, 33);
  revealText(ctx, c.label, x + 120, y + 86, { size: 20, weight: 700, tracking: 0 }, COL.mute, t, L, 72);
  revealText(ctx, c.meta, x + 24, y + 136, { size: 20, weight: 500, tracking: 0 }, COL.mute, t, L, 122);
  ctx.restore();

  // Tile encima, con el ícono blanco que se traza.
  drawRect(ctx, st.rect, { fill: c.tile });
  const ip = prog(t, T.land[k] + 1, T.land[k] + 6, EASE.pen);
  if (ip > 0) icon(ctx, c.icon, st.cx, st.cy, 38 * (st.rect.w / TILE.s), { color: "#ffffff", width: 2.4, progress: ip });
  // Golpe del aterrizaje.
  ring(ctx, t, T.land[k], st.cx, st.cy, 44, c.tile);
}

// ─── panel completo ──────────────────────────────────────────────────────────

// Encabezado, huecos y tarjetas (todo lo que va adentro del panel), en
// coordenadas de mundo.
function panelInner(ctx, t) {
  // Encabezado: sube 12 px (glide) desde f264.
  const hk = prog(t, T.header, T.header + 6, EASE.glide);
  const ha = prog(t, T.header, T.header + 3);
  if (ha > 0) {
    ctx.save();
    ctx.globalAlpha *= ha;
    ctx.translate(0, 12 * (1 - hk));
    const hs = { size: 40, weight: 800, tracking: -0.01 };
    const w1 = drawText(ctx, HEADER.text, HEADER.x, HEADER.baseline, hs, { color: COL.ink }).width;
    const ms = { size: 40, weight: 500, tracking: 0 };
    const w2 = drawText(ctx, " · ", HEADER.x + w1, HEADER.baseline, ms, { color: COL.mute }).width;
    headerCount(ctx, t, HEADER.x + w1 + w2, HEADER.baseline, ms, COL.mute);
    ctx.restore();
  }
  // Huecos punteados (aparecen con 1,5 f de stagger) y tarjetas.
  for (let k = 0; k < 3; k++) {
    const t0 = T.header + 1 + 1.5 * k;
    const st = tileState(k, t);
    const gone = st ? EASE.glide(clamp((st.u - 0.5) / 4)) : 0;
    slot(ctx, k, t, prog(t, t0, t0 + 4) * (1 - gone));
  }
  for (let k = 0; k < 3; k++) drawCard(ctx, k, t);
}

// Dibuja el panel en coordenadas de mundo. opts.slide = false lo deja en su
// rect del contrato aunque t sea anterior a f268.
export function drawPanel(ctx, t, { slide = true, alpha = 1 } = {}) {
  if (t < T.panelIn || alpha <= 0.001) return;
  const dx = slide ? panelSlide(t) : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(dx, 0);
  // Mientras viaja, la sombra se levanta y se ablanda.
  const lift = 1 + 0.6 * (dx / 560);
  whiteCard(ctx, PANEL, { lift });
  panelInner(ctx, t);
  ctx.restore();
}

// Para S6 (T13'): el contenido vivo del panel en coordenadas locales
// (0,0)-(520,640), con el fondo blanco lleno y sin sombra, igual que
// drawPanelContent de s6-panel.js. Reemplazarlo por drawPanelLocal(c, t) deja
// que la tercera tarjeta (que aterriza en f280) siga abriéndose mientras el
// panel se achica, en vez de aparecer entera de golpe en f281.
export function drawPanelLocal(ctx, t) {
  ctx.save();
  ctx.fillStyle = COL.card;
  ctx.fillRect(0, 0, PANEL.w, PANEL.h);
  ctx.translate(-PANEL.x, -PANEL.y);
  panelInner(ctx, Math.max(t, T.handoff));
  ctx.restore();
}

export { PANEL };
