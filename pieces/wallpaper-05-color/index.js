// Wallpaper 05 · color: tubos gruesos y saturados que se suman donde se cruzan,
// halos de color grandes, y las dos X laten alternadas.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-05-color",
  seed: 505,
  width: 46, body: 1, core: 0.7, coreWhite: 0.2, coreWidth: 0.3,
  glow: 1.1, emissive: 1.5, glowRadii: [22, 80], glowAmounts: [0.8, 0.5],
  additive: true, alternate: 0.35, breathe: 0.08, sway: 3, flash: 0.8,
  pulses: 2, pulsePeriod: 65, pulseAmt: 0.8, wave: 0.8,
  guide: 0.6, threads: 16, chargeGlow: 0.9, shock: 0.8,
  shards: 24, shardAlpha: 0.9, speedLines: 10, speedAlpha: 0.6,
  drops: 26, drops2: 0.9, dust: 24, dustAlpha: 0.14,
  glitch: 0, caSpike: 3,
});
