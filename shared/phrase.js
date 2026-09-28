// Motor de frases (tratamiento final 2.3, 2.8 y 2.9).
//
// Regla de oro: cada frase se diagrama UNA vez, a su peso y tracking de
// reposo, midiendo prefijos (así conserva el kerning). Después cada glifo se
// dibuja siempre en su lugar mientras animan su peso, escala, opacidad y
// desplazamientos. Si se re-diagramara por frame, el texto se deslizaría a
// mitad de la lectura: entre wght 200 y 800 el avance cambia ~10 %.
//
// El punto final no es un glifo: es un objeto (un círculo de acento) con su
// propio handle, porque es el actor que cruza a la escena siguiente.
//
// Un "programa" es una lista de presets. Cada preset es una función
// (t, g, st, ph) que modifica el estado del glifo g. Se aplican en orden, así
// que se componen: una entrada + golpes de pulso + una salida.

import { setType, FAMILY } from "../engine/text.js";
import { clamp, lerp } from "../engine/math.js";
import { EASE, SPR, spr, weightBump as wb } from "./system.js";
import { createCanvas } from "@napi-rs/canvas";

const mctx = createCanvas(8, 8).getContext("2d");

// ─── medición ────────────────────────────────────────────────────────────────

// Avance de un glifo a un peso dado, con cache cada 10 de wght (E4).
const advCache = new Map();
export function advance(ch, size, weight) {
  const wq = Math.round(weight / 10) * 10;
  const key = ch + "|" + size + "|" + wq;
  let v = advCache.get(key);
  if (v === undefined) {
    setType(mctx, { size, weight: wq, tracking: 0 });
    v = mctx.measureText(ch).width;
    advCache.set(key, v);
  }
  return v;
}

function measure(str, size, weight, tracking) {
  setType(mctx, { size, weight, tracking });
  return mctx.measureText(str).width;
}

// ─── construcción ────────────────────────────────────────────────────────────
// opts: { text, size, wght = 760, tracking = -0.045, x, baseline,
//         align = 'left' | 'center' | 'right', color, periodColor }
// Si el texto termina en ".", ese punto se separa como objeto.

export function makePhrase(opts) {
  const { text, size, wght = 760, tracking = -0.045, baseline, align = "left", color = "#1c1917", periodColor = "#c2410c" } = opts;
  const hasPeriod = text.endsWith(".") && !text.endsWith("..");
  const chars = Array.from(text);
  const trackPx = tracking * size;
  const items = [];
  let prefix = "";
  let prev = 0;
  let word = 0;
  let wordStart = true;
  const words = [];
  chars.forEach((ch, i) => {
    const x = prev;
    prefix += ch;
    const wp = measure(prefix, size, wght, tracking);
    const w = wp - x - trackPx;
    if (ch === " ") {
      wordStart = true;
    } else {
      if (wordStart) {
        words.push({ from: items.length, to: items.length, x, w: 0, text: "" });
        word = words.length - 1;
        wordStart = false;
      }
      const isPeriod = hasPeriod && i === chars.length - 1;
      items.push({ ch, x, w, i: items.length, word, isPeriod, wordLocal: items.length - words[word].from });
      const wd = words[word];
      wd.to = items.length - 1;
      wd.text += ch;
      wd.w = x + w - wd.x;
    }
    prev = wp;
  });
  const width = prev - trackPx;
  const x0 = align === "center" ? opts.x - width / 2 : align === "right" ? opts.x - width : opts.x;
  setType(mctx, { size, weight: wght, tracking: 0 });
  const cap = mctx.measureText("H").actualBoundingBoxAscent;
  const xh = mctx.measureText("x").actualBoundingBoxAscent;

  // Handle del punto: centro de la tinta del glifo "." en la diagramación.
  let period = null;
  const glyphs = items.filter((g) => !g.isPeriod);
  if (hasPeriod) {
    const pg = items[items.length - 1];
    const m = mctx.measureText(".");
    const inkL = -m.actualBoundingBoxLeft;
    const inkR = m.actualBoundingBoxRight;
    const inkT = m.actualBoundingBoxAscent;
    const d = Math.min(inkR - inkL, inkT + m.actualBoundingBoxDescent);
    period = { cx: x0 + pg.x + (inkL + inkR) / 2, cy: baseline - (inkT - m.actualBoundingBoxDescent) / 2, r: d / 2, d };
    // El punto no forma parte de las palabras (su última palabra termina antes).
    const lw = words[pg.word];
    if (lw.to === pg.i) {
      lw.to = pg.i - 1;
      lw.text = lw.text.slice(0, -1);
      const lastG = items[pg.i - 1];
      lw.w = lastG.x + lastG.w - lw.x;
    }
  }
  for (const g of glyphs) g.ax = x0 + g.x; // x absoluta del inicio del glifo
  for (const wd of words) {
    wd.ax = x0 + wd.x;
    wd.cx = wd.ax + wd.w / 2;
  }
  return {
    text,
    size,
    wght,
    tracking,
    baseline,
    color,
    periodColor,
    x: x0,
    width,
    cap,
    xh,
    glyphs,
    words,
    period,
    n: glyphs.length,
  };
}

// ─── dibujo ──────────────────────────────────────────────────────────────────

function baseState(ph) {
  return {
    dx: 0,
    dy: 0,
    scale: 1,
    sx: 1,
    sy: 1,
    rot: 0,
    alpha: 1,
    weight: ph.wght,
    wAdd: 0,
    color: ph.color,
    clip: null, // {x0, x1, y0, y1} en coordenadas absolutas
    split: null, // {top, bottom, cutY} desplazamientos x de las mitades (Corte)
  };
}

// Dibuja los glifos (sin el punto). program: lista de presets.
// o.colorOverride fuerza el color (para la inversión por máscara).
export function drawPhrase(ctx, ph, t, program = [], o = {}) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const g of ph.glyphs) {
    const st = baseState(ph);
    for (const fn of program) fn(t, g, st, ph);
    if (st.alpha <= 0.002 || st.scale <= 0.002) continue;
    const weight = clamp(st.weight + st.wAdd, 200, 800);
    const adv = advance(g.ch, ph.size, weight);
    // Pivote: centro de la caja del glifo a media altura de mayúscula.
    const cx = g.ax + g.w / 2 + st.dx;
    const cy = ph.baseline - ph.cap / 2 + st.dy;
    ctx.save();
    ctx.globalAlpha *= st.alpha;
    if (st.clip) {
      ctx.beginPath();
      ctx.rect(st.clip.x0, st.clip.y0, st.clip.x1 - st.clip.x0, st.clip.y1 - st.clip.y0);
      ctx.clip();
    }
    ctx.fillStyle = o.colorOverride ?? st.color;
    if (st.split) {
      // Corte: la mitad de arriba y la de abajo con desplazamientos propios.
      const cutY = ph.baseline - ph.xh / 2;
      for (const half of ["top", "bottom"]) {
        ctx.save();
        ctx.beginPath();
        if (half === "top") ctx.rect(-1e4, -1e4, 3e4, cutY + 1e4);
        else ctx.rect(-1e4, cutY, 3e4, 2e4);
        ctx.clip();
        ctx.translate(cx + st.split[half], cy);
        glyphXform(ctx, st);
        setType(ctx, { size: ph.size, weight, tracking: 0 });
        ctx.fillText(g.ch, -adv / 2, ph.cap / 2);
        ctx.restore();
      }
    } else {
      ctx.translate(cx, cy);
      glyphXform(ctx, st);
      setType(ctx, { size: ph.size, weight, tracking: 0 });
      ctx.fillText(g.ch, -adv / 2, ph.cap / 2);
    }
    ctx.restore();
  }
}

function glyphXform(ctx, st) {
  if (st.rot) ctx.rotate(st.rot);
  const s = st.scale;
  if (s !== 1 || st.sx !== 1 || st.sy !== 1) ctx.scale(s * st.sx, s * st.sy);
}

// Dibuja el punto como círculo. state: { x, y, scale, alpha, color } (x, y
// opcionales para cuando el punto ya salió volando).
export function drawDot(ctx, cx, cy, d, color, { scale = 1, alpha = 1 } = {}) {
  if (scale <= 0.001 || alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, (d / 2) * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Punto de la frase en su lugar, con pop opcional.
// pop: { H, from = 1.7, cfg = SPR.slam } ; alpha/visible controlados afuera.
export function periodScale(t, pop) {
  if (!pop) return 1;
  if (t < pop.H) return pop.before ?? 0;
  return lerp(pop.from ?? 1.7, 1, spr(t, pop.H, pop.cfg ?? SPR.slam));
}

// ─── presets ─────────────────────────────────────────────────────────────────
// Todos devuelven una función (t, g, st, ph). `word` opcional limita el preset
// a una palabra (índice en ph.words).

const inWord = (g, word) => word === undefined || g.word === word;

// K1 "Golpe": slam de palabra con escala desde la base de la palabra.
export const golpe = (H, word) => (t, g, st, ph) => {
  if (!inWord(g, word)) return;
  const wd = ph.words[g.word];
  let s;
  if (t < H - 3) {
    st.alpha = 0;
    return;
  } else if (t < H) s = lerp(1.16, 0.97, EASE.accel((t - H + 3) / 3));
  else if (t < H + 3) s = lerp(0.97, 1.012, EASE.brake((t - H) / 3));
  else if (t < H + 8) s = lerp(1.012, 1, EASE.swell((t - H - 3) / 5));
  else s = 1;
  const k = clamp((t - (H - 3)) / 2);
  st.alpha *= k;
  st.weight = t < H ? lerp(300, 800, EASE.accel(clamp((t - H + 3) / 3))) : lerp(800, 760, EASE.swell(clamp((t - H) / 8)));
  if (t < H) st.dy += lerp(-0.06 * ph.size, 0, EASE.accel(clamp((t - H + 3) / 3)));
  // Escala desde la base central de la palabra.
  const gcx = g.ax + g.w / 2;
  st.dx += (gcx - wd.cx) * (s - 1);
  st.dy += (ph.cap / 2) * (1 - s);
  st.scale *= s;
};

// K1r "Envío": sube como un mensaje enviado.
export const envio = (H, word) => (t, g, st, ph) => {
  if (!inWord(g, word)) return;
  const S = H - 3;
  if (t < S) {
    st.alpha = 0;
    return;
  }
  st.dy += lerp(0.45 * ph.size, 0, spr(t, S, SPR.snap));
  st.alpha *= clamp((t - S) / 2);
  st.weight = lerp(400, ph.wght, EASE.ink(clamp((t - S) / 6)));
};

// KT "Entintado": la tinta carga en el lugar. stagger por glifo.
export const tinta = (H, { word, stagger, from = 200, peak = 820, rise = 24 } = {}) => (t, g, st, ph) => {
  if (!inWord(g, word)) return;
  const n = word === undefined ? ph.n : ph.words[word].to - ph.words[word].from + 1;
  const idx = word === undefined ? g.i : g.i - ph.words[word].from;
  const sg = stagger ?? (n > 10 ? 0.6 : 0.8);
  const h = H + idx * sg;
  if (t < h - 4) {
    st.alpha = 0;
    return;
  }
  st.dy += lerp(rise, 0, EASE.glide(clamp((t - h + 4) / 4)));
  st.alpha *= clamp((t - h + 4) / 3);
  if (t < h + 2) st.weight = lerp(from, peak, EASE.ink(clamp((t - h + 4) / 6)));
  else st.weight = lerp(peak, ph.wght, EASE.swell(clamp((t - h - 2) / 4)));
};

// KC "Cierre": el tracking se cierra de +0.35em a reposo en H.
export const cierre = (H, word) => (t, g, st, ph) => {
  if (!inWord(g, word)) return;
  const k = EASE.brake(clamp((t - (H - 6)) / 6));
  const extra = lerp(0.35, 0, k) * ph.size;
  const idx = word === undefined ? g.i : g.wordLocal;
  st.dx += idx * extra;
  st.weight = lerp(300, ph.wght, EASE.ink(clamp((t - (H - 6)) / 6)));
  st.alpha *= clamp((t - (H - 7)) / 3);
};

// KX "Corte": mitades que entran desde lados opuestos y se juntan en H.
export const corte = (H, word, dist = 60) => (t, g, st, ph) => {
  if (!inWord(g, word)) return;
  if (t < H - 6) {
    st.alpha = 0;
    return;
  }
  const k = EASE.brake(clamp((t - (H - 6)) / 6));
  st.split = { top: -dist * (1 - k), bottom: dist * (1 - k) };
  st.alpha *= clamp((t - (H - 6)) / 2);
  st.weight = lerp(500, ph.wght, k);
};

// KA "Ajuste": llega desalineado en H y se alinea con snap desde H+1.
// offsets[i] (px en y) y rots[i] (grados) por glifo de la frase (el punto usa
// el último valor, lo aplica quien dibuja el punto).
export const ajuste = (H, offsets, rots) => (t, g, st, ph) => {
  const i = g.i;
  const oy = offsets[i] ?? 0;
  const or = ((rots[i] ?? 0) * Math.PI) / 180;
  if (t < H - 4) {
    st.alpha = 0;
    return;
  }
  const inK = EASE.brake(clamp((t - (H - 4)) / 4));
  st.alpha *= clamp((t - (H - 4)) / 3);
  const fix = spr(t, H + 1 + i * 0.5, SPR.snap);
  st.dy += lerp(oy + 20, oy, inK) * (1 - fix);
  st.rot += or * (1 - fix);
  st.weight = lerp(300, ph.wght, EASE.ink(clamp((t - (H - 4)) / 6)));
};

// KR "Carrete": rueda dentro de una máscara de columna.
// mask: {x0, x1, y0, y1}; entra desde +D y contacta en tIn; sale hacia -D
// desde tOut. La entrada suma el entintado 200 → reposo en 4 f.
export const carrete = ({ mask, D, tIn, tOut = Infinity }) => (t, g, st, ph) => {
  st.clip = mask;
  if (t < tIn - 8) {
    st.alpha = 0;
    return;
  }
  let y = 0;
  if (t < tIn) y = lerp(D, 0, EASE.lunge((t - (tIn - 8)) / 8));
  if (t > tOut) y = lerp(0, -D, EASE.lunge(clamp((t - tOut) / 8)));
  st.dy += y;
  if (t >= tIn) st.weight = lerp(200, ph.wght, EASE.ink(clamp((t - tIn) / 4)));
  else st.weight = 200;
};

// KS "Barrido de lectura": glifos a wght 200 y una banda que los entinta.
export const barrido = (H, { appear = H - 2, dur = 6, sigma = 40 } = {}) => (t, g, st, ph) => {
  if (t < appear) {
    st.alpha = 0;
    return;
  }
  st.alpha *= clamp((t - appear) / 2);
  const bandX = lerp(ph.x - sigma * 2, ph.x + ph.width + sigma * 2, clamp((t - H) / dur));
  const gx = g.ax + g.w / 2;
  // El glifo queda entintado una vez que la banda lo pasó.
  const passed = clamp((bandX - gx) / (sigma * 1.5) + 0.5);
  st.weight = lerp(200, ph.wght, EASE.ink(passed));
};

// Guía de acento del barrido (se dibuja aparte, debajo de la frase).
export function barridoGuide(ctx, ph, t, H, { dur = 6, color = "#c2410c", sigma = 40 } = {}) {
  const k = clamp((t - H) / dur);
  if (t < H || k >= 1.4) return;
  const bandX = lerp(ph.x - sigma * 2, ph.x + ph.width + sigma * 2, k);
  ctx.save();
  ctx.globalAlpha *= 1 - clamp((t - H - dur) / 4);
  ctx.fillStyle = color;
  ctx.fillRect(ph.x, ph.baseline + ph.size * 0.12, Math.max(0, Math.min(ph.width, bandX - ph.x)), 4);
  ctx.restore();
}

// K5 "Evaporar": por glifo, izquierda a derecha, 0.5 f de stagger, 6 f cada uno.
export const evaporar = (X, { stagger = 0.5, dur = 6 } = {}) => (t, g, st, ph) => {
  const s = X + g.i * stagger;
  if (t <= s) return;
  const k = EASE.accel(clamp((t - s) / dur));
  st.weight = lerp(st.weight, 200, k);
  st.dx += 0.3 * ph.size * k;
  st.dy -= 14 * k;
  st.alpha *= 1 - k;
};

// K6 "Punto primero": la palabra sale del punto hacia la izquierda.
// clipX = borde derecho del recorte (2 px a la izquierda de la tinta del punto).
export const puntoPrimero = (H, clipX) => (t, g, st, ph) => {
  if (t < H + 1) {
    st.alpha = 0;
    return;
  }
  const W = clipX - ph.x;
  st.clip = { x0: -1e4, x1: clipX, y0: -1e4, y1: 1e4 };
  st.dx += lerp(W, 0, EASE.glide(clamp((t - H - 1) / 10)));
  // Acordeón: el glifo j contado desde la derecha arranca corrido y vuelve.
  if (t >= H + 11) {
    const j = ph.n - 1 - g.i;
    st.dx += -(1.5 + 0.9 * j) * (1 - spr(t, H + 11, SPR.snap));
  }
};

// K8 "Onda de peso": un bulto de tinta que viaja por la frase.
export const onda = (t0, amp = 90) => (t, g, st) => {
  st.wAdd += amp * Math.exp(-(((t - t0 - 0.5 * g.i) / 2) ** 2));
};

// Golpes de peso en el lugar en los frames dados.
export const bumps = (frames, amp = 60, word) => (t, g, st) => {
  if (!inWord(g, word)) return;
  for (const H of frames) st.wAdd += wb(t, H, amp);
};

// Inhalación: el peso baja en el lugar antes de un movimiento.
export const inhala = (t0, t1, to = 700) => (t, g, st, ph) => {
  if (t < t0) return;
  st.weight = lerp(st.weight, to, EASE.swell(clamp((t - t0) / (t1 - t0))));
};

// Aparición simple (para textos de UI que no necesitan preset propio).
export const fade = (t0, dur = 3) => (t, g, st) => {
  st.alpha *= clamp((t - t0) / dur);
};

// ¿La frase está entera y quieta? Para la verificación de lectura (E9) cada
// escena declara R y L; esto es un chequeo auxiliar por muestreo: compara el
// estado de los glifos en t y t+1.
export function glyphsStill(ph, t, program, tol = 2) {
  for (const g of ph.glyphs) {
    const a = baseState(ph);
    const b = baseState(ph);
    for (const fn of program) fn(t, g, a, ph);
    for (const fn of program) fn(t + 1, g, b, ph);
    if (a.alpha < 0.98 || b.alpha < 0.98) return false;
    if (Math.hypot(a.dx - b.dx, a.dy - b.dy) > tol) return false;
    if (Math.abs(a.scale - 1) > 0.012) return false;
    if (Math.abs(a.weight + a.wAdd - ph.wght) > 120) return false;
    if (a.clip) {
      // Recortado: tiene que estar entero dentro de la máscara.
      const top = ph.baseline - ph.cap * 1.05 + a.dy;
      const bot = ph.baseline + ph.size * 0.22 + a.dy;
      const gx = g.ax + a.dx;
      if (top < a.clip.y0 || bot > a.clip.y1 || gx < a.clip.x0 || gx + g.w > a.clip.x1) return false;
    }
  }
  return true;
}

export { FAMILY };
