// El marco del tutorial: la lista de pasos numerados, la ventana de la app con
// su cámara, la indicación de qué tocar, el cursor, el resaltado del objetivo y
// las tarjetas de paso. Nada de esto se luce: todo existe para que la mirada
// caiga en el lugar exacto donde hay que tocar.
//
// La geometría sale de LAYOUT, que depende del formato. En vertical (más
// adelante) cambia el reparto: los pasos arriba, la ventana como recorte
// ampliado de la zona donde se toca y la indicación abajo, sin encoger la
// pantalla entera.

import { Path2D } from "@napi-rs/canvas";
import { IS_V } from "../../engine/format.js";
import { C, drawMark } from "../../shared/brand.js";
import { rr, icon } from "../../shared/ui.js";
import { drawText } from "../../engine/text.js";
import { clamp, lerp, lerpLog } from "../../engine/math.js";
import { E } from "../../engine/ease.js";
import { tw, txt, sidebar, APP_W, APP_H } from "./app-ui.js";
import { wrap } from "./screens.js";

export const LAYOUT = IS_V
  ? {
      // Provisorio: la vertical se diseña en la segunda vuelta.
      rail: { x: 72, y: 280, w: 936 },
      win: { x: 40, y: 560, w: 1000, h: 700 },
      caption: { x: 72, y: 1300, w: 936, size: 44 },
    }
  : {
      rail: { x: 64, y: 0, w: 480 },
      win: { x: 600, y: 44, w: 1264, h: 846 },
      caption: { x: 600, y: 900, w: 1264, size: 38 },
    };

const BAR_H = 40; // barra del navegador
export const VIEW = (() => {
  const W = LAYOUT.win;
  return { x: W.x, y: W.y + BAR_H, w: W.w, h: W.h - BAR_H };
})();

export const STEPS = [
  "Creá tu sala",
  "Cargá tus alumnos",
  "Creá el período",
  "Revisá las áreas",
  "Completá los formularios",
  "Generá los informes",
  "Revisá y descargá",
];

// ─── cámara de la ventana ────────────────────────────────────────────────────
// cam = { sy, cx, cy, z }: sy es el scroll de la página; (cx, cy) el punto de
// la ventana (coordenadas CSS del viewport) que va al centro, z el zoom.
const BASE = VIEW.w / APP_W;
export const WIDE = (sy = 0) => ({ sy, cx: APP_W / 2, cy: APP_H / 2, z: 1 });

// Encuadre que muestra un rect de la PÁGINA lo más grande posible (hasta zMax).
export function fit(r, sy = 0, { zMax = 2, pad = 0.8 } = {}) {
  const z = clamp(Math.min((APP_W * pad) / r.w, (APP_H * pad) / r.h), 1, zMax);
  const hw = APP_W / 2 / z;
  const hh = APP_H / 2 / z;
  return { sy, cx: clamp(r.x + r.w / 2, hw, APP_W - hw), cy: clamp(r.y - sy + r.h / 2, hh, APP_H - hh), z };
}

export function camLerp(a, b, u) {
  return { sy: lerp(a.sy, b.sy, u), cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u), z: lerpLog(a.z, b.z, u, 0.01) };
}

// Página → pantalla.
export function toScreen(cam, x, y) {
  const k = cam.z * BASE;
  return [VIEW.x + VIEW.w / 2 + (x - cam.cx) * k, VIEW.y + VIEW.h / 2 + (y - cam.sy - cam.cy) * k];
}
export function applyCam(ctx, cam) {
  const k = cam.z * BASE;
  ctx.translate(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2);
  ctx.scale(k, k);
  ctx.translate(-cam.cx, -cam.cy);
}

// ─── fondo y ventana ─────────────────────────────────────────────────────────
export function backdrop(ctx) {
  ctx.fillStyle = "#efe7da";
  ctx.fillRect(-4000, -4000, 12000, 12000);
  const g = ctx.createRadialGradient(1232, 460, 80, 1232, 460, 1200);
  g.addColorStop(0, "rgba(253,233,211,0.55)");
  g.addColorStop(1, "rgba(253,233,211,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 12000, 12000);
}

export function windowChrome(ctx, alpha = 1) {
  const W = LAYOUT.win;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.save();
  ctx.shadowColor = "rgba(28,25,23,0.16)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  rr(ctx, W.x, W.y, W.w, W.h, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  // Barra del navegador con la dirección real.
  ctx.save();
  rr(ctx, W.x, W.y, W.w, W.h, 16);
  ctx.clip();
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(W.x, W.y, W.w, BAR_H);
  ctx.fillStyle = C.border;
  ctx.fillRect(W.x, W.y + BAR_H - 1, W.w, 1);
  ctx.restore();
  ["#e7dfd1", "#e7dfd1", "#e7dfd1"].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(W.x + 22 + i * 18, W.y + BAR_H / 2, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  const uw = 360;
  rr(ctx, W.x + W.w / 2 - uw / 2, W.y + 8, uw, 24, 12);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  icon(ctx, "lock", W.x + W.w / 2 - 62, W.y + BAR_H / 2, 12, { color: C.inkMute, width: 2 });
  txt(ctx, "trazoinicial.com", W.x + W.w / 2 + 6, W.y + 25, 13, 500, C.inkSoft, "center");
  ctx.restore();
}

// Dibuja una pantalla dentro de la ventana con la cámara dada.
export function drawScreen(ctx, screenFn, state, cam, alpha = 1) {
  ctx.save();
  rr(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 0);
  ctx.save();
  ctx.beginPath();
  const W = LAYOUT.win;
  ctx.roundRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, [0, 0, 16, 16]);
  ctx.clip();
  ctx.globalAlpha *= alpha;
  applyCam(ctx, cam);
  ctx.save();
  ctx.translate(0, -cam.sy);
  const r = screenFn(ctx, state);
  if (r.fixed) r.fixed(ctx, cam.sy);
  ctx.restore();
  sidebar(ctx, r.nav);
  ctx.restore();
  ctx.restore();
  void W;
  return r;
}

// ─── lista de pasos ──────────────────────────────────────────────────────────
// cur: paso actual (0..6, con decimales en la transición); intro 0..1 (entrada).
export function rail(ctx, cur, { alpha = 1, intro = 1, done = -1 } = {}) {
  const L = LAYOUT.rail;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const a0 = E.outCubic(clamp(intro));
  ctx.save();
  ctx.globalAlpha *= a0;
  drawMark(ctx, L.x + 20, 92, 40);
  txt(ctx, "Trazo", L.x + 50, 101, 22, 800, C.ink);
  txt(ctx, "Inicial", L.x + 50 + tw("Trazo", 22, 800) + 6, 101, 22, 400, C.ink);
  txt(ctx, "Cómo crear", L.x, 190, 44, 800, C.ink, "left", -0.025);
  txt(ctx, "tus informes", L.x, 242, 44, 800, C.ink, "left", -0.025);
  ctx.restore();
  const y0 = 300;
  const rowH = 82;
  // Resaltado del paso actual (se desliza entre filas).
  const hy = y0 + cur * rowH;
  if (cur >= 0) {
    ctx.save();
    ctx.globalAlpha *= a0;
    ctx.shadowColor = "rgba(124,45,18,0.10)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    rr(ctx, L.x - 16, hy, L.w, 70, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }
  STEPS.forEach((s, i) => {
    const k = clamp((intro * 9 - i) / 2);
    if (k <= 0) return;
    const y = y0 + i * rowH;
    const on = clamp(1 - Math.abs(cur - i));
    const isDone = i <= done;
    ctx.save();
    ctx.globalAlpha *= E.outCubic(k);
    ctx.translate(-20 * (1 - E.outCubic(k)), 0);
    const cx = L.x + 22;
    const cy = y + 35;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    if (isDone && on < 0.5) {
      ctx.fillStyle = C.successSoft;
      ctx.fill();
      icon(ctx, "check", cx, cy, 22, { color: C.success, width: 3 });
    } else {
      ctx.fillStyle = on > 0.5 ? C.accent : "#ffffff";
      ctx.fill();
      if (on <= 0.5) {
        ctx.strokeStyle = C.borderStrong;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      txt(ctx, String(i + 1), cx, cy + 8, 22, 800, on > 0.5 ? "#ffffff" : C.inkMute, "center");
    }
    const col = on > 0.5 ? C.ink : isDone ? C.inkSoft : C.inkMute;
    txt(ctx, s, L.x + 62, cy + 10, 28, on > 0.5 ? 800 : 600, col, "left", -0.01);
    ctx.restore();
  });
  ctx.restore();
}

// ─── indicación ──────────────────────────────────────────────────────────────
// Texto con «botones» en acento. Devuelve nada; a es la opacidad, dy el corrimiento.
// Cada tramo se ubica por el ancho del texto completo que lo precede, así los
// espacios alrededor de los «botones» quedan exactos.
function richLine(ctx, line, x, y, size) {
  const parts = line.split(/(«[^»]+»)/).filter(Boolean);
  const st = (s) => tw(s, size, 700);
  const x0 = x - st(line) / 2;
  let prefix = "";
  for (const p of parts) {
    const btnTxt = p.startsWith("«");
    const lead = p.length - p.trimStart().length;
    const at = x0 + (prefix + p.slice(0, lead) ? st(prefix + p.slice(0, lead)) : 0);
    txt(ctx, p.trimStart(), at, y, size, 700, btnTxt ? C.accent : C.ink, "left");
    prefix += p;
  }
}
export function caption(ctx, text, a = 1, dy = 0) {
  if (!text || a <= 0.002) return;
  const L = LAYOUT.caption;
  const lines = wrap(text, L.size, 700, L.w - 80);
  ctx.save();
  ctx.globalAlpha *= a;
  const lh = L.size * 1.28;
  const y0 = L.y + 70 - ((lines.length - 1) * lh) / 2 + dy;
  lines.forEach((l, i) => richLine(ctx, l, L.x + L.w / 2, y0 + i * lh, L.size));
  ctx.restore();
}

// ─── cursor y resaltado ──────────────────────────────────────────────────────
// Flecha del mouse (lucide mouse-pointer-2) en pantalla, tamaño constante.
export function cursor(ctx, x, y, { press = 0, alpha = 1 } = {}) {
  if (alpha <= 0.002) return;
  const s = 1.9 * (1 - 0.14 * press);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-4, -4);
  ctx.shadowColor = "rgba(28,25,23,0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const p = new Path2D("M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z");
  ctx.fillStyle = C.ink;
  ctx.fill(p);
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#ffffff";
  ctx.lineJoin = "round";
  ctx.stroke(p);
  ctx.restore();
}

// Onda del toque en pantalla.
export function clickRing(ctx, x, y, k) {
  if (k <= 0 || k >= 1) return;
  const e = E.outCubic(k);
  ctx.save();
  ctx.globalAlpha *= 0.55 * (1 - k);
  ctx.beginPath();
  ctx.arc(x, y, lerp(8, 54, e), 0, Math.PI * 2);
  ctx.fillStyle = C.accentSoft;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.accent;
  ctx.stroke();
  ctx.restore();
}

// Contorno de acento alrededor del objetivo (rect ya en pantalla).
export function highlight(ctx, r, a, { radius = 14, pad = 7 } = {}) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= a;
  rr(ctx, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, radius + pad);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.accent;
  ctx.shadowColor = "rgba(251,146,60,0.55)";
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.restore();
}

// Velo que oscurece todo menos el objetivo (dirige la mirada sin taparlo).
export function spotlight(ctx, r, a, { pad = 14, radius = 18 } = {}) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, [0, 0, 16, 16]);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  ctx.roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, radius);
  ctx.fillStyle = `rgba(28,25,23,${0.28 * a})`;
  ctx.fill("evenodd");
  ctx.restore();
}

// ─── tarjeta de paso ─────────────────────────────────────────────────────────
export function stepCard(ctx, n, k, out) {
  if (k <= 0.002 || out >= 0.998) return;
  const W = LAYOUT.win;
  const a = E.outCubic(clamp(k)) * (1 - E.inCubic(clamp(out)));
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = "rgba(250,246,239,0.94)";
  ctx.beginPath();
  ctx.roundRect(W.x, W.y, W.w, W.h, 16);
  ctx.fill();
  const cx = W.x + W.w / 2;
  const cy = W.y + W.h / 2;
  const dy = 24 * (1 - E.outCubic(clamp(k))) - 16 * E.inCubic(clamp(out));
  ctx.beginPath();
  ctx.arc(cx, cy - 92 + dy, 50, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  txt(ctx, String(n), cx, cy - 74 + dy, 50, 800, "#ffffff", "center");
  txt(ctx, `PASO ${n} DE 7`, cx, cy + 6 + dy, 22, 800, C.accent, "center", 0.14);
  txt(ctx, STEPS[n - 1], cx, cy + 84 + dy, 72, 800, C.ink, "center", -0.025);
  ctx.restore();
}

export { drawText };
