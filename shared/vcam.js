// Cámara vertical: cómo se ve el mundo 1920x1080 de las escenas en un lienzo
// de 1080x1920.
//
// No es un recorte fijo: cada momento tiene su encuadre (qué punto del mundo
// va al centro, a qué escala y a qué altura del lienzo), y entre momentos la
// cámara viaja con easing. Las escenas que en horizontal tienen tipografía y UI
// lado a lado, además, los apilan (desplazan grupos con `stack`), así la
// escala puede ser grande y el texto se lee en el celular.
//
// Un encuadre es { cx, cy, s, vy }: el punto (cx, cy) del mundo cae en
// (540, vy) del lienzo, con escala s.

import { clamp, lerp, lerpLog } from "../engine/math.js";
import { E } from "../engine/ease.js";

// keys: [[t, {cx, cy, s, vy}, ease?], ...] en frames de historia. El easing de
// cada key gobierna el tramo que llega a ella (default glide). La escala se
// interpola en log.
export function vcamTrack(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last[1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, b, ease = E.inOutCubic] = keys[i];
      const [t0, a] = keys[i - 1];
      if (t <= t1) {
        const u = ease(clamp((t - t0) / (t1 - t0 || 1)));
        return { cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u), s: lerpLog(a.s, b.s, u, 1e-6), vy: lerp(a.vy, b.vy, u) };
      }
    }
    return last[1];
  };
}

export function applyVcam(ctx, v) {
  ctx.translate(540, v.vy);
  ctx.scale(v.s, v.s);
  ctx.translate(-v.cx, -v.cy);
}

// Encuadre que hace entrar un rectángulo del mundo {x, y, w, h} en el ancho útil
// (936 px) y lo centra en la zona segura (o a la altura vy dada).
export function fit(rect, { width = 936, vy = 902, maxS = 2 } = {}) {
  const s = Math.min(maxS, width / rect.w);
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, s, vy };
}

// Desplazamiento de un grupo apilado, interpolable (para actores que viajan de
// un grupo a otro).
export const offAt = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
