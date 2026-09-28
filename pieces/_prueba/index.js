// Pieza de prueba del motor: no es entregable. Ejercita motion blur, texto
// cinético, el logo, una tarjeta 3D, paralaje y grade para validar el pipeline.

import { E, SPRING, kf, prog, spring, stagger, tween } from "../../engine/ease.js";
import { camera, layer, card3d, offscreen } from "../../engine/camera.js";
import { kinetic, drawText } from "../../engine/text.js";
import { clamp, deg } from "../../engine/math.js";
import { C, drawMark } from "../../shared/brand.js";

function scene(ctx, t) {
  const cam = camera({
    x: kf(t, [[0, -120], [40, 0, E.outExpo], [70, 0], [78, 900, E.whip]]),
    y: 0,
    z: tween(t, 0, 90, 0, 120, E.inOutCubic),
  });

  ctx.fillStyle = C.surface;
  ctx.fillRect(0, 0, 1920, 1080);

  // Capa lejana: puntos grandes y blandos del acento (profundidad).
  layer(ctx, cam, 900, (c) => {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(194,65,12,${0.06 + (i % 3) * 0.02})`;
      c.beginPath();
      c.arc(-200 + i * 300, 300 + (i % 2) * 420, 90 + (i % 4) * 30, 0, Math.PI * 2);
      c.fill();
    }
  });

  // Capa media: tipografía cinética con stagger y overshoot.
  layer(ctx, cam, 0, (c) => {
    kinetic(c, "Vos observás.", 960, 520, { size: 200, weight: 800, tracking: -0.04 }, (i, g, n) => {
      const st = 6 + stagger(i, n, 1.6);
      const p = spring(t - st, SPRING.pop);
      return {
        dy: (1 - p) * 140,
        alpha: clamp(p * 3),
        scale: 0.6 + 0.4 * p,
        weight: tween(t, st, st + 18, 300, 800, E.outCubic),
      };
    }, { align: "center", color: C.ink });
    drawText(c, "trazoinicial.com", 960, 640, { size: 44, weight: 500, tracking: 0 }, { align: "center", color: C.inkSoft });
  });

  // Capa cercana: logo que se dibuja.
  layer(ctx, cam, -300, (c) => {
    drawMark(c, 1500, 820, 220, {
      solid: prog(t, 10, 34, E.outExpo),
      dots: prog(t, 26, 40, E.linear),
      bar: prog(t, 30, 40, E.outExpo),
      stem: prog(t, 34, 44, E.outCubic),
      swash: prog(t, 40, 52, E.outCubic),
    });
  });

  // Tarjeta 3D girando sobre Y.
  const { canvas, ctx: cc } = offscreen("card", 640, 360);
  cc.fillStyle = "#fff";
  cc.beginPath();
  cc.roundRect(0, 0, 640, 360, 28);
  cc.fill();
  drawText(cc, "Formación Personal y Social", 40, 80, { size: 34, weight: 700 }, { color: C.ink });
  drawText(cc, "Sofía participa activamente", 40, 150, { size: 30, weight: 400 }, { color: C.inkSoft });
  card3d(ctx, cam, canvas, { x: 420, y: 800, z: 200, w: 640, h: 360, ry: deg(tween(t, 0, 90, 70, -20, E.inOutCubic)), rx: deg(8) });
}

export default {
  id: "_prueba",
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 90,
  draw: scene,
  motion: (f) => (f >= 70 ? { samples: 24, shutter: 0.5 } : { samples: 8, shutter: 0.5 }),
  grade: (f) => ({
    vignette: 0.18,
    grain: 0.035,
    tone: { lift: [0.02, 0.012, 0.008], gain: [1, 0.995, 0.975], contrast: 0.08 },
    bloom: { threshold: 0.9, strength: 0.25, radius: 16 },
  }),
};
