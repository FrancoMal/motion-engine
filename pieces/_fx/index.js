// Control de efectos (no entregable): máscara por trazo, blur de capa, light leak.
import { masked, blurred, lightLeak } from "../../engine/fx.js";
import { kinetic, drawText } from "../../engine/text.js";
import { shapeOf, tracePortion } from "../../engine/paths.js";
import { prog, E } from "../../engine/ease.js";
import { C } from "../../shared/brand.js";

function draw(ctx, t) {
  ctx.fillStyle = C.surface; ctx.fillRect(0, 0, 1920, 1080);
  blurred(ctx, "bg", 14, (c) => { drawText(c, "Sala Verde", 200, 300, { size: 180, weight: 800 }, { color: C.borderStrong }); });
  masked(ctx, "swash", (m) => {
    m.lineCap = "round"; m.lineWidth = 260; m.strokeStyle = "#000"; m.beginPath();
    tracePortion(m, shapeOf("M -100 900 C 500 700, 900 1100, 1300 600 S 1900 200, 2100 300", 0.2), 0, prog(t, 0, 30, E.inOutCubic)); m.stroke();
  }, (c) => { c.fillStyle = C.dSurface; c.fillRect(0, 0, 1920, 1080); drawText(c, "Trazo Inicial redacta.", 960, 600, { size: 150, weight: 800, tracking: -0.04 }, { align: "center", color: C.dInk }); });
  lightLeak(ctx, t, { intensity: 0.5 });
}
export default { id: "_fx", width: 1920, height: 1080, fps: 30, duration: 40, draw, motion: () => ({ samples: 4, shutter: 0.5 }) };
