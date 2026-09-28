// Wallpaper 02 · detalle: oscura, el lenguaje del opening completo sobre el
// esqueleto (guía de circuito, hilos, esquirlas en tres profundidades, líneas
// de velocidad, glitch y aberración como acentos del golpe, ola de luz).
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-02-detalle",
  seed: 202,
  width: 34, body: 0.9, core: 0.85, coreWhite: 0.45, coreWidth: 0.32,
  glow: 0.6, emissive: 1, breathe: 0.06, sway: 3, flash: 1,
  pulses: 2, pulsePeriod: 60, pulseAmt: 0.8, wave: 1,
  guide: 1, guideLife: 0.9, streaks: 7, sparks: 70, threads: 22, chargeGlow: 0.8, shock: 1,
  shards: 60, shardAlpha: 0.95, speedLines: 24, speedAlpha: 0.8,
  drops: 36, drops2: 0.9, dust: 40, dustAlpha: 0.18,
  glitch: 5, caSpike: 8,
});
