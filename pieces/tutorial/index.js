// Tutorial: cómo crear los informes de tu sala en Trazo Inicial, paso a paso.
//
// No es un showreel: el movimiento está para dirigir la mirada al lugar exacto
// donde se toca. Los pasos van numerados a la izquierda, la app se ve literal
// en la ventana, la cámara se acerca a lo que hay que tocar y abajo queda
// escrito qué hacer. El guion (tiempos, toques, indicaciones) vive en
// script.js y es la misma fuente para los efectos de sonido.

import { C, drawMark } from "../../shared/brand.js";
import { OUT_W, OUT_H } from "../../engine/format.js";
import { gradeOf } from "../../shared/compose.js";
import { clamp, lerp } from "../../engine/math.js";
import { E } from "../../engine/ease.js";
import { SCREENS } from "./screens.js";
import { txt } from "./app-ui.js";
import {
  LAYOUT, VIEW, backdrop, windowChrome, drawScreen, rail, caption, cursor, clickRing, highlight, spotlight, stepCard, toScreen,
} from "./frame.js";
import {
  STEP_T, OUTRO_T, DURATION_S, CARD_DUR, shotAt, camAt, captionAt, cursorAt, clickAt, highlightsAt, dragsAt, p,
} from "./script.js";

const FPS = 30;

// Rect de página → pantalla con la cámara.
function screenRect(cam, r) {
  const [x0, y0] = toScreen(cam, r.x, r.y);
  const [x1, y1] = toScreen(cam, r.x + r.w, r.y + r.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function stepIndex(s) {
  let i = -1;
  for (let k = 0; k < STEP_T.length; k++) if (s >= STEP_T[k]) i = k;
  return i;
}

// ─── entrada y cierre ────────────────────────────────────────────────────────
function intro(ctx, s) {
  if (s >= 5.4) return;
  // Se va del todo antes de que entre la lista de pasos (nunca dos títulos a la vez).
  const a = E.outCubic(p(s, 0.2, 1.1)) * (1 - E.inCubic(p(s, 4.0, 4.7)));
  const dy = -30 * E.inCubic(p(s, 4.0, 4.7));
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(0, dy);
  const mk = p(s, 0.3, 1.9);
  drawMark(ctx, 960, 318, 150, { solid: E.inOutCubic(p(mk, 0.1, 0.7)), dots: p(mk, 0, 0.4), bar: E.outCubic(p(mk, 0.6, 0.8)), stem: E.outCubic(p(mk, 0.7, 0.9)), swash: E.outCubic(p(mk, 0.85, 1)) });
  const t1 = E.outCubic(p(s, 0.6, 1.4));
  ctx.save();
  ctx.globalAlpha *= t1;
  txt(ctx, "Cómo crear los informes", 960, 520 + 20 * (1 - t1), 84, 800, C.ink, "center", -0.03);
  txt(ctx, "de tu sala", 960, 616 + 20 * (1 - t1), 84, 800, C.ink, "center", -0.03);
  ctx.restore();
  const t2 = E.outCubic(p(s, 1.3, 2.0));
  ctx.save();
  ctx.globalAlpha *= t2;
  txt(ctx, "Paso a paso, en Trazo Inicial", 960, 704, 36, 600, C.inkSoft, "center");
  ctx.restore();
  ctx.restore();
}

function outro(ctx, s) {
  if (s < OUTRO_T + 0.4) return;
  const a = E.outCubic(p(s, OUTRO_T + 0.4, OUTRO_T + 1.2));
  ctx.save();
  ctx.globalAlpha *= a;
  const mk = p(s, OUTRO_T + 0.4, OUTRO_T + 2.2);
  drawMark(ctx, 960, 330, 150, { solid: E.inOutCubic(p(mk, 0.1, 0.7)), dots: p(mk, 0, 0.4), bar: E.outCubic(p(mk, 0.6, 0.8)), stem: E.outCubic(p(mk, 0.7, 0.9)), swash: E.outCubic(p(mk, 0.85, 1)) });
  const c1 = E.outCubic(p(s, OUTRO_T + 1.0, OUTRO_T + 1.8));
  ctx.save();
  ctx.globalAlpha *= c1;
  txt(ctx, "Vos observás.", 960, 540 + 16 * (1 - c1), 80, 600, C.ink, "center", -0.03);
  txt(ctx, "Trazo Inicial redacta.", 960, 640 + 16 * (1 - c1), 80, 800, C.ink, "center", -0.03);
  ctx.restore();
  const c2 = E.outCubic(p(s, OUTRO_T + 2.0, OUTRO_T + 2.8));
  ctx.save();
  ctx.globalAlpha *= c2;
  txt(ctx, "trazoinicial.com", 960, 744, 40, 600, C.inkSoft, "center");
  ctx.restore();
  ctx.restore();
}

// ─── archivo arrastrado a la zona de carga ───────────────────────────────────
function dragCard(ctx, d, s, cam) {
  const k = E.inOutCubic(p(s, d.t0, d.t1));
  const to = screenRect(cam, { ...d.to, y: d.to.y });
  const tx = to.x + to.w / 2;
  const ty = to.y + to.h / 2;
  const fx = VIEW.x + VIEW.w + 120;
  const fy = VIEW.y + VIEW.h - 40;
  const x = lerp(fx, tx, k);
  const y = lerp(fy, ty, k) - Math.sin(Math.PI * k) * 90;
  const a = p(s, d.t0 - 0.3, d.t0) * (1 - p(s, d.t1 + 0.05, d.t1 + 0.35));
  if (a <= 0.002) return null;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.rotate(-0.06 * (1 - k));
  ctx.shadowColor = "rgba(28,25,23,0.25)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.roundRect(-150, -34, 300, 68, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.roundRect(-136, -22, 44, 44, 10);
  ctx.fillStyle = C.accentSoft;
  ctx.fill();
  txt(ctx, "PDF", -114, 6, 13, 800, C.accentInk, "center");
  txt(ctx, "Resumen evaluativo", -80, -2, 17, 700, C.ink);
  txt(ctx, "Medio.pdf", -80, 18, 15, 500, C.inkSoft);
  ctx.restore();
  return { x: x + 40, y: y + 10 };
}

// ─── cuadro ──────────────────────────────────────────────────────────────────
function draw(ctx, t) {
  const s = t / FPS;
  backdrop(ctx);
  intro(ctx, s);

  const out = E.inOutCubic(p(s, OUTRO_T, OUTRO_T + 0.7));
  const si = stepIndex(s);
  const slide = si >= 0 ? E.inOutCubic(p(s, STEP_T[si], STEP_T[si] + 0.5)) : 0;
  const cur = si <= 0 ? 0 : si - 1 + slide;
  rail(ctx, cur, { intro: p(s, 4.8, 6.6), alpha: 1 - out, done: si - 1 });

  const wk = E.outCubic(p(s, 5.0, 6.3));
  if (wk > 0.001 && out < 0.999) {
    ctx.save();
    ctx.globalAlpha *= wk * (1 - out);
    ctx.translate(90 * (1 - wk), 0);
    windowChrome(ctx);
    const { cur: sh, prev } = shotAt(s);
    const cam = camAt(sh, s);
    // Cambio de página como en la app: la anterior se va, un instante de
    // fondo y entra la nueva. Nunca se ven dos pantallas superpuestas.
    const gone = prev ? E.inCubic(p(s, sh.t0, sh.t0 + 0.13)) : 1;
    const fade = prev ? E.outCubic(p(s, sh.t0 + 0.1, sh.t0 + 0.32)) : 1;
    if (prev && gone < 1) drawScreen(ctx, SCREENS[prev.screen], { spin: 0, ...prev.state(sh.t0) }, camAt(prev, sh.t0), 1 - gone);
    if (prev && fade < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, [0, 0, 16, 16]);
      ctx.fillStyle = C.surface;
      ctx.globalAlpha *= gone;
      ctx.fill();
      ctx.restore();
    }
    drawScreen(ctx, SCREENS[sh.screen], { spin: 0, ...sh.state(s) }, cam, fade);

    // Resaltados y velo.
    // Cada resaltado pertenece a su toma (al cambiar de página se va con ella)
    // y nunca se dibuja fuera de la ventana.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, [0, 0, 16, 16]);
    ctx.clip();
    for (const h of highlightsAt(s).filter((h) => h.t0 >= sh.t0)) {
      const env = p(s, h.t0 - 0.2, h.t0 + 0.2) * (1 - p(s, h.t1, h.t1 + (h.tap ? 0.12 : 0.3)));
      const r = screenRect(cam, h.r);
      if (h.spot) spotlight(ctx, r, env);
      const pulse = h.soft ? 0.75 : 0.8 + 0.2 * Math.sin((s - h.t0) * 7);
      highlight(ctx, r, env * pulse, { radius: Math.min(14 * cam.z, r.h / 2) });
    }
    ctx.restore();
    // Archivo arrastrado.
    const d = dragsAt(s);
    let dragPt = null;
    if (d) dragPt = dragCard(ctx, d, s, { ...cam });
    // Cursor y toque.
    const cp = cursorAt(s);
    if (cp) {
      let [x, y] = toScreen(cam, cp.x, cp.y);
      if (dragPt && s >= d.t0 && s <= d.t1 + 0.05) [x, y] = [dragPt.x, dragPt.y];
      const c = clickAt(s);
      let pr = 0;
      if (c) {
        const [cx, cy] = toScreen(cam, c.x, c.y);
        clickRing(ctx, cx, cy, p(s, c.t, c.t + 0.5));
        pr = s < c.t ? p(s, c.t - 0.12, c.t) : 1 - p(s, c.t + 0.05, c.t + 0.25);
      }
      const ca = p(s, 7.6, 8.0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(VIEW.x - 40, VIEW.y - 40, VIEW.w + 80, VIEW.h + 80);
      ctx.clip();
      cursor(ctx, x, y, { press: pr, alpha: ca });
      ctx.restore();
    }
    // Tarjeta de paso.
    for (let i = 0; i < STEP_T.length; i++) {
      const a = STEP_T[i];
      if (s >= a && s < a + CARD_DUR + 0.1) stepCard(ctx, i + 1, p(s, a, a + 0.35), p(s, a + CARD_DUR - 0.4, a + CARD_DUR));
    }
    ctx.restore();
  }

  // Indicación.
  const c = captionAt(s);
  if (c && out < 1) {
    if (c.prev && c.kOut < 1) caption(ctx, c.prev, (1 - c.kOut) * (1 - out), -8 * c.kOut);
    caption(ctx, c.text, E.outCubic(c.k) * (1 - out), 10 * (1 - E.outCubic(c.k)));
  }
  outro(ctx, s);
}

const DURATION = Math.round(DURATION_S * FPS);

export default {
  id: "tutorial",
  width: OUT_W,
  height: OUT_H,
  fps: FPS,
  duration: DURATION,
  scenes: [],
  draw,
  // Movimiento calmo: obturador corto (el texto no se lava en los zooms) y
  // muestras suficientes para que la estela no se vea escalonada.
  motion: () => ({ shutter: 0.15, samples: 6 }),
  grade: (f) => gradeOf([], f, { bar: 1e9 }),
};

export { LAYOUT };
