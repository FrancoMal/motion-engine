// Wallpaper 06 · costados: las X se van armando con segmentos que entran
// volando desde los bordes laterales y se acoplan apagados; a los 3 s se
// encienden enteras. Entorno contenido: un circuito fino que también llega
// desde los costados, pulsos de datos que corren por él y un resplandor suave.
import { makeWallpaper } from "../wallpaper-comun/core.js";

export default makeWallpaper({
  id: "wallpaper-06-costados",
  seed: 606,
  formation: "sides", segments: 6,
  width: 32, body: 0.9, core: 0.8, coreWhite: 0.42, coreWidth: 0.32,
  glow: 0.55, emissive: 1, breathe: 0.05, sway: 0, flash: 0.9,
  pulses: 1, pulsePeriod: 70, pulseAmt: 0.7, wave: 0.7,
  threads: 0, chargeGlow: 0.6, shock: 0.6,
  shards: 0, speedLines: 0, drops: 0, dust: 16, dustAlpha: 0.1,
  glitch: 1, caSpike: 3,
  env: { circuit: 20, circuitAlpha: 0.55, pulse: 1, spill: 0.05, spillR: 420, orbit: 0, orbitAlpha: 0, rings: 0, arcs: 0 },
});
