// Wallpaper 04 · energía: la más luminosa. Núcleos casi blancos, bloom grande,
// destello fuerte en el golpe. La franja del reloj va más apagada que en las
// demás para compensar.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-04-energia",
  seed: 404,
  width: 36, body: 1, core: 1, coreWhite: 0.75, coreWidth: 0.45,
  glow: 1, emissive: 1.6, glowRadii: [16, 56], glowAmounts: [0.7, 0.4],
  breathe: 0.06, sway: 3, flash: 1.6,
  pulses: 3, pulsePeriod: 55, pulseAmt: 1, wave: 1.4,
  guide: 0.8, threads: 20, chargeGlow: 1.4, shock: 1.3,
  shards: 45, shardAlpha: 1, speedLines: 34, speedAlpha: 1,
  drops: 30, drops2: 1, dust: 30, dustAlpha: 0.25,
  glitch: 2, caSpike: 5, clockGain: 0.22,
});
