// S5: capas del mundo Crema con profundidad real (tratamiento final 2.6 y 3.6).
//
//   L0  campo #fde9d3
//   L1  trama de medio tono (#f8dcc0, d ≤ 6, paso 28, a 45°) a z +700 que
//       sube 10 px/s: el punto como papel de fondo. Más densa abajo a la
//       izquierda y arriba a la derecha, casi nada detrás de la frase.
//   L2  grilla de 12 columnas a z +300, líneas de 1 px
//   L5  motas desenfocadas a z -400 (escala 1,4), adelante de la UI
//
// Paralaje: durante el latigazo el mundo entra con ox(t); cada capa se corre
// ox·s(z), así lo lejano entra más lento y las motas más rápido. Después, un
// dolly lento solo de las texturas (la UI queda quieta por los contratos) y el
// punch de f280.

import { createCanvas } from "@napi-rs/canvas";
import { env } from "../../engine/env.js";
import { clamp, hash1, noise1, smoothstep } from "../../engine/math.js";
import { lightLeak } from "../../engine/fx.js";
import { COL } from "./s5-layout.js";

const F = 1400;
const depth = (z, camZ = 0) => F / (F + z - camZ);

// Dolly de texturas: la cámara avanza 36 unidades entre f255 y f303.
const camZ = (t) => 36 * clamp((t - 255) / 48);

// ─── L1: medio tono (se pinta una vez por escala de render) ──────────────────
const HT = { pitch: 28, d: 6.4, color: "#f8dcc0", pad: 80 };
const htCache = new Map();
function halftone(scale) {
  const key = scale.toFixed(3);
  let c = htCache.get(key);
  if (c) return c;
  const W = 1920 + HT.pad * 2;
  const H = 1080 + HT.pad * 2;
  c = createCanvas(Math.ceil(W * scale), Math.ceil(H * scale));
  const x = c.getContext("2d");
  x.scale(scale, scale);
  x.fillStyle = HT.color;
  // Grilla girada 45°: filas alternadas corridas medio paso.
  const p = HT.pitch;
  const rowH = p * 0.5;
  for (let r = 0, y = 0; y < H; r++, y += rowH) {
    const off = r % 2 ? p / 2 : 0;
    for (let xx = off; xx < W; xx += p) {
      const sx = xx - HT.pad;
      const sy = y - HT.pad;
      // Densidad: dos lóbulos (abajo izquierda fuerte, arriba derecha suave).
      const d1 = Math.hypot(sx - 60, sy - 1160) / 1250;
      const d2 = Math.hypot(sx - 1980, sy + 80) / 820;
      const w = Math.max(1 - smoothstep(0.15, 1, d1), 0.75 * (1 - smoothstep(0.1, 1, d2)));
      const d = HT.d * w;
      if (d < 0.7) continue;
      x.beginPath();
      x.arc(xx, y, d / 2, 0, Math.PI * 2);
      x.fill();
    }
  }
  htCache.set(key, c);
  return c;
}

// ─── L5: motas ───────────────────────────────────────────────────────────────
// Posiciones de pantalla en reposo (fuera de la frase y del centro de la UI).
const MOTES = [
  { x: 96, y: 880, r: 44, a: 0.5, warm: 0 },
  { x: 350, y: 1010, r: 26, a: 0.42, warm: 1 },
  { x: 720, y: 930, r: 60, a: 0.34, warm: 0 },
  { x: 1020, y: 800, r: 18, a: 0.5, warm: 1 },
  { x: 1860, y: 250, r: 52, a: 0.4, warm: 0 },
  { x: 1650, y: 90, r: 22, a: 0.45, warm: 1 },
  { x: 1880, y: 760, r: 30, a: 0.38, warm: 0 },
  { x: 1120, y: 1040, r: 34, a: 0.36, warm: 1 },
];

// ─── dibujo ──────────────────────────────────────────────────────────────────

// Campo, trama, grilla y leak (detrás de la UI). ox: corrimiento del mundo
// (x del borde del campo durante el paneo). zoom: punch de cámara.
export function drawBack(ctx, t, ox, zoom) {
  ctx.fillStyle = COL.crema;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  const cz = camZ(t);

  ctx.save();
  // Punch alrededor del centro de pantalla.
  ctx.translate(960, 540);
  ctx.scale(zoom, zoom);
  ctx.translate(-960, -540);

  // L1 medio tono.
  const s1 = depth(700, cz) / depth(700);
  const img = halftone(env.scale || 1);
  const px = ox * depth(700);
  const drift = -(t - 249) * (10 / 30);
  ctx.save();
  ctx.translate(960 + px, 540 + drift * depth(700));
  ctx.scale(s1, s1);
  ctx.drawImage(img, -960 - HT.pad, -540 - HT.pad, 1920 + HT.pad * 2, 1080 + HT.pad * 2);
  ctx.restore();

  // Leak cálido lejano, arriba a la derecha (Crema 6 %).
  lightLeak(ctx, t, { intensity: 0.11, x: 0.9 + (px / 1920) * 0.9, y: 0.02, seed: 5 });

  // L2 grilla de columnas.
  const s2 = depth(300, cz);
  ctx.save();
  ctx.translate(960 + ox * depth(300), 540);
  ctx.scale(s2, s2);
  ctx.translate(-960, -540);
  ctx.fillStyle = "rgba(226,178,134,0.22)";
  const lw = 1 / s2;
  for (let c = 0; c < 12; c++) {
    const x0 = 120 + c * 142;
    ctx.fillRect(x0 - lw / 2, -200, lw, 1480);
    ctx.fillRect(x0 + 118 - lw / 2, -200, lw, 1480);
  }
  ctx.restore();
  ctx.restore();
}

// Motas de primer plano (arriba de la UI).
export function drawFront(ctx, t, ox, zoom) {
  const cz = camZ(t);
  const s5 = depth(-400, cz) / depth(-400);
  ctx.save();
  ctx.translate(960, 540);
  ctx.scale(zoom * s5, zoom * s5);
  ctx.translate(-960, -540);
  const px = ox * depth(-400);
  MOTES.forEach((m, i) => {
    const sway = 14 * noise1(t * 0.035 + i * 7.3, 41 + i);
    const x = m.x + px + sway;
    const y = m.y - (t - 249) * (0.25 + 0.2 * hash1(i + 9)) + 8 * noise1(t * 0.03 + i * 3.1, 77 + i);
    if (x < -m.r * 2 || x > 1920 + m.r * 2) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, m.r);
    const c = m.warm ? "255,236,214" : "255,251,246";
    g.addColorStop(0, `rgba(${c},${m.a})`);
    g.addColorStop(0.55, `rgba(${c},${m.a * 0.55})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
  });
  ctx.restore();
}
