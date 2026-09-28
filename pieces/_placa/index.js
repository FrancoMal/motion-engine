// Banco de prueba de la placa final (no entregable): llega un punto sintético
// que cumple el contrato de f358 y a partir de ahí corre la placa compartida.
import EndCard, { contract } from "../../shared/endcard.js";
import { blend } from "../../shared/grade-presets.js";
import { drawDot } from "../../shared/phrase.js";
import { C } from "../../shared/brand.js";

function draw(ctx, t) {
  if (t >= 358) return EndCard.draw(ctx, t);
  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, 1920, 1080);
  const k = 358 - t;
  const { x, y, d, v } = contract.dot;
  drawDot(ctx, x - v[0] * k, y - v[1] * k, d, C.accent);
}

export default {
  id: "_placa", width: 1920, height: 1080, fps: 30, duration: 450,
  draw,
  motion: (f) => (f >= 350 ? EndCard.motion(f) : { shutter: 0.75, samples: 12 }),
  grade: (f) => blend({ papel: 1 }, { ca: EndCard.caAt(f) }),
};
