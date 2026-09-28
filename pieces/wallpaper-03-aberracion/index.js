// Wallpaper 03 · aberración: intermedia. Los tubos son tres copias de canal
// (rojo, verde, azul) que llegan separadas, se funden en el golpe y se vuelven
// a abrir al drenar; halo de color sangrado.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-03-aberracion",
  seed: 303,
  width: 34, body: 0.9, core: 0.75, coreWhite: 0.4, coreWidth: 0.32,
  glow: 0.5, emissive: 1, glowRadii: [18, 60], glowAmounts: [0.55, 0.35],
  breathe: 0.05, sway: 3, flash: 0.9,
  pulses: 1, pulsePeriod: 70, pulseAmt: 0.7, wave: 0.6,
  guide: 0.7, threads: 14, chargeGlow: 0.7, shock: 0.7,
  shards: 20, shardAlpha: 0.85, speedLines: 8, speedAlpha: 0.6,
  drops: 20, drops2: 0.8, dust: 26, dustAlpha: 0.14,
  glitch: 3, caBase: 4, caSpike: 10,
  rgbSplit: 30, rgbLife: 7,
});
