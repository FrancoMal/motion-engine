// Escena C/D: la luz de la lámpara y el aire del cuarto (tratamiento final 4.4).
//
// La noche no es negra: una lámpara arriba a la derecha (halo #fb923c al 14 %
// en screen, r 900, centro (1520, 300), contrato C-P2-6), un cono apenas
// visible, la mancha de luz sobre la mesa y el polvo que flota adentro del
// cono (L1, con profundidad de campo). Adelante, unos pocos bokeh fuera de foco
// (L5, z -400). Todo es función pura del tiempo.

import { createCanvas } from "@napi-rs/canvas";
import { layer, depthScale } from "../../engine/camera.js";
import { clamp, lerp, hash2, noise1 } from "../../engine/math.js";

export const LAMP = { x: 1520, y: 300, r: 900 };

// ─── cono de luz (cacheado: no depende del tiempo) ───────────────────────────
// Se dibuja una vez a media resolución y desenfocado; en cada sub-frame solo se
// estampa con drawImage en el plano del mundo.
let coneImg = null;
function cone() {
  if (coneImg) return coneImg;
  const W = 1100;
  const H = 800;
  const c = createCanvas(W / 2, H / 2);
  const x = c.getContext("2d");
  x.scale(0.5, 0.5);
  x.filter = "blur(26px)";
  // Trapecio desde la cabeza de la lámpara hacia la mesa (coordenadas locales
  // con origen en (1000, 220) del mundo).
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(253,233,211,0.55)");
  g.addColorStop(0.35, "rgba(251,146,60,0.22)");
  g.addColorStop(1, "rgba(251,146,60,0)");
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(470, 20);
  x.lineTo(610, 20);
  x.lineTo(1040, H - 40);
  x.lineTo(90, H - 40);
  x.closePath();
  x.fill();
  x.filter = "none";
  coneImg = c;
  return c;
}

// Luces del cuarto que van DETRÁS de la pila: el cono y la mancha en la mesa.
// k = intensidad 0..1 de la lámpara.
export function lampUnder(ctx, k) {
  if (k <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha *= 0.13 * k;
  ctx.drawImage(cone(), 1010, 60, 1100, 960);
  ctx.globalAlpha = 1;
  // Mancha de luz sobre la mesa alrededor de la base de la pila.
  ctx.save();
  ctx.translate(1470, 936);
  ctx.scale(1, 0.15);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
  g.addColorStop(0, `rgba(251,146,60,${(0.1 * k).toFixed(4)})`);
  g.addColorStop(0.55, `rgba(251,146,60,${(0.035 * k).toFixed(4)})`);
  g.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-700, -700, 1400, 1400);
  ctx.restore();
  ctx.restore();
}

// Halo de la lámpara ARRIBA de la pila (la calienta): #fb923c 14 % en screen,
// r 900 (C-P2-6), más un núcleo crema chico.
export function lampOver(ctx, k) {
  if (k <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  let g = ctx.createRadialGradient(LAMP.x, LAMP.y, 0, LAMP.x, LAMP.y, LAMP.r);
  g.addColorStop(0, `rgba(251,146,60,${(0.14 * k).toFixed(4)})`);
  g.addColorStop(0.3, `rgba(251,146,60,${(0.085 * k).toFixed(4)})`);
  g.addColorStop(0.65, `rgba(251,146,60,${(0.028 * k).toFixed(4)})`);
  g.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(LAMP.x - LAMP.r, LAMP.y - LAMP.r, LAMP.r * 2, LAMP.r * 2);
  // Núcleo: la lámpara está arriba, fuera de cuadro; su luz más caliente cae
  // sobre la esquina de la hoja de arriba.
  g = ctx.createRadialGradient(LAMP.x + 40, LAMP.y - 170, 0, LAMP.x + 40, LAMP.y - 170, 420);
  g.addColorStop(0, `rgba(253,233,211,${(0.16 * k).toFixed(4)})`);
  g.addColorStop(0.4, `rgba(251,146,60,${(0.07 * k).toFixed(4)})`);
  g.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(LAMP.x + 40 - 420, LAMP.y - 170 - 420, 840, 840);
  ctx.restore();
}

// Segundo blob de la noche (2.7: "two blobs, 10 %"), abajo a la izquierda,
// muy tenue, para que el campo no quede plano. En pantalla, sin cámara.
export function nightLeak(ctx, t, k) {
  if (k <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const x = 260 + 30 * noise1(t / 90, 41);
  const y = 1010 + 20 * noise1(t / 110, 42);
  const g = ctx.createRadialGradient(x, y, 0, x, y, 720);
  g.addColorStop(0, `rgba(251,146,60,${(0.05 * k).toFixed(4)})`);
  g.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 720, y - 720, 1440, 1440);
  ctx.restore();
}

// ─── polvo (L1) ──────────────────────────────────────────────────────────────
// 40 motas de 2-5 px, #fde9d3 al 20-50 %, adentro del cono, z de -300 a +900,
// con desenfoque por profundidad (círculo de confusión 14·|z - zf|/(1400 + z),
// tope 18). Flotan en ruido 1D y suben muy despacio (aire tibio de la lámpara).
// Se reparten en el cono con rechazo del contorno de la pila (delante del
// papel blanco una mota crema no se vería) y con más densidad cerca del plano
// de foco, así hay motas nítidas y otras que son solo un halo.
const PILE_BOX = [1180, 270, 1770, 960];
const MOTES = (() => {
  const out = [];
  let k = 0;
  while (out.length < 40 && k < 4000) {
    const h = (n) => hash2(k, 300 + n);
    const yy = 60 + 940 * h(1);
    const spread = 90 + 560 * ((yy - 60) / 940);
    const xx = 1560 + (h(2) * 2 - 1) * spread;
    k++;
    const inPile = xx > PILE_BOX[0] && xx < PILE_BOX[2] && yy > PILE_BOX[1] && yy < PILE_BOX[3];
    if (inPile || xx > 1990) continue;
    const zr = h(3);
    out.push({
      x: xx,
      y: yy,
      z: zr < 0.55 ? lerp(-120, 160, zr / 0.55) : lerp(-300, 900, (zr - 0.55) / 0.45),
      d: lerp(2, 5, h(4)),
      a: lerp(0.2, 0.5, h(5)),
      ph: h(6) * 100,
      sp: lerp(0.6, 1.4, h(7)),
    });
  }
  return out;
})();

export function dust(ctx, cam, t, k, { focusZ = 0, extraBlur = 0 } = {}) {
  if (k <= 0.001) return;
  for (let i = 0; i < MOTES.length; i++) {
    const m = MOTES[i];
    const s = depthScale(cam, m.z);
    if (!s) continue;
    const x = m.x + 26 * noise1(t / 70 * m.sp + m.ph, 7) ;
    const y = m.y + 18 * noise1(t / 85 * m.sp + m.ph, 8) - 0.14 * (t - 104) * m.sp;
    // Brillan más cerca de la lámpara y titilan al cruzar la luz.
    const dl = Math.hypot(x - 1520, y - 300);
    const lit = clamp(1.35 - dl / 800) * (0.65 + 0.35 * noise1(t / 12 + m.ph, 9));
    const alpha = Math.min(0.85, m.a * lit * k * 1.5);
    if (alpha <= 0.003) continue;
    const coc = Math.min(18, (14 * Math.abs(m.z - focusZ)) / (1400 + m.z)) + extraBlur;
    layer(ctx, cam, m.z, (c, sc) => {
      const r = m.d / 2 + coc / sc;
      // Energía conservada: al desenfocar, la mota se agranda y se apaga.
      const e = (m.d / 2 / r) ** 2;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(253,233,211,${(alpha * Math.max(0.12, e) * 1.6).toFixed(4)})`);
      g.addColorStop(0.55, `rgba(253,233,211,${(alpha * Math.max(0.12, e) * 0.9).toFixed(4)})`);
      g.addColorStop(1, "rgba(253,233,211,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
  }
}

// ─── bokeh de primer plano (L5, z -400) ──────────────────────────────────────
// Discos grandes y blandos cerca de los bordes, lejos de la columna de texto.
const BOKEH = [
  { x: 1830, y: 150, d: 150, c: "251,146,60", a: 0.13 },
  { x: 1700, y: 60, d: 80, c: "253,233,211", a: 0.1 },
  { x: 1905, y: 560, d: 110, c: "251,146,60", a: 0.1 },
  { x: 1560, y: 1050, d: 130, c: "251,146,60", a: 0.08 },
  { x: 1210, y: 95, d: 60, c: "253,233,211", a: 0.08 },
  { x: 1985, y: 900, d: 170, c: "251,146,60", a: 0.09 },
];

export function bokeh(ctx, cam, t, k) {
  if (k <= 0.001) return;
  layer(ctx, cam, -400, (c) => {
    c.save();
    c.globalCompositeOperation = "screen";
    BOKEH.forEach((b, i) => {
      const x = b.x + 14 * noise1(t / 120 + i * 5.3, 21);
      const y = b.y + 10 * noise1(t / 140 + i * 2.9, 22);
      const r = b.d / 2;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      // Disco de bokeh: núcleo casi plano y un borde que se cae de golpe.
      g.addColorStop(0, `rgba(${b.c},${(b.a * k * 0.8).toFixed(4)})`);
      g.addColorStop(0.72, `rgba(${b.c},${(b.a * k).toFixed(4)})`);
      g.addColorStop(0.86, `rgba(${b.c},${(b.a * k * 0.45).toFixed(4)})`);
      g.addColorStop(1, `rgba(${b.c},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  });
}
