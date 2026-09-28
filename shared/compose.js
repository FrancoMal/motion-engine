// Composición de una pieza a partir de escenas (tratamiento final 7.2).
//
// Cada escena es un módulo con:
//   { id, start, end,            // frames; se pueden solapar
//     draw(ctx, t),              // mundo y campo de la escena
//     drawTop?(ctx, t),          // capa de pantalla (frases) que va ARRIBA de
//                                //   las escenas siguientes durante el solape
//     topEnd?,                   // hasta cuándo se llama drawTop (default end)
//     motion?(t) -> {shutter, samples},
//     field?(t) -> {papel, acento, noche, crema} | null,  // pesos del grade
//     phrases?: [{id, words, R, L}], hits?: [{f, level, kind}] }
//
// La pieza decide el orden de dibujo y las máscaras de las costuras con su
// propio `draw` (ver pieces/*/index.js); este módulo da las utilidades comunes:
// quién está activo, motion blur como el máximo de las escenas activas y grade
// según quién es dueño del campo.

import { blend } from "./grade-presets.js";

export const active = (sc, t) => t >= sc.start - 1 && t < sc.end;
export const activeTop = (sc, t) => sc.drawTop && t >= sc.start - 1 && t < (sc.topEnd ?? sc.end);

// Motion blur: el pedido más exigente entre las escenas activas en el frame.
export function motionOf(scenes, f, fallback = { shutter: 0.5, samples: 8 }) {
  let best = null;
  for (const sc of scenes) {
    if (!active(sc, f) || !sc.motion) continue;
    const m = sc.motion(f);
    if (!m) continue;
    if (!best) best = { ...m };
    else {
      best.shutter = Math.max(best.shutter ?? 0.5, m.shutter ?? 0.5);
      best.samples = Math.max(best.samples ?? 8, m.samples ?? 8);
    }
  }
  return best ?? fallback;
}

// Grade: el campo lo define la última escena activa (en orden de la lista) que
// devuelve pesos. La escena que produce un cambio de campo devuelve la mezcla
// por cobertura durante su transición.
export function fieldOf(scenes, f, fallback = { papel: 1 }) {
  let w = null;
  for (const sc of scenes) {
    if (!active(sc, f) || !sc.field) continue;
    const v = sc.field(f);
    if (v) w = v;
  }
  return w ?? fallback;
}

// Grade completo del frame: campo + aberraciones del cupo + golpe de grano en
// los downbeats de compás (x1,3 durante 1 frame).
export function gradeOf(scenes, f, { caFrames = {}, bar = 56 } = {}) {
  const weights = fieldOf(scenes, f);
  let ca = 0;
  for (const [H, amp] of Object.entries(caFrames)) {
    const k = f - Number(H);
    if (k === 0) ca = Math.max(ca, amp);
    else if (k === 1) ca = Math.max(ca, amp * 0.5);
    else if (k === 2) ca = Math.max(ca, amp * 0.1875);
  }
  const grainBump = f % bar === 0 ? 1.3 : 1;
  return blend(weights, { ca, grainBump });
}

// Escena provisoria: pinta un campo con su nombre para que la composición
// corra mientras la escena real no existe.
export function stubScene({ id, start, end, color = "#e7dfd1", ink = "#1c1917", field = { papel: 1 } }) {
  return {
    id,
    start,
    end,
    stub: true,
    draw(ctx, t) {
      ctx.fillStyle = color;
      ctx.fillRect(-4000, -4000, 12000, 12000);
      ctx.fillStyle = ink;
      ctx.font = "48px Manrope";
      ctx.fontVariationSettings = '"wght" 700';
      ctx.fillText(`${id}  f${Math.floor(t)}  (escena provisoria)`, 80, 1000);
    },
    motion: () => ({ shutter: 0.5, samples: 2 }),
    field: () => field,
    phrases: [],
    hits: [],
  };
}
