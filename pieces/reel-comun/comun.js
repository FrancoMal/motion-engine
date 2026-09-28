// Lo común de los reels verticales (1080x1920, nativos, no adaptados).
//
// Un reel es marketing, no tutorial: titulares cinéticos arriba, la interfaz
// real de la app en el medio como objetos que se transforman (una tarjeta se
// vuelve documento, el documento se vuelve archivo, el archivo se vuelve
// informe) y la placa final de siempre. Todo dentro de la zona segura de
// Instagram: nada crítico arriba de y 269 ni abajo de y 1536.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadImage } from "@napi-rs/canvas";
import { C } from "../../shared/brand.js";
import { EndCard } from "../../shared/endcard.js";
import { clamp, lerp, noise1 } from "../../engine/math.js";
import { E } from "../../engine/ease.js";
import { drawText, textWidth } from "../../engine/text.js";

export const RW = 1080;
export const RH = 1920;
export const SAFE = { top: 269, bottom: 1536, left: 72, right: 1008 };
export const FPS = 30;

// Grilla musical de los reels: 100 BPM, 4/4. Un beat son 18 frames exactos
// (0,6 s) y un compás 72 (2,4 s), contados desde el frame 0 del video. Los
// golpes visuales caen en beats o medios beats; la música se genera a este
// tempo con el primer tiempo en el frame 0.
export const BPM = 100;
export const BEAT = 18;
export const BAR = 72;

// Badge oficial de Google Play (arte de Google, sin modificar):
// assets/brand/google-play-badge-es-419.png.
const here = path.dirname(fileURLToPath(import.meta.url));
const BADGE = await loadImage(fs.readFileSync(path.join(here, "../../assets/brand/google-play-badge-es-419.png")));

export const p = (t, a, b, ease = (u) => u) => ease(clamp((t - a) / (b - a)));

// Escala de la interfaz: 1 px CSS = U px de pantalla. Con U = 2.4 una columna
// de 390 px CSS (el ancho de un celular) ocupa 936 px: el ancho útil.
export const U = 2.4;

// Fondo: papel con dos manchas tibias que derivan (paralaje lento) y una
// retícula de puntos muy suave.
export function backdrop(ctx, t, { warm = 1 } = {}) {
  ctx.fillStyle = C.surface;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  const blobs = [
    { x: 860, y: 520, r: 620, a: 0.5, s: 3 },
    { x: 200, y: 1420, r: 700, a: 0.38, s: 7 },
  ];
  for (const b of blobs) {
    const x = b.x + 60 * noise1(t / 90, b.s);
    const y = b.y + 50 * noise1(t / 110, b.s + 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0, `rgba(253,233,211,${b.a * warm})`);
    g.addColorStop(1, "rgba(253,233,211,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-4000, -4000, 12000, 12000);
  }
  ctx.save();
  ctx.fillStyle = "rgba(214,205,186,0.35)";
  const off = (t * 0.25) % 48;
  for (let y = -48 + off; y < RH + 48; y += 48) for (let x = 24; x < RW; x += 48) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Escenario de interfaz: dibuja fn en px CSS con el origen en (cx, cy) de
// pantalla, a escala U * s, con rotación y opacidad.
export function stage(ctx, { cx, cy, s = 1, rot = 0, alpha = 1 }, fn) {
  if (alpha <= 0.002 || s <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(U * s, U * s);
  fn(ctx);
  ctx.restore();
}

// Sombra de tarjeta flotante (en el espacio donde se dibuja).
export function floatShadow(ctx, x, y, w, h, r, lift = 1) {
  ctx.save();
  ctx.shadowColor = `rgba(28,25,23,${0.1 + 0.06 * lift})`;
  ctx.shadowBlur = 18 * lift;
  ctx.shadowOffsetY = 8 * lift;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

// Placa final compartida, llevada al lienzo vertical con el mismo encuadre que
// usan las verticales aprobadas (el mundo 1920x1080 a escala 0.9).
export const PLACA = { cx: 960, cy: 545, s: 0.9, vy: 902 };
export const placaPt = (x, y) => [RW / 2 + (x - PLACA.cx) * PLACA.s, PLACA.vy + (y - PLACA.cy) * PLACA.s];
// Punto de entrada de la placa (contrato de f358) en pantalla.
export const PLACA_DOT = (() => {
  const [x, y] = placaPt(EndCard.contract.dot.x, EndCard.contract.dot.y);
  return { x, y, d: EndCard.contract.dot.d * PLACA.s };
})();
// f0: frame del reel en que arranca la placa. La placa (historia 358-450) se
// estira un poco y se sostiene al final.
// badge: suma "Descargar en Google Play" debajo de la dirección (solo reels).
export function drawPlaca(ctx, f, f0, dur = 96, { badge = true, cta = null } = {}) {
  const st = Math.min(449.5, 358 + ((f - f0) * 92) / dur);
  ctx.save();
  ctx.translate(RW / 2, PLACA.vy);
  ctx.scale(PLACA.s, PLACA.s);
  ctx.translate(-PLACA.cx, -PLACA.cy);
  EndCard.draw(ctx, st);
  ctx.restore();
  if (badge) {
    // Entra cuando la dirección ya se asentó (historia 408), con un leve ascenso.
    const k = E.outCubic(clamp((st - 410) / 12));
    if (k > 0.002) {
      const h = 116;
      const w = (h * BADGE.width) / BADGE.height;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.drawImage(BADGE, RW / 2 - w / 2, 1262 + 18 * (1 - k), w, h);
      ctx.restore();
    }
  }
  // cta: una línea de llamado a la acción debajo del badge, en una pastilla
  // tibia. Solo la usa la pieza de cierre ("Probalo con tu sala").
  if (cta) {
    const k = E.outCubic(clamp((st - 418) / 12));
    if (k > 0.002) {
      ctx.save();
      ctx.globalAlpha *= k;
      const st2 = { size: 46, weight: 700, tracking: -0.01 };
      const w = textWidth(ctx, cta, st2) + 88;
      const y = 1414 + 16 * (1 - k);
      ctx.beginPath();
      ctx.roundRect(RW / 2 - w / 2, y, w, 96, 48);
      ctx.fillStyle = C.accent;
      ctx.fill();
      drawText(ctx, cta, RW / 2, y + 64, st2, { align: "center", color: "#ffffff" });
      ctx.restore();
    }
  }
}
export const placaStory = (f, f0, dur = 96) => Math.min(449.5, 358 + ((f - f0) * 92) / dur);

export { C, E, lerp, clamp };
