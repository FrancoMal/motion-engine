// Sistema de movimiento compartido de las dos piezas (tratamiento final,
// secciones 2.1 a 2.3): grilla de tempo, easings con nombre, springs y los
// golpes que marcan el pulso.
//
// 14 frames por beat = 128,57 BPM. Corchea 7 f, semicorchea 3,5 f, compás 56 f.
// Los contactos caen EN la grilla; la anticipación pasa antes.

import { cubicBezier, spring } from "../engine/ease.js";
import { clamp, lerp } from "../engine/math.js";

export const BEAT = 14;
export const BAR = 56;
// Frame en que empieza el beat n (1-based).
export const beat = (n) => BEAT * (n - 1);

// ─── easings (valores exactos del tratamiento) ───────────────────────────────
export const EASE = {
  linear: (t) => t,
  glide: cubicBezier(0.16, 1, 0.3, 1), // el easing de los sheets de la app
  whip: cubicBezier(0.85, 0, 0.15, 1), // latigazos, cierres de máscara, rellenos de campo
  lunge: cubicBezier(0.7, 0, 0.2, 1), // vuelos: 70 % del recorrido en el tercio medio
  accel: cubicBezier(0.5, 0, 0.75, 0), // caídas, salidas, implosiones
  brake: cubicBezier(0.2, 0, 0, 1), // frenada seca después de un impacto
  pen: cubicBezier(0.45, 0, 0.15, 1), // todo trim de trazo
  swell: cubicBezier(0.37, 0, 0.63, 1), // anticipaciones, inhalaciones, dollies
  ink: cubicBezier(0.2, 0.9, 0.1, 1), // rampas de peso, cierres de tracking
  back: cubicBezier(0.34, 1.56, 0.64, 1), // overshoot barato, solo tags
  endCam: cubicBezier(0.33, 0, 0.2, 1), // cámara de la placa final
};

// ─── springs (forma cerrada, deterministas entre workers) ────────────────────
export const SPR = {
  snap: { stiffness: 700, damping: 30, mass: 1 }, // overshoot 11,5 %, asienta en ~10 f
  slam: { stiffness: 520, damping: 22, mass: 1 }, // 17,7 %, puntos y sellos
  settle: { stiffness: 260, damping: 26, mass: 1.4 }, // 5,4 %, objetos pesados
  soft: { stiffness: 240, damping: 24, mass: 1 }, // 2,1 %, lectura y cámara
  wobble: { stiffness: 180, damping: 5, mass: 1 }, // 55 %, período ~ un beat
};

// Valor del spring disparado en `start` (0 antes, 1 en reposo).
export const spr = (t, start, cfg = SPR.snap) => (t <= start ? 0 : spring(t - start, cfg));

// Pop desde `from` (escala) hasta 1 con el spring dado.
export const popScale = (t, H, cfg = SPR.snap, from = 0) => lerp(from, 1, spr(t, H, cfg));

// Progreso 0..1 clampeado con easing.
export function p(t, t0, t1, ease = EASE.linear) {
  if (t1 === t0) return t >= t1 ? 1 : 0;
  return ease(clamp((t - t0) / (t1 - t0)));
}

// ─── golpes del pulso ────────────────────────────────────────────────────────

// Anillo que sale de un punto (10 f, glide): diámetro d0 → 5·d0, trazo 4 → 0.5,
// opacidad 0.8 → 0. Se dibuja con ctx en coordenadas del punto.
export function ring(ctx, t, H, cx, cy, d0, color) {
  if (t < H || t > H + 10) return;
  const k = EASE.glide(clamp((t - H) / 10));
  const d = lerp(d0, d0 * 5, k);
  ctx.save();
  ctx.globalAlpha *= lerp(0.8, 0, k);
  ctx.lineWidth = lerp(4, 0.5, k);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Golpe de peso en el lugar: +amp wght en 3 f, vuelve en 5 f.
export function weightBump(t, H, amp = 60) {
  if (t < H || t > H + 8) return 0;
  if (t < H + 3) return amp * EASE.brake((t - H) / 3);
  return amp * (1 - EASE.swell((t - H - 3) / 5));
}

// Punch de cámara del mundo: +1,2 % en 2 f y vuelta con snap. Devuelve el
// multiplicador de escala.
export function punch(t, H) {
  if (t < H) return 1;
  if (t < H + 2) return 1 + 0.012 * EASE.brake((t - H) / 2);
  return 1 + 0.012 * (1 - spr(t, H + 2, SPR.snap));
}

// Aberración cromática de golpe: 1.6 / 0.8 / 0.3 px en 3 frames.
export function caHit(f, H, amp = 1.6) {
  const k = f - H;
  if (k === 0) return amp;
  if (k === 1) return amp * 0.5;
  if (k === 2) return amp * 0.1875;
  return 0;
}

// ─── patrones de keyframes ───────────────────────────────────────────────────

// K4 "Caída": contacto en C desde altura h. Devuelve {dy, sx, sy} con origen en
// el borde inferior central.
export function caida(t, C, h) {
  if (t < C - 6) return { dy: -h, sx: 1, sy: 1, visible: false };
  if (t < C) {
    const k = EASE.accel((t - (C - 6)) / 6);
    return { dy: -h * (1 - k), sx: lerp(1, 0.95, k), sy: lerp(1, 1.1, k), visible: true };
  }
  if (t < C + 2) {
    const k = (t - C) / 2;
    return { dy: 0, sx: lerp(0.95, 1.12, k), sy: lerp(1.1, 0.84, k), visible: true };
  }
  const k = spr(t, C + 2, SPR.snap);
  return { dy: 0, sx: lerp(1.12, 1, k), sy: lerp(0.84, 1, k), visible: true };
}

// K2 "Latigazo": recorrido D desde S. Devuelve la fracción del recorrido (puede
// ser negativa en la anticipación y pasar de 1 en el overshoot).
export function latigazo(t, S) {
  if (t <= S) return 0;
  if (t < S + 4) return -0.05 * EASE.swell((t - S) / 4);
  if (t < S + 10) return lerp(-0.05, 1.06, EASE.lunge((t - S - 4) / 6));
  if (t < S + 13) return lerp(1.06, 0.99, EASE.swell((t - S - 10) / 3));
  if (t < S + 16) return lerp(0.99, 1, EASE.swell((t - S - 13) / 3));
  return 1;
}

// Mínimo de frames de lectura para `words` palabras (0,25 s/palabra + 0,3 s).
export const minHold = (words) => Math.ceil((0.25 * words + 0.3) * 30);
