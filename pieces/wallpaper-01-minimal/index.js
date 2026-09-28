// Wallpaper 01 · minimal: muy oscura, casi su fondo actual con oficio. Pocos
// hilos, sin esquirlas ni glitch, bloom bajo, un pulso lento por tubo.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-01-minimal",
  seed: 101,
  width: 22, body: 0.8, core: 0.35, coreWhite: 0.12, coreWidth: 0.3,
  glow: 0.22, emissive: 0.55, breathe: 0.04, sway: 2, flash: 0.6,
  pulses: 1, pulsePeriod: 90, pulseAmt: 0.5, wave: 0,
  guide: 0.5, threads: 6, chargeGlow: 0.4, shock: 0,
  shards: 0, shardAlpha: 0, speedLines: 0, speedAlpha: 0,
  drops: 10, drops2: 0.6, dust: 18, dustAlpha: 0.12,
  glitch: 0, caSpike: 0,
});
