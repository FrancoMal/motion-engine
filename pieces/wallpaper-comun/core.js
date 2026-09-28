// Fondo de pantalla de bloqueo animado (personal, estética de Darling in the
// FRANXX): las dos X de barras paralelas, una roja y una azul, como tubos de
// neón. Un solo esqueleto temporal para las cinco variantes; cambia la
// temperatura (cuánto neón, cuánto detalle, cuánto color), nunca los tiempos.
//
// Ciclo de 10 s (300 cuadros a 30 fps):
//   0-90     aproximación: hilos de luz fluyen hacia los dos cruces, una guía de
//            circuito se traza donde van a estar las barras, la carga crece.
//   90       formación: la carga estalla y los ocho tubos salen disparados desde
//            el cruce hacia sus puntas, con sobrepique, y encienden como neón.
//   95-225   vida: pulsos que recorren los tubos, bloom que respira, vaivén.
//   225-280  drenaje: la luz baja por cada tubo y cae por la punta inferior.
//   280-300  negro con polvo: el mismo estado que el cuadro 0.
//
// Loop sin costura: todo sale de la fase del ciclo. Lo ambiental es periódico
// por construcción (senos de frecuencia entera). Los eventos se evalúan en el
// ciclo actual y en el anterior, así lo que cruza el corte (una gota que sigue
// cayendo) sigue del otro lado. El cuadro 300 es idéntico al 0.
//
// El reloj: la interfaz de bloqueo dibuja la hora arriba (hasta el 27 %). Esa
// franja lleva una ganancia fija aplicada después del bloom (grade.rowGain),
// y ningún efecto nace ahí: solo llegan las puntas de dos tubos, apagadas.

import { createCanvas } from "@napi-rs/canvas";
import { WALLPAPER } from "../../engine/format.js";
import { emit } from "../../engine/env.js";
import { clamp, lerp, hash1, rng, TAU, hexToRgb } from "../../engine/math.js";

// Se compone en el espacio de diseño (1080x2340) y se escala al lienzo.
const W = WALLPAPER.design.w;
const H = WALLPAPER.design.h;
const K = WALLPAPER.k;
const TOP = WALLPAPER.safe.top; // 632
const FPS = 30;
export const T = 300;
export const HIT = 90;
const LIFE_END = 225;
const DRAIN_END = 280;

const RED = "#ff2b2b";
const BLUE = "#1f8fff";

// ─── geometría (las X de sus fondos, medidas en ref-2) ───────────────────────
// Cada trazo: punta de abajo y punta de arriba del eje. Cada trazo son dos
// barras paralelas separadas 86 px; los cortes de las puntas son horizontales,
// como en su fondo y como en los trazos del opening.
const STROKES = [
  { x: "red", b: [877, 1690], t: [338, 493] },
  { x: "red", b: [402, 1736], t: [1014, 338] },
  { x: "blue", b: [119, 1946], t: [713, 512] },
  { x: "blue", b: [749, 1900], t: [210, 694] },
];
function intersect(s1, s2) {
  const [x1, y1] = s1.b;
  const [x2, y2] = s1.t;
  const [x3, y3] = s2.b;
  const [x4, y4] = s2.t;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const a = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  return [x1 + a * (x2 - x1), y1 + a * (y2 - y1)];
}
export const CENTER = { red: intersect(STROKES[0], STROKES[1]), blue: intersect(STROKES[2], STROKES[3]) };
const SPACING = 86;
const BARS = [];
STROKES.forEach((s, si) => {
  [-1, 1].forEach((side, k) => {
    const b = [s.b[0] + (side * SPACING) / 2, s.b[1]];
    const t = [s.t[0] + (side * SPACING) / 2, s.t[1]];
    // Parámetro del cruce sobre esta barra (0 abajo, 1 arriba), por altura.
    const c = clamp((b[1] - CENTER[s.x][1]) / (b[1] - t[1]), 0.1, 0.9);
    BARS.push({ b, t, c, x: s.x, color: s.x === "red" ? RED : BLUE, i: si * 2 + k, len: Math.hypot(t[0] - b[0], t[1] - b[1]) });
  });
});
const at = (bar, s) => [lerp(bar.b[0], bar.t[0], s), lerp(bar.b[1], bar.t[1], s)];

// ─── utilidades ──────────────────────────────────────────────────────────────
const p = (t, a, b) => clamp((t - a) / (b - a));
const eo = (u) => 1 - Math.pow(1 - clamp(u), 3);
const ei = (u) => Math.pow(clamp(u), 3);
const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const mod = (a, n) => ((a % n) + n) % n;
// Resorte con sobrepique (0 → 1), u en cuadros.
function spring(u, w = 0.95, z = 0.5) {
  if (u <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * u));
}
function rgbaHex(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mixW(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(lerp(r, 255, k))},${Math.round(lerp(g, 255, k))},${Math.round(lerp(b, 255, k))})`;
}
// Paralelogramo con cortes horizontales entre dos puntos del eje.
function barPath(ctx, A, B, w) {
  ctx.beginPath();
  ctx.moveTo(A[0] - w / 2, A[1]);
  ctx.lineTo(A[0] + w / 2, A[1]);
  ctx.lineTo(B[0] + w / 2, B[1]);
  ctx.lineTo(B[0] - w / 2, B[1]);
  ctx.closePath();
}
// Ganancia de la franja del reloj: fija, y con rampa hasta la franja útil.
function rowGain(k0) {
  const g = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const u = clamp((y - (TOP - 40)) / 240);
    g[y] = lerp(k0, 1, u * u * (3 - 2 * u));
  }
  return g;
}

// ─── la pieza ────────────────────────────────────────────────────────────────
// V: parámetros de la variante (ver cada pieces/wallpaper-0N-*/index.js).
export function makeWallpaper(V) {
  const R = rng(V.seed ?? 11);
  // Hilos de la aproximación: nacen en los bordes de la franja útil y llegan
  // al cruce de su X exactamente en el golpe.
  const THREADS = Array.from({ length: V.threads }, (_, i) => {
    const x = i % 2 ? "red" : "blue";
    const fromLeft = R() < 0.5;
    const y0 = lerp(TOP + 180, H * 0.78, R());
    return {
      x,
      p0: [fromLeft ? -60 : W + 60, y0],
      c1: [lerp(80, W - 80, R()), lerp(TOP + 200, H * 0.76, R())],
      start: lerp(4, 58, R()),
      wig: lerp(20, 70, R()) * (R() < 0.5 ? -1 : 1),
      ph: R() * TAU,
      w: lerp(1.2, 2.6, R()),
    };
  });
  // Esquirlas del golpe: salen de los cruces; nunca suben a la franja del reloj.
  const SHARDS = Array.from({ length: V.shards }, (_, i) => {
    const x = i % 2 ? "red" : "blue";
    const c = CENTER[x];
    const depth = [0.55, 0.85, 1.25][i % 3];
    const ang = R() * TAU;
    const sp = lerp(5, 21, R()) * depth;
    const g = 0.42 * depth;
    let vy = Math.sin(ang) * sp;
    const ymin = TOP + 150;
    const vyMin = -Math.sqrt(2 * g * Math.max(0, c[1] - ymin));
    if (vy < vyMin) vy = vyMin * lerp(0.4, 1, R());
    const pts = Array.from({ length: 4 }, (_, k) => {
      const a = (k / 4) * TAU + R() * 0.9;
      const r = lerp(0.5, 1, R());
      return [Math.cos(a) * r, Math.sin(a) * r * lerp(0.35, 1, R())];
    });
    const pick = R();
    return {
      x, c, vx: Math.cos(ang) * sp, vy, g, depth,
      size: lerp(7, 26, R()) * depth,
      rot: R() * TAU, vr: lerp(-0.25, 0.25, R()),
      life: lerp(50, 110, R()),
      color: pick < 0.45 ? "#ffffff" : pick < 0.75 ? (x === "red" ? "#ff6a5c" : "#6ab8ff") : x === "red" ? "#5a0d0d" : "#0b2a55",
      pts,
    };
  });
  const SPEED = Array.from({ length: V.speedLines }, () => ({
    y: lerp(TOP + 160, H * 0.78, R()),
    len: lerp(180, 760, R()),
    w: lerp(1, 3.2, R()),
    d: R() < 0.5 ? 1 : -1,
    t0: lerp(0, 5, R()),
    v: lerp(110, 190, R()),
  }));
  const STREAKS = Array.from({ length: V.streaks ?? 0 }, (_, i) => ({
    t0: lerp(HIT + 24, LIFE_END - 26, (i + R() * 0.6) / (V.streaks || 1)),
    slope: R() < 0.5 ? 1 : -1,
    x0: lerp(-200, W + 200, R()),
    dir: R() < 0.5 ? 1 : -1,
    w: lerp(1, 2.2, R()),
  }));
  // Chispas que se desprenden de los cruces durante la vida, una tras otra.
  const SPARKS = Array.from({ length: V.sparks ?? 0 }, (_, j) => {
    const x = j % 2 ? "red" : "blue";
    const ang = lerp(-0.2, Math.PI + 0.2, R());
    const sp = lerp(1.5, 5, R());
    return { x, t0: lerp(HIT + 12, LIFE_END - 30, j / (V.sparks || 1)), vx: Math.cos(ang) * sp, vy: -Math.abs(Math.sin(ang)) * sp * 0.4, life: lerp(34, 60, R()), s: lerp(1.2, 2.6, R()) };
  });
  const DUST = Array.from({ length: V.dust }, () => ({
    x: R() * W,
    y: lerp(TOP + 60, H * 0.8, R()),
    r: lerp(8, 40, R()),
    ph: R() * TAU,
    m: 1 + Math.floor(R() * 2),
    s: lerp(0.8, 2, R()),
  }));
  const DROPS = Array.from({ length: V.drops }, () => ({
    bar: Math.floor(R() * 8),
    t0: lerp(0, 1, R()),
    vx: lerp(-1.5, 1.5, R()),
    s: lerp(1.5, 3.5, R()),
  }));
  const GAIN = rowGain(V.clockGain ?? 0.28);

  // ─── formación desde los costados (variantes 06 y 07) ─────────────────────
  // Cada tubo llega en segmentos que entran volando desde un borde lateral
  // (la X azul por la izquierda, la roja por la derecha, con algunos que
  // cruzan desde el otro lado) y se acoplan apagados, del cruce hacia afuera.
  // En el golpe se enciende la X entera; al final se apaga y los segmentos se
  // van por donde vinieron.
  const SIDES = V.formation === "sides";
  const SEG = V.segments ?? 6;
  const SEGS = [];
  if (SIDES) {
    BARS.forEach((bar) => {
      for (let j = 0; j < SEG; j++) {
        const mid = (j + 0.5) / SEG;
        const base = bar.x === "blue" ? -1 : 1;
        // Los segmentos de la franja del reloj no vuelan: aparecen al encenderse
        // la X y se apagan en el lugar (nada cruza la hora).
        const inClock = at(bar, mid)[1] < TOP + 90;
        SEGS.push({ bar, j, inClock, s0: j / SEG, s1: (j + 1) / SEG, side: hash1(bar.i * 31 + j * 7) < 0.22 ? -base : base, dist: Math.abs(mid - bar.c) + hash1(bar.i * 13 + j) * 0.12 });
      }
    });
    const byDist = [...SEGS].sort((a, b) => a.dist - b.dist);
    byDist.forEach((sg, r) => {
      sg.arrive = lerp(16, HIT - 3, r / (byDist.length - 1));
      sg.leave = lerp(240, 262, 1 - r / (byDist.length - 1));
    });
  }
  const FLIGHT = 16;
  function segOffset(sg, u) {
    const inK = eo(p(u, sg.arrive - FLIGHT, sg.arrive));
    const settle = u > sg.arrive ? -14 * Math.exp(-(u - sg.arrive) / 4) * Math.sin((u - sg.arrive) * 0.8) : 0;
    const outK = ei(p(u, sg.leave, sg.leave + 18));
    return sg.side * ((W + 260) * (1 - inK) + settle + (W + 260) * outK);
  }
  // Potencia: 0 apagado (recién acoplado), 1 neón encendido.
  function sidesPower(u) {
    if (u < HIT) return 0;
    const d = u - HIT;
    const fl = d < 1 ? 1.6 : d < 2 ? 0.35 : d < 3 ? 1.2 : d < 4 ? 0.55 : 1;
    return fl * (1 - eio(p(u, LIFE_END, 238)));
  }
  function drawSeg(ctx, sg, u, t) {
    if (u < sg.arrive - FLIGHT || u > sg.leave + 18) return;
    if (sg.inClock && (u < HIT || u >= 238)) return;
    const bar = sg.bar;
    const pw = clamp(sidesPower(u), 0, 1.6);
    const on = clamp(pw);
    const dx = sg.inClock ? 0 : segOffset(sg, u);
    const gap = ((1 - on) * 5) / bar.len;
    const A0 = at(bar, sg.s0 + gap);
    const B0 = at(bar, sg.s1 - gap);
    const A = [A0[0] + dx, A0[1]];
    const B = [B0[0] + dx, B0[1]];
    const w = V.width;
    // Estela horizontal mientras vuela.
    const flying = u < sg.arrive ? 1 - p(u, sg.arrive - 3, sg.arrive) : u > sg.leave ? p(u, sg.leave, sg.leave + 4) : 0;
    if (flying > 0.01) {
      const my = (A[1] + B[1]) / 2;
      const mx = (A[0] + B[0]) / 2;
      const L = 360;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(mx, 0, mx + sg.side * L, 0);
      g.addColorStop(0, rgbaHex(bar.color, 0.55 * flying));
      g.addColorStop(1, rgbaHex(bar.color, 0));
      ctx.fillStyle = g;
      const hh = Math.max(4, Math.abs(B[1] - A[1]) * 0.18);
      ctx.fillRect(Math.min(mx, mx + sg.side * L), my - hh / 2, L, hh);
      ctx.restore();
    }
    // Apagado: contorno y relleno tenue, como un tubo sin corriente.
    if (on < 0.999) {
      ctx.save();
      ctx.strokeStyle = rgbaHex(bar.color, 0.6 * (1 - on));
      ctx.lineWidth = 1.3;
      barPath(ctx, A, B, w);
      ctx.stroke();
      ctx.fillStyle = rgbaHex(bar.color, 0.14 * (1 - on));
      ctx.fill();
      ctx.restore();
      // Chispa de acople.
      const dock = u >= sg.arrive ? Math.exp(-(u - sg.arrive) / 3) : 0;
      if (dock > 0.03 && u < HIT) {
        const M = at(bar, (sg.s0 + sg.s1) / 2);
        emit(ctx, (e) => {
          e.globalAlpha *= dock * 0.8;
          e.fillStyle = "#ffffff";
          e.beginPath();
          e.arc(M[0] + dx, M[1], 10, 0, TAU);
          e.fill();
        });
      }
    }
    if (on > 0.001) {
      const flash = u >= HIT ? Math.exp(-(u - HIT) / 3.5) * V.flash : 0;
      const breathe = 1 + V.breathe * Math.sin(TAU * (t / T) * 2 + bar.i * 0.4);
      const k = clamp(pw * breathe, 0, 1.6);
      ctx.save();
      ctx.globalAlpha = clamp(V.body * k);
      ctx.fillStyle = flash > 0.02 ? mixW(bar.color, clamp(flash)) : bar.color;
      barPath(ctx, A, B, w);
      ctx.fill();
      ctx.globalAlpha = clamp(V.core * k);
      ctx.fillStyle = mixW(bar.color, clamp(V.coreWhite + flash));
      barPath(ctx, A, B, w * V.coreWidth);
      ctx.fill();
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= clamp(V.glow * k * (1 + flash));
        e.fillStyle = mixW(bar.color, flash * 0.6);
        barPath(e, A, B, w * 1.1);
        e.fill();
      });
    }
  }
  function drawBarsSides(ctx, t, u) {
    ["red", "blue"].forEach((x) => {
      SEGS.filter((sg) => sg.bar.x === x).forEach((sg) => drawSeg(ctx, sg, u, t));
      // Vida: pulsos y ola sobre el tubo entero encendido.
      if (u >= HIT && u < 238) {
        const drain = eio(p(u, LIFE_END, 238));
        BARS.filter((b) => b.x === x).forEach((bar) => {
          const st = { s0: 0, s1: 1, drain, d: u - HIT, fl: 1 };
          drawPulses(ctx, bar, st, t, u);
          drawWave(ctx, bar, st, u);
        });
      }
    });
  }

  // ─── el entorno de las X (variantes 06 y 07) ──────────────────────────────
  const ENV = V.env ?? null;
  // Nivel del entorno: se arma en la aproximación, vive con las X, se apaga
  // antes de que vuelva el negro del cuadro 0.
  const envLevel = (u) => (u < HIT ? 0.55 * eio(p(u, 14, HIT)) : 1) * (1 - eio(p(u, 232, 276)));
  // Circuito: trazas que entran desde el borde lateral, quiebran a 45° y
  // terminan en un nodo junto a su X.
  const CIRCUIT = ENV
    ? Array.from({ length: ENV.circuit }, (_, i) => {
        const x = i % 2 ? "red" : "blue";
        const side = x === "blue" ? -1 : 1;
        const c = CENTER[x];
        const y0 = lerp(TOP + 180, H * 0.77, R());
        const ex = side < 0 ? -20 : W + 20;
        const kx = lerp(c[0] + side * 200, c[0] + side * 70, R());
        const ny = lerp(c[1] - 240, c[1] + 300, R());
        const turn = [kx + side * Math.abs(ny - y0), y0];
        const node = [kx, ny];
        const P = [[ex, y0], turn, node];
        const lens = [Math.abs(turn[0] - ex), Math.hypot(node[0] - turn[0], node[1] - turn[1])];
        return { x, P, lens, total: lens[0] + lens[1], start: lerp(12, HIT - 20, R()), ph: R(), per: lerp(40, 75, R()) };
      })
    : [];
  function ptOn(tr, d) {
    if (d <= tr.lens[0]) return [lerp(tr.P[0][0], tr.P[1][0], d / tr.lens[0]), tr.P[0][1]];
    const q = clamp((d - tr.lens[0]) / tr.lens[1]);
    return [lerp(tr.P[1][0], tr.P[2][0], q), lerp(tr.P[1][1], tr.P[2][1], q)];
  }
  function drawCircuit(ctx, u) {
    const lvl = envLevel(u);
    if (lvl <= 0.005) return;
    CIRCUIT.forEach((tr) => {
      const color = tr.x === "red" ? RED : BLUE;
      const grow = eo(p(u, tr.start, tr.start + 24));
      if (grow <= 0) return;
      const d1 = tr.total * grow;
      ctx.save();
      ctx.strokeStyle = rgbaHex(color, ENV.circuitAlpha * lvl);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tr.P[0][0], tr.P[0][1]);
      if (d1 > tr.lens[0]) ctx.lineTo(tr.P[1][0], tr.P[1][1]);
      const e = ptOn(tr, d1);
      ctx.lineTo(e[0], e[1]);
      ctx.stroke();
      if (grow >= 1) {
        ctx.fillStyle = rgbaHex(color, Math.min(1, 2.2 * ENV.circuitAlpha) * lvl);
        ctx.beginPath();
        ctx.arc(tr.P[2][0], tr.P[2][1], 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // Pulso de datos que corre del borde al nodo (periódico en la vida).
      if (u > HIT) {
        const q = mod((u - HIT) / tr.per + tr.ph, 1);
        const P = ptOn(tr, tr.total * q);
        const a = lvl * Math.sin(Math.PI * q) * ENV.pulse;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = mixW(color, 0.6);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(P[0], P[1], 2.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        emit(ctx, (em) => {
          em.globalAlpha *= a * 0.8;
          em.fillStyle = color;
          em.beginPath();
          em.arc(P[0], P[1], 7, 0, TAU);
          em.fill();
        });
      }
    });
  }
  // Resplandor que se derrama alrededor de cada X.
  function drawSpill(ctx, t, u) {
    const lvl = envLevel(u) * (u >= HIT ? 1 : 0.3);
    if (!ENV || lvl <= 0.005) return;
    ["red", "blue"].forEach((x) => {
      const c = CENTER[x];
      const color = x === "red" ? RED : BLUE;
      const br = 1 + 0.18 * Math.sin(TAU * (t / T) * 2 + (x === "red" ? 0 : Math.PI));
      const r = ENV.spillR;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, rgbaHex(color, ENV.spill * lvl * br));
      g.addColorStop(0.5, rgbaHex(color, ENV.spill * 0.35 * lvl * br));
      g.addColorStop(1, rgbaHex(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r);
      ctx.restore();
    });
  }
  // Partículas en órbita alrededor de cada X (periódicas: vueltas enteras).
  const ORBIT = ENV
    ? Array.from({ length: ENV.orbit }, (_, i) => ({
        x: i % 2 ? "red" : "blue",
        rx: lerp(170, 470, R()),
        ry: lerp(110, 360, R()),
        tilt: lerp(-0.5, 0.5, R()),
        ph: R() * TAU,
        m: (1 + Math.floor(R() * 3)) * (R() < 0.5 ? 1 : -1),
        s: lerp(1, 2.8, R()) * (ENV.orbitSize ?? 1),
      }))
    : [];
  function drawOrbit(ctx, t, u) {
    const lvl = envLevel(u);
    if (lvl <= 0.005) return;
    ORBIT.forEach((o) => {
      const c = CENTER[o.x];
      const color = o.x === "red" ? RED : BLUE;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 6; k++) {
        const a = o.ph + TAU * o.m * (t / T) - k * 0.035 * Math.sign(o.m);
        const lx = Math.cos(a) * o.rx;
        const ly = Math.sin(a) * o.ry;
        const X = c[0] + lx * Math.cos(o.tilt) - ly * Math.sin(o.tilt);
        const Y = c[1] + lx * Math.sin(o.tilt) + ly * Math.cos(o.tilt);
        ctx.fillStyle = k === 0 ? mixW(color, 0.6) : color;
        ctx.globalAlpha = lvl * ENV.orbitAlpha * (1 - k / 6);
        ctx.beginPath();
        ctx.arc(X, Y, o.s * (1 - k / 9), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });
  }
  // Ondas que irradian de los cruces durante la vida.
  function drawRings(ctx, u) {
    if (!ENV || !ENV.rings) return;
    const lvl = envLevel(u);
    const nr = ENV.ringCount ?? 5;
    for (let n = 0; n < nr; n++) {
      const t0 = HIT + 14 + n * ((LIFE_END - HIT - 40) / nr);
      const k = p(u, t0, t0 + 44);
      if (k <= 0 || k >= 1) continue;
      ["red", "blue"].forEach((x, xi) => {
        const c = CENTER[x];
        const kk = clamp(k - xi * 0.08);
        if (kk <= 0) return;
        const r = lerp(40, Math.min(560, c[1] - TOP - 30), eo(kk));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, TOP + 40, W, H * 0.8 - TOP);
        ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = rgbaHex(x === "red" ? RED : BLUE, ENV.rings * (1 - kk) * lvl);
        ctx.lineWidth = lerp(2.5, 0.8, kk);
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], r, r * 0.82, x === "red" ? 0.3 : -0.3, 0, TAU);
        ctx.stroke();
        ctx.restore();
      });
    }
  }
  // Arcos eléctricos breves entre las dos X.
  function drawArcs(ctx, u) {
    if (!ENV || !ENV.arcs) return;
    for (let n = 0; n < ENV.arcs; n++) {
      const t0 = lerp(HIT + 20, LIFE_END - 16, n / Math.max(1, ENV.arcs - 1));
      const v = u - t0;
      if (v < 0 || v > 6) continue;
      const G = rng(900 + n * 17 + Math.floor(u));
      const bl = BARS[4 + (n % 4)];
      const rd = BARS[n % 4];
      const A = at(bl, lerp(0.35, 0.65, G()));
      const B = at(rd, lerp(0.35, 0.65, G()));
      const a = Math.sin((Math.PI * v) / 6);
      const pts = [A];
      for (let k = 1; k < 9; k++) {
        const q = k / 9;
        pts.push([lerp(A[0], B[0], q) + lerp(-26, 26, G()), lerp(A[1], B[1], q) + lerp(-26, 26, G())]);
      }
      pts.push(B);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(220,235,255,${0.9 * a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.stroke();
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= a;
        e.strokeStyle = "#b8d8ff";
        e.lineWidth = 5;
        e.beginPath();
        pts.forEach((q, k) => (k ? e.lineTo(q[0], q[1]) : e.moveTo(q[0], q[1])));
        e.stroke();
      });
    }
  }


  // Estado de cada barra en el tiempo local u (cuadros desde el inicio del
  // ciclo; puede ser > T para lo que viene del ciclo anterior).
  function barState(bar, u) {
    // Formación: sale del cruce hacia las dos puntas.
    const d = u - HIT - (bar.i % 4) * 0.6 - (bar.x === "red" ? 0.4 : 0);
    if (d < 0) return null;
    const e = spring(d, V.snap ?? 0.95, 0.5);
    let s0 = bar.c - bar.c * e;
    let s1 = bar.c + (1 - bar.c) * e;
    // Encendido de tubo: dos parpadeos y luz firme.
    const fl = d < 1 ? 1.6 : d < 2 ? 0.35 : d < 3 ? 1.2 : d < 4 ? 0.55 : 1;
    // Drenaje: la luz baja por el tubo y sale por abajo.
    const dd = p(u, LIFE_END + (bar.i % 4) * 5, DRAIN_END - 12 + (bar.i % 4) * 3);
    const q = eio(dd);
    s1 = Math.min(s1, lerp(1.03, -0.03, q));
    s0 = Math.min(s0, s1);
    if (s1 - s0 < 0.002) return null;
    return { s0: clamp(s0, -0.05, 1.05), s1: clamp(s1, -0.05, 1.05), fl, drain: q, d };
  }

  function drawTube(ctx, bar, st, t, u) {
    const A = at(bar, st.s0);
    const B = at(bar, st.s1);
    const breathe = 1 + V.breathe * Math.sin(TAU * (t / T) * 2 + bar.i * 0.4);
    const alt = V.alternate ? 1 + V.alternate * Math.sin(TAU * (t / T) * 3 + (bar.x === "red" ? 0 : Math.PI)) : 1;
    const flash = Math.exp(-Math.max(0, st.d) / 3.5) * V.flash;
    const k = clamp(st.fl * breathe * alt, 0, 1.6);
    const w = V.width;
    // Cuerpo del tubo.
    ctx.save();
    if (V.additive) ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp(V.body * k);
    ctx.fillStyle = flash > 0.02 ? mixW(bar.color, clamp(flash)) : bar.color;
    barPath(ctx, A, B, w);
    ctx.fill();
    // Núcleo: la parte caliente del tubo.
    ctx.globalAlpha = clamp(V.core * k);
    ctx.fillStyle = mixW(bar.color, clamp(V.coreWhite + flash));
    barPath(ctx, A, B, w * V.coreWidth);
    ctx.fill();
    ctx.restore();
    // Resplandor (capa emisiva): el bloom del neón.
    emit(ctx, (e) => {
      e.globalAlpha *= clamp(V.glow * k * (1 + flash));
      e.fillStyle = mixW(bar.color, flash * 0.6);
      barPath(e, A, B, w * 1.1);
      e.fill();
    });
  }

  // Pulsos que recorren los tubos del cruce hacia afuera (vida).
  function drawPulses(ctx, bar, st, t, u) {
    if (!V.pulses) return;
    const life = p(u, HIT + 8, HIT + 22) * (1 - st.drain);
    if (life <= 0.01) return;
    for (let j = 0; j < V.pulses; j++) {
      // Periódico dentro de la vida: sale del cruce y viaja a una punta.
      const ph = mod((u - HIT) / V.pulsePeriod + j / V.pulses + bar.i * 0.13, 1);
      const dir = j % 2 ? 1 : -1;
      const s = bar.c + dir * ph * (dir > 0 ? 1 - bar.c : bar.c);
      if (s < st.s0 || s > st.s1) continue;
      const a = life * Math.sin(Math.PI * ph);
      const L = 70 / bar.len;
      const A = at(bar, clamp(s - L / 2, st.s0, st.s1));
      const B = at(bar, clamp(s + L / 2, st.s0, st.s1));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.8 * a * V.pulseAmt;
      ctx.fillStyle = mixW(bar.color, 0.7);
      barPath(ctx, A, B, V.width * 0.7);
      ctx.fill();
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= a * V.pulseAmt;
        e.fillStyle = mixW(bar.color, 0.5);
        barPath(e, A, B, V.width * 1.4);
        e.fill();
      });
    }
  }

  // Ola de luz a los 5,5 s: un trazo blanco recorre las ocho barras en secuencia.
  function drawWave(ctx, bar, st, u) {
    if (!V.wave) return;
    const w0 = 165 + bar.i * 2.2;
    const k = p(u, w0, w0 + 14);
    if (k <= 0 || k >= 1) return;
    const s = lerp(-0.1, 1.1, eio(k));
    const L = 0.22;
    const a0 = clamp(s - L, st.s0, st.s1);
    const a1 = clamp(s, st.s0, st.s1);
    if (a1 - a0 < 0.002) return;
    const A = at(bar, a0);
    const B = at(bar, a1);
    const a = Math.sin(Math.PI * k) * V.wave;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, `rgba(255,255,255,${0.9 * a})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.stroke();
    ctx.restore();
    emit(ctx, (e) => {
      e.globalAlpha *= a;
      e.strokeStyle = "#ffffff";
      e.lineWidth = 6;
      e.beginPath();
      e.moveTo(A[0], A[1]);
      e.lineTo(B[0], B[1]);
      e.stroke();
    });
  }

  // Guía de circuito: líneas finísimas que se trazan donde van las barras.
  function drawGuide(ctx, u) {
    if (!V.guide) return;
    const k = p(u, 18, 78);
    const out = p(u, HIT - 2, HIT + 10);
    const keep = (V.guideLife ?? 0) * p(u, HIT + 10, HIT + 30) * (1 - p(u, LIFE_END, LIFE_END + 30));
    const a = Math.max(V.guide * (1 - out), keep);
    if (k <= 0 || a <= 0.01) return;
    ctx.save();
    ctx.lineWidth = 1;
    BARS.forEach((bar) => {
      if (bar.i % 2) return;
      const s = eio(clamp(k * 1.2 - (bar.i % 4) * 0.05));
      // La guía también crece desde el cruce.
      const A = at(bar, bar.c - bar.c * s);
      const B = at(bar, bar.c + (1 - bar.c) * s);
      const mx = (bar.b[0] + at(bar, 1)[0]) / 2;
      ctx.strokeStyle = rgbaHex(bar.color, 0.35 * a);
      ctx.beginPath();
      ctx.moveTo(A[0] + SPACING / 2, A[1]);
      ctx.lineTo(B[0] + SPACING / 2, B[1]);
      ctx.stroke();
      // Marcas de medición a lo largo, como una interfaz de máquina.
      ctx.fillStyle = rgbaHex(bar.color, 0.5 * a);
      for (let m = 0.1; m < 1; m += 0.08) {
        if (m < bar.c - bar.c * s || m > bar.c + (1 - bar.c) * s) continue;
        const P = at(bar, m);
        ctx.fillRect(P[0] + SPACING / 2 - 5, P[1], 10, 1);
      }
      void mx;
    });
    // Nodos en los cruces.
    ["red", "blue"].forEach((x) => {
      const c = CENTER[x];
      ctx.strokeStyle = rgbaHex(x === "red" ? RED : BLUE, 0.5 * a);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 14 + 4 * Math.sin(u * 0.3), 0, TAU);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Hilos de luz que fluyen hacia el cruce (aproximación).
  function drawThreads(ctx, u) {
    THREADS.forEach((th) => {
      if (u < th.start || u > HIT + 2) return;
      const c = CENTER[th.x];
      const color = th.x === "red" ? RED : BLUE;
      // Recorrido: curva de Bézier del borde al cruce, con ondulación; se
      // acelera hacia el golpe (llegada exacta en HIT).
      const pos = (v) => {
        const q = ei(clamp((v - th.start) / (HIT - th.start))) * 0.55 + eio(clamp((v - th.start) / (HIT - th.start))) * 0.45;
        const a = th.p0;
        const b = th.c1;
        const x = (1 - q) * (1 - q) * a[0] + 2 * (1 - q) * q * b[0] + q * q * c[0];
        const y = (1 - q) * (1 - q) * a[1] + 2 * (1 - q) * q * b[1] + q * q * c[1];
        const wv = th.wig * Math.sin(q * Math.PI) * Math.sin(q * 7 + th.ph);
        return [x + wv * 0.6, y + wv];
      };
      const fade = p(u, th.start, th.start + 10) * (1 - p(u, HIT - 1, HIT + 2));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const N = 14;
      for (let k = 0; k < N; k++) {
        const v0 = u - (k + 1) * 1.4;
        const v1 = u - k * 1.4;
        if (v0 < th.start) break;
        const P0 = pos(v0);
        const P1 = pos(v1);
        const a = fade * (1 - k / N);
        ctx.strokeStyle = k < 2 ? `rgba(255,255,255,${0.9 * a})` : rgbaHex(color, 0.8 * a);
        ctx.lineWidth = th.w * (1 - (k / N) * 0.6);
        ctx.beginPath();
        ctx.moveTo(P0[0], P0[1]);
        ctx.lineTo(P1[0], P1[1]);
        ctx.stroke();
      }
      ctx.restore();
      const H0 = pos(u);
      emit(ctx, (e) => {
        e.globalAlpha *= fade * 0.9;
        e.fillStyle = color;
        e.beginPath();
        e.arc(H0[0], H0[1], 6, 0, TAU);
        e.fill();
      });
    });
  }

  // Carga en los cruces: crece hasta el golpe y estalla.
  function drawCharge(ctx, u) {
    ["red", "blue"].forEach((x) => {
      const c = CENTER[x];
      const color = x === "red" ? RED : BLUE;
      const grow = ei(p(u, 40, HIT));
      const burst = Math.exp(-Math.max(0, u - HIT) / 3) * (u >= HIT ? 1 : 0);
      const a = u < HIT ? grow : burst;
      if (a < 0.01) return;
      const r = u < HIT ? lerp(4, 22, grow) : lerp(22, 60, 1 - burst);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 3);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
      g.addColorStop(0.25, rgbaHex(color, 0.7 * a));
      g.addColorStop(1, rgbaHex(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - r * 3, c[1] - r * 3, r * 6, r * 6);
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= a * V.chargeGlow;
        e.fillStyle = "#ffffff";
        e.beginPath();
        e.arc(c[0], c[1], r, 0, TAU);
        e.fill();
      });
    });
  }

  // Onda de choque del golpe: anillo fino, acotado para no subir al reloj.
  function drawShock(ctx, u) {
    if (!V.shock) return;
    const k = p(u, HIT, HIT + 16);
    if (k <= 0 || k >= 1) return;
    ["red", "blue"].forEach((x) => {
      const c = CENTER[x];
      const r = lerp(20, Math.min(460, c[1] - TOP - 40), eo(k));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k) * V.shock})`;
      ctx.lineWidth = lerp(5, 1, k);
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], r * 1.05, r * 0.95, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawShards(ctx, u) {
    SHARDS.forEach((s) => {
      const v = u - HIT - 1;
      if (v < 0 || v > s.life) return;
      const x = s.c[0] + s.vx * v * 0.92;
      const y = s.c[1] + s.vy * v + 0.5 * s.g * v * v;
      const a = clamp(v / 2) * (1 - p(v, s.life * 0.6, s.life));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot + s.vr * v);
      ctx.scale(s.size, s.size);
      ctx.globalAlpha = a * V.shardAlpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      s.pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (s.color === "#ffffff" && s.depth > 1) {
        emit(ctx, (e) => {
          e.globalAlpha *= a * 0.5;
          e.fillStyle = "#ffffff";
          e.beginPath();
          e.arc(x, y, s.size * 0.6, 0, TAU);
          e.fill();
        });
      }
    });
  }

  function drawSpeed(ctx, u) {
    SPEED.forEach((l) => {
      const v = u - HIT - l.t0;
      if (v < 0 || v > 9) return;
      const x = l.d > 0 ? -l.len + v * l.v : W + l.len - v * l.v;
      const a = Math.sin((Math.PI * v) / 9) * V.speedAlpha;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(x - l.len * l.d, 0, x, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, `rgba(255,255,255,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x, x - l.len * l.d), l.y, l.len, l.w);
      ctx.restore();
    });
  }

  // Trazos finísimos que cruzan la franja útil en diagonal (como en ref-5).
  function drawStreaks(ctx, u) {
    STREAKS.forEach((st) => {
      const k = p(u, st.t0, st.t0 + 16);
      if (k <= 0 || k >= 1) return;
      const ang = st.slope * (Math.PI / 2 - 0.4);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const x = st.x0 + st.dir * lerp(-420, 420, k);
      const cy = lerp(TOP + 200, H * 0.78, 0.5);
      const L = 1500;
      const a = Math.sin(Math.PI * k) * 0.55;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, TOP + 120, W, H * 0.8 - TOP - 120);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(x - dx * L, cy - dy * L, x + dx * L, cy + dy * L);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = st.w;
      ctx.beginPath();
      ctx.moveTo(x - dx * L, cy - dy * L);
      ctx.lineTo(x + dx * L, cy + dy * L);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawSparks(ctx, u) {
    SPARKS.forEach((sk) => {
      const v = u - sk.t0;
      if (v < 0 || v > sk.life) return;
      const c = CENTER[sk.x];
      const x = c[0] + sk.vx * v;
      const y = c[1] + sk.vy * v + 0.5 * 0.16 * v * v;
      const a = Math.sin((Math.PI * v) / sk.life);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = mixW(sk.x === "red" ? RED : BLUE, 0.6);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, sk.s, 0, TAU);
      ctx.fill();
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= a * 0.8;
        e.fillStyle = sk.x === "red" ? RED : BLUE;
        e.beginPath();
        e.arc(x, y, sk.s * 3, 0, TAU);
        e.fill();
      });
    });
  }

  // Gotas de luz que caen por la punta inferior durante el drenaje.
  function drawDrops(ctx, u) {
    DROPS.forEach((dp) => {
      const bar = BARS[dp.bar];
      const t0 = lerp(LIFE_END + 10, DRAIN_END - 10, dp.t0);
      const v = u - t0;
      if (v < 0 || v > 60) return;
      const x = bar.b[0] + dp.vx * v;
      const y = bar.b[1] + 0.5 * 0.35 * v * v + 2 * v;
      const a = (1 - v / 60) * V.drops2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = mixW(bar.color, 0.4);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(x, y, dp.s, dp.s * 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      emit(ctx, (e) => {
        e.globalAlpha *= a * 0.7;
        e.fillStyle = bar.color;
        e.beginPath();
        e.arc(x, y, dp.s * 2, 0, TAU);
        e.fill();
      });
    });
  }

  // Polvo ambiental, periódico: cada partícula da vueltas enteras por ciclo.
  function drawDust(ctx, t) {
    const ph = (t / T) * TAU;
    ctx.save();
    DUST.forEach((d) => {
      const x = d.x + d.r * Math.cos(ph * d.m + d.ph);
      const y = d.y + d.r * 0.6 * Math.sin(ph * d.m + d.ph);
      const a = V.dustAlpha * (0.5 + 0.5 * Math.sin(ph * (d.m + 1) + d.ph * 2));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, d.s, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  // Aberración por copias R, G y B desplazadas (variante 03): el desplazamiento
  // es grande en la aproximación, se funde en el golpe y se reabre al drenar.
  function rgbOffset(u) {
    if (!V.rgbSplit) return 0;
    const before = u < HIT ? lerp(V.rgbSplit, 0, eio(p(u, 30, HIT))) : 0;
    const life = u >= HIT ? V.rgbLife * (1 + 0.5 * Math.sin((u - HIT) * 0.12)) : 0;
    const drain = V.rgbSplit * 0.8 * eio(p(u, LIFE_END, DRAIN_END));
    return before + life + drain;
  }

  function drawBars(ctx, t, u) {
    const order = ["red", "blue"];
    order.forEach((x) =>
      BARS.filter((b) => b.x === x).forEach((bar) => {
        const st = barState(bar, u);
        if (!st) return;
        const sway = V.sway * Math.sin(TAU * (t / T) + bar.i * 0.2);
        ctx.save();
        ctx.translate(sway, 0);
        drawTube(ctx, bar, st, t, u);
        drawPulses(ctx, bar, st, t, u);
        drawWave(ctx, bar, st, u);
        ctx.restore();
      }),
    );
  }

  // Tubos en tres copias de canal (variante 03).
  function drawBarsSplit(ctx, t, u, off) {
    const chans = [
      ["#ff0000", [-1, -0.3]],
      ["#00ff00", [0, 0]],
      ["#0000ff", [1, 0.3]],
    ];
    ["red", "blue"].forEach((x) =>
      BARS.filter((b) => b.x === x).forEach((bar) => {
        const st = barState(bar, u);
        if (!st) return;
        const [r, g, b] = hexToRgb(bar.color);
        const k = clamp(st.fl * (1 + V.breathe * Math.sin(TAU * (t / T) * 2 + bar.i * 0.4)), 0, 1.6);
        const flash = Math.exp(-Math.max(0, st.d) / 3.5) * V.flash;
        chans.forEach(([, o], ci) => {
          const comp = [0, 0, 0];
          comp[ci] = Math.round(lerp([r, g, b][ci], 255, clamp(flash)));
          const A = at(bar, st.s0);
          const B = at(bar, st.s1);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.translate(o[0] * off, o[1] * off);
          ctx.globalAlpha = clamp(V.body * k);
          ctx.fillStyle = `rgb(${comp[0]},${comp[1]},${comp[2]})`;
          barPath(ctx, A, B, V.width);
          ctx.fill();
          ctx.globalAlpha = clamp(V.core * k * 0.7);
          const cc = comp.map((v, j) => (j === ci ? 255 : 0));
          ctx.fillStyle = `rgb(${cc[0]},${cc[1]},${cc[2]})`;
          barPath(ctx, A, B, V.width * V.coreWidth);
          ctx.fill();
          ctx.restore();
        });
        emit(ctx, (e) => {
          e.globalAlpha *= clamp(V.glow * k * (1 + flash));
          e.fillStyle = bar.color;
          barPath(e, at(bar, st.s0), at(bar, st.s1), V.width * 1.6 + off);
          e.fill();
        });
        drawPulses(ctx, bar, st, t, u);
        drawWave(ctx, bar, st, u);
      }),
    );
  }

  let glitchBuf = null;
  // Glitch del golpe: franjas horizontales corridas, solo en la franja útil.
  function glitch(ctx, u) {
    if (!V.glitch) return;
    const v = Math.floor(u) - HIT;
    if (v < 1 || v > 3) return;
    const cv = ctx.canvas;
    const sc = ctx.getTransform().a;
    const G = rng(1000 + v);
    // Copia del cuadro antes de correr las franjas (dibujar el lienzo sobre sí
    // mismo no está garantizado).
    if (!glitchBuf || glitchBuf.width !== cv.width) glitchBuf = createCanvas(cv.width, cv.height);
    const gb = glitchBuf.getContext("2d");
    gb.clearRect(0, 0, cv.width, cv.height);
    gb.drawImage(cv, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let k = 0; k < V.glitch; k++) {
      const y = Math.round(lerp(TOP + 260, H * 0.74, G()) * sc);
      const h = Math.round(lerp(6, 46, G()) * sc);
      const dx = Math.round(lerp(-70, 70, G()) * sc);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, y, cv.width, h);
      ctx.drawImage(glitchBuf, 0, y, cv.width, h, dx, y, cv.width, h);
    }
    ctx.restore();
  }

  function draw(ctx, t) {
    ctx.save();
    ctx.scale(K, K);
    drawDesign(ctx, t);
    ctx.restore();
  }
  function drawDesign(ctx, t) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    const base = mod(t, T);
    drawDust(ctx, t);
    // Ciclo actual y anterior (lo que cruza el corte sigue del otro lado).
    for (const u of [base, base + T]) {
      if (ENV && u < T) {
        drawSpill(ctx, t, u);
        drawCircuit(ctx, u);
        drawRings(ctx, u);
        drawOrbit(ctx, t, u);
      }
      if (SIDES) {
        if (u < T) drawBarsSides(ctx, t, u);
        if (u >= HIT - 10) {
          drawCharge(ctx, u);
          drawShock(ctx, u);
          if (V.shards) drawShards(ctx, u);
          if (V.speedLines) drawSpeed(ctx, u);
          if (SPARKS.length) drawSparks(ctx, u);
          if (ENV && u < T) drawArcs(ctx, u);
        }
        if (u < T) glitch(ctx, u);
        continue;
      }
      if (u < T) {
        if (u < HIT + 12 || V.guideLife) drawGuide(ctx, u);
        drawThreads(ctx, u);
      }
      if (u >= HIT - 10) {
        if (V.rgbSplit) drawBarsSplit(ctx, t, u, rgbOffset(u));
        else drawBars(ctx, t, u);
        drawCharge(ctx, u);
        drawShock(ctx, u);
        if (V.shards) drawShards(ctx, u);
        if (V.speedLines) drawSpeed(ctx, u);
        if (V.drops) drawDrops(ctx, u);
        if (STREAKS.length) drawStreaks(ctx, u);
        if (SPARKS.length) drawSparks(ctx, u);
      } else if (u < HIT) drawCharge(ctx, u);
      if (u < T) glitch(ctx, u);
    }
  }

  // Motion blur: más muestras en el golpe y en los tramos rápidos.
  function motion(f) {
    const u = mod(f, T);
    if (u >= HIT - 1 && u < HIT + 12) return { shutter: 0.6, samples: 12 };
    if (u >= HIT - 30 && u < HIT) return { shutter: 0.5, samples: 8 };
    return { shutter: 0.5, samples: 6 };
  }
  function grade(f) {
    const u = mod(f, T);
    const spike = u >= HIT ? Math.exp(-(u - HIT) / 3) : 0;
    return {
      emissive: V.emissive,
      glowTint: "source",
      glowRadii: (V.glowRadii ?? [14, 44]).map((r) => r * K),
      glowAmounts: V.glowAmounts ?? [0.55, 0.3],
      ca: ((V.caBase ?? 0) + (V.caSpike ?? 0) * spike) * K,
      rowGain: GAIN,
    };
  }

  return { id: V.id, width: WALLPAPER.w, height: WALLPAPER.h, fps: FPS, duration: T, scenes: [], draw, motion, grade };
}
