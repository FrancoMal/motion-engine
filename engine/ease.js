// Easing, springs y keyframes, escritos a mano.
//
// Todo trabaja con tiempo en frames (número real, admite sub-frames: el motion
// blur muestrea tiempos fraccionales). Nada acá depende del canvas.

import { clamp, lerp } from "./math.js";

// ─── cubic-bezier ────────────────────────────────────────────────────────────
// Misma semántica que el cubic-bezier de CSS: la curva va de (0,0) a (1,1) con
// dos puntos de control. Para un t de entrada hay que encontrar el parámetro u
// tal que X(u) = t y devolver Y(u). Newton-Raphson converge en 3-4 pasos casi
// siempre; si la derivada se aplana (curvas muy empinadas), cae a bisección.

export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u) => ((ay * u + by) * u + cy) * u;
  const sampleDX = (u) => (3 * ax * u + 2 * bx) * u + cx;

  const solveU = (x) => {
    let u = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(u) - x;
      if (Math.abs(err) < 1e-7) return u;
      const d = sampleDX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(u);
      if (Math.abs(v - x) < 1e-7) return u;
      if (v < x) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return u;
  };

  const fn = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveU(t));
  };
  fn.bezier = [x1, y1, x2, y2];
  return fn;
}

// ─── curvas con nombre ───────────────────────────────────────────────────────
// Back con parámetro: s controla cuánto se pasa (overshoot) o cuánto retrocede
// antes de arrancar (anticipación). s = 1.70158 es el ~10 % clásico.

export const backOut =
  (s = 1.70158) =>
  (t) => {
    const u = t - 1;
    return 1 + (s + 1) * u * u * u + s * u * u;
  };

export const backIn =
  (s = 1.70158) =>
  (t) =>
    (s + 1) * t * t * t - s * t * t;

export const backInOut =
  (s = 1.70158) =>
  (t) => {
    const k = s * 1.525;
    if (t < 0.5) {
      const u = 2 * t;
      return (u * u * ((k + 1) * u - k)) / 2;
    }
    const u = 2 * t - 2;
    return (u * u * ((k + 1) * u + k) + 2) / 2;
  };

export const E = {
  linear: (t) => t,
  // Salidas: llegan con impulso y frenan contra el valor final.
  outCubic: cubicBezier(0.33, 1, 0.68, 1),
  outQuart: cubicBezier(0.25, 1, 0.5, 1),
  outExpo: cubicBezier(0.16, 1, 0.3, 1),
  // Entradas: arrancan con peso, se van acelerando.
  inCubic: cubicBezier(0.32, 0, 0.67, 0),
  inQuart: cubicBezier(0.5, 0, 0.75, 0),
  inExpo: cubicBezier(0.7, 0, 0.84, 0),
  // In-out: para viajes de cámara y cosas que ya estaban en pantalla.
  inOutCubic: cubicBezier(0.65, 0, 0.35, 1),
  inOutQuart: cubicBezier(0.76, 0, 0.24, 1),
  inOutExpo: cubicBezier(0.87, 0, 0.13, 1),
  // Latigazo: casi quieto, un tirón violento en el medio, casi quieto.
  whip: cubicBezier(0.85, 0, 0.15, 1),
  // Overshoot que asienta.
  overshoot: cubicBezier(0.34, 1.56, 0.64, 1),
  overshootSoft: cubicBezier(0.22, 1.28, 0.36, 1),
  // Anticipación: retrocede antes de salir.
  anticipate: cubicBezier(0.36, 0, 0.66, -0.56),
  // Anticipación + overshoot en una sola curva.
  anticipateOvershoot: cubicBezier(0.68, -0.6, 0.32, 1.6),
  backOut: backOut(),
  backIn: backIn(),
  backInOut: backInOut(),
};

// ─── springs ─────────────────────────────────────────────────────────────────
// Oscilador armónico amortiguado, solución analítica (no integración numérica,
// así el valor en un sub-frame no depende de cuántos pasos se tomaron).
// Devuelve la posición normalizada: 0 en el arranque, 1 en reposo.
//   x'' = -k (x - 1) - c x'      con x(0) = 0, x'(0) = v0
// Unidades: stiffness y damping por segundo, mass adimensional; t en frames.

export function spring(tFrames, { stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}, fps = 30) {
  if (tFrames <= 0) return 0;
  const t = tFrames / fps;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = -1; // desplazamiento inicial respecto del reposo
  const v0 = velocity;
  let x;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const A = x0;
    const B = (v0 + zeta * w0 * x0) / wd;
    x = Math.exp(-zeta * w0 * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
  } else if (zeta === 1) {
    x = Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
  } else {
    const r = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + r;
    const r2 = -zeta * w0 - r;
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  return 1 + x;
}

// Frames hasta que el spring queda dentro de `eps` del reposo y ahí se queda.
export function springDuration(cfg = {}, fps = 30, eps = 0.002) {
  let last = 0;
  for (let f = 0; f < fps * 10; f += 0.5) {
    if (Math.abs(spring(f, cfg, fps) - 1) > eps) last = f;
  }
  return Math.ceil(last + 0.5);
}

// Presets de spring con carácter.
export const SPRING = {
  // Pop con rebote corto: chips, checks, badges.
  pop: { stiffness: 320, damping: 17, mass: 1 },
  // Asentado firme con un solo overshoot chico: tarjetas, paneles.
  settle: { stiffness: 210, damping: 22, mass: 1 },
  // Pesado y elegante: tipografía grande, cámara.
  heavy: { stiffness: 120, damping: 20, mass: 1.4 },
  // Gelatina: para golpes de énfasis puntuales.
  wobble: { stiffness: 260, damping: 11, mass: 1 },
  // Crítico, sin overshoot: cuando algo tiene que llegar sin rebotar.
  critical: { stiffness: 200, damping: 28.3, mass: 1 },
};

// ─── progreso y tweens ───────────────────────────────────────────────────────

// Progreso 0..1 de t entre t0 y t1, con easing, clampeado.
export function prog(t, t0, t1, ease = E.linear) {
  if (t1 === t0) return t >= t1 ? 1 : 0;
  return ease(clamp((t - t0) / (t1 - t0), 0, 1));
}

// Valor de a a b entre t0 y t1.
export function tween(t, t0, t1, a, b, ease = E.linear) {
  return lerp(a, b, prog(t, t0, t1, ease));
}

// Spring disparado en `start`, mapeado de a a b.
export function springTo(t, start, a, b, cfg = SPRING.settle, fps = 30) {
  return lerp(a, b, spring(t - start, cfg, fps));
}

// ─── keyframes multi-segmento ────────────────────────────────────────────────
// keys: [[frame, valor], [frame, valor, easeDelSegmentoQueLlega], ...]
// El easing de cada key gobierna el tramo que TERMINA en ella. Así una
// anticipación queda escrita tal cual se piensa:
//   kf(t, [[0, 0], [6, -40, E.outCubic], [16, 620, E.inOutCubic], [24, 600, E.outQuart]])
// = quieto, retrocede 40 px, sale disparado, se pasa 20 y vuelve.
// Los valores pueden ser números o arrays de números (se interpolan por índice).

export function kf(t, keys) {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, ease = E.inOutCubic] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (t <= f1) {
      const p = ease(clamp((t - f0) / (f1 - f0 || 1), 0, 1));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], p));
      return lerp(v0, v1, p);
    }
  }
  return last[1];
}

// Patrón completo de "tiene peso": anticipación, viaje, overshoot, asentado.
//   start    frame en que empieza la anticipación
//   from/to  valores
//   antic    fracción del recorrido que retrocede antes de salir (0.06 = 6 %)
//   over     fracción que se pasa del destino
//   d        duraciones [anticipación, viaje, overshoot, asentado] en frames
export function weighted(t, start, from, to, { antic = 0.06, over = 0.05, d = [5, 9, 5, 7] } = {}) {
  const span = to - from;
  const a = start;
  const b = a + d[0];
  const c = b + d[1];
  const e = c + d[2];
  const f = e + d[3];
  return kf(t, [
    [a, from],
    [b, from - span * antic, E.outCubic],
    [c, to + span * over, E.inOutCubic],
    [e, to - span * over * 0.35, E.inOutCubic],
    [f, to, E.inOutCubic],
  ]);
}

// ─── stagger ─────────────────────────────────────────────────────────────────
// Offset del elemento i. `step` en frames (admite fraccionales). `from`
// permite escalonar desde el centro o desde el final.
export function stagger(i, n, step, from = "start") {
  if (from === "end") return (n - 1 - i) * step;
  if (from === "center") return Math.abs(i - (n - 1) / 2) * step;
  return i * step;
}

// ─── pulso ───────────────────────────────────────────────────────────────────
// Envolvente de golpe sobre una grilla de tempo: sube en `attack` frames y cae
// exponencialmente. Sirve para latidos de escala, flashes, respiración.
export function beatPulse(t, period, { phase = 0, attack = 1.5, decay = 6 } = {}) {
  const local = ((((t - phase) % period) + period) % period);
  if (local < attack) return local / attack;
  return Math.exp(-(local - attack) / decay);
}
