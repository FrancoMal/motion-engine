// Wallpaper 07 · entorno: la misma construcción desde los costados, con el
// espacio alrededor de las X vivo: partículas en órbita, ondas que irradian
// de los cruces, arcos eléctricos entre las dos X, circuito y un resplandor de
// color que se derrama.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-07-entorno",
  seed: 707,
  formation: "sides", segments: 8,
  width: 34, body: 0.95, core: 0.85, coreWhite: 0.45, coreWidth: 0.32,
  glow: 0.7, emissive: 1.2, glowRadii: [16, 52], breathe: 0.06, sway: 0, flash: 1.1,
  pulses: 2, pulsePeriod: 60, pulseAmt: 0.8, wave: 1,
  threads: 0, chargeGlow: 0.9, shock: 1,
  shards: 30, shardAlpha: 0.9, speedLines: 14, speedAlpha: 0.7,
  sparks: 40, drops: 0, dust: 30, dustAlpha: 0.16,
  glitch: 3, caSpike: 6,
  env: { circuit: 10, circuitAlpha: 0.14, pulse: 0.6, spill: 0.2, spillR: 640, orbit: 170, orbitAlpha: 1, orbitSize: 1.6, rings: 0.8, ringCount: 7, arcs: 9 },
});
