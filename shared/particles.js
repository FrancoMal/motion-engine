// Partículas deterministas (P2 T17: el punto que estalla y arma "Toda la sala."
// en matriz de puntos). Todo es función pura del tiempo y de una semilla: el
// mismo frame da lo mismo en cualquier worker y en cualquier sub-frame.

import { createCanvas } from "@napi-rs/canvas";
import { setType } from "../engine/text.js";
import { hash2, clamp } from "../engine/math.js";
import { spring } from "../engine/ease.js";

// Puntos dentro de los glifos de un texto, en una grilla de `pitch` px.
// Devuelve coordenadas absolutas. ph es una frase de shared/phrase.js (se
// dibuja con sus posiciones fijas, sin el punto final).
const sampleCache = new Map();
export function sampleGlyphPoints(ph, pitch = 14, { threshold = 128 } = {}) {
  const key = ph.text + "|" + ph.size + "|" + ph.x + "|" + ph.baseline + "|" + pitch;
  let pts = sampleCache.get(key);
  if (pts) return pts;
  const pad = 40;
  const w = Math.ceil(ph.width + pad * 2);
  const h = Math.ceil(ph.size * 1.4);
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  const oy = ph.size * 1.05;
  ctx.fillStyle = "#000";
  for (const g of ph.glyphs) {
    setType(ctx, { size: ph.size, weight: ph.wght, tracking: 0 });
    ctx.fillText(g.ch, g.ax - ph.x + pad, oy);
  }
  const data = ctx.getImageData(0, 0, w, h).data;
  pts = [];
  for (let y = pitch / 2; y < h; y += pitch) {
    for (let x = pitch / 2; x < w; x += pitch) {
      // Grilla de a tresbolillo: más orgánico que una cuadrícula.
      const xx = x + ((Math.floor(y / pitch) % 2) * pitch) / 2;
      const i = (Math.floor(y) * w + Math.floor(xx)) * 4 + 3;
      if (xx < w && data[i] >= threshold) pts.push([ph.x - pad + xx, ph.baseline - oy + y]);
    }
  }
  sampleCache.set(key, pts);
  return pts;
}

// Estallido con retorno: cada partícula sale del origen con velocidad radial
// (con arrastre), y desde su frame de "home" un spring la lleva a su destino.
// Posición analítica (sin integrar paso a paso), para que un sub-frame no
// dependa de los anteriores.
//   origin [x, y], targets [[x, y]...], t0 frame del estallido
//   homeStart(i, target) frame en que empieza el retorno de la partícula i
export function burstHoming(t, { origin, targets, seed = 1, t0, homeStart, vMin = 20, vMax = 60, drag = 0.82, kMin = 400, kMax = 700, damping = 28 }) {
  const out = [];
  const lnD = Math.log(drag);
  for (let i = 0; i < targets.length; i++) {
    const a = hash2(i, seed) * Math.PI * 2;
    const v = vMin + (vMax - vMin) * hash2(i, seed + 1);
    const dt = Math.max(0, t - t0);
    // Recorrido libre con arrastre exponencial: v·(1 - drag^dt)/(1 - drag).
    const travel = (v * (1 - Math.exp(lnD * dt))) / -lnD;
    const fx = origin[0] + Math.cos(a) * travel;
    const fy = origin[1] + Math.sin(a) * travel;
    const hs = homeStart(i, targets[i]);
    const k = kMin + (kMax - kMin) * hash2(i, seed + 2);
    // Desde hs, mezcla hacia el destino con un spring (la posición libre sigue
    // su curso, así no hay corte de velocidad).
    const s = t <= hs ? 0 : clamp(spring(t - hs, { stiffness: k, damping, mass: 1 }), -0.2, 1.2);
    out.push([fx + (targets[i][0] - fx) * s, fy + (targets[i][1] - fy) * s, s]);
  }
  return out;
}
