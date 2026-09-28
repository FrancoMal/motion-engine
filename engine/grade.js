// Terminación por píxel: acumulación del motion blur, brillo emisivo, curva de
// tono con split-toning, viñeta de color, grano y aberración cromática. Corre en
// el worker, sobre el frame ya promediado.
//
// Por qué a mano y no con compositing del canvas: el promedio de N sub-frames
// hecho con alpha 1/N en 8 bits redondea en cada paso y corre los colores
// planos. Acá se suma en 16 bits y se divide una sola vez.
//
// El grano, la viñeta y la aberración se aplican DESPUÉS del promedio: si se
// dibujaran en cada sub-frame, el promedio los borraría.

import { createCanvas } from "@napi-rs/canvas";
import { clamp, hexToRgb, rng } from "./math.js";

// ─── acumulación ─────────────────────────────────────────────────────────────

export function accumulate(acc, rgba) {
  // acc: Uint16Array RGBA; rgba: frame del canvas (RGBA, 8 bits). Paso 1 y
  // mismo largo: el JIT lo vectoriza mucho mejor que un salto de 3.
  const n = acc.length;
  for (let i = 0; i < n; i++) acc[i] += rgba[i];
}

// ─── recursos precalculados por resolución ───────────────────────────────────

const cacheByRes = new Map();
function res(w, h) {
  const key = w + "x" + h;
  let r = cacheByRes.get(key);
  if (r) return r;
  // Viñeta: distancia elíptica normalizada al centro, al cuadrado, con caída
  // suave (1 en las esquinas).
  const rad = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ny = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const nx = ((x + 0.5) / w - 0.5) * (w / h) * 0.82;
      const d = (nx * nx + ny * ny) / 0.62;
      rad[y * w + x] = d * d * (3 - 2 * Math.min(1, d));
    }
  }
  // Textura de grano: ruido aproximadamente gaussiano (suma de 3 uniformes).
  const G = 1024;
  const grain = new Float32Array(G * G);
  const r3 = rng(7331);
  for (let i = 0; i < G * G; i++) grain[i] = (r3() + r3() + r3() - 1.5) / 0.5;
  const qw = Math.ceil(w / 4);
  const qh = Math.ceil(h / 4);
  r = { rad, grain, G, qw, qh, q1: createCanvas(qw, qh), q2: createCanvas(qw, qh), q3: createCanvas(qw, qh) };
  cacheByRes.set(key, r);
  return r;
}

// ─── curva de tono ───────────────────────────────────────────────────────────
// Por canal, sobre 4096 niveles de entrada (el promedio tiene más precisión que
// 8 bits). Split-toning aproximado por canal: las sombras se corren hacia
// `shadow` y las luces hacia `highlight`, con pesos (1-v)^2 y v^2, así los
// medios tonos (donde viven el acento y el crema de la marca) casi no se tocan.

const lutCache = new Map();
function lut({ shadow = null, shadowAmt = 0, highlight = null, highlightAmt = 0, contrast = 0, blackLift = null } = {}) {
  const key = JSON.stringify([shadow, shadowAmt, highlight, highlightAmt, contrast, blackLift]);
  let L = lutCache.get(key);
  if (L) return L;
  const sc = shadow ? hexToRgb(shadow).map((c) => c / 255) : [0, 0, 0];
  const hc = highlight ? hexToRgb(highlight).map((c) => c / 255) : [1, 1, 1];
  const bl = blackLift ? hexToRgb(blackLift).map((c) => c / 255) : [0, 0, 0];
  L = [0, 1, 2].map((c) => {
    const t = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      let v = i / 4095;
      if (contrast) {
        const s = v * v * (3 - 2 * v);
        v = v + (s - v) * contrast;
      }
      if (shadowAmt) {
        const w = (1 - v) * (1 - v);
        v += (sc[c] - v) * shadowAmt * w;
      }
      if (highlightAmt) {
        const w = v * v;
        v += (hc[c] - v) * highlightAmt * w;
      }
      // Negros levantados hacia un color (sin aplastar el negro de la marca).
      if (blackLift) v = bl[c] + v * (1 - bl[c]);
      t[i] = clamp(v, 0, 1) * 255;
    }
    return t;
  });
  lutCache.set(key, L);
  return L;
}

// ─── brillo emisivo ──────────────────────────────────────────────────────────
// La capa emisiva promediada se reduce a 1/4, se desenfoca a dos radios, se
// tiñe y se suma en screen. Un umbral de luma nunca agarraría el #c2410c de la
// marca (luminancia ~0.15): por eso el brillo es una capa aparte y explícita.

// tint "source": el brillo conserva el color de lo emitido (por canal) en vez
// de teñirse de un solo color.
function glow(avg, em, n, w, h, R, { weight = 1, tint = "#fb923c", radii = [18, 48], amounts = [0.45, 0.25], scale = 1 }) {
  const src = tint === "source";
  const { qw, qh } = R;
  const c1 = R.q1.getContext("2d");
  const img = c1.createImageData(qw, qh);
  const d = img.data;
  const inv = 1 / n;
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      // Promedio de un bloque de 4x4 (muestreado en 4 puntos para abaratar).
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < 4; k++) {
        const sx = Math.min(w - 1, x * 4 + (k & 1) * 2 + 1);
        const sy = Math.min(h - 1, y * 4 + (k >> 1) * 2 + 1);
        const p = (sy * w + sx) * 4;
        r += em[p];
        g += em[p + 1];
        b += em[p + 2];
      }
      const q = (y * qw + x) * 4;
      d[q] = (r * inv) / 4;
      d[q + 1] = (g * inv) / 4;
      d[q + 2] = (b * inv) / 4;
      d[q + 3] = 255;
    }
  }
  c1.putImageData(img, 0, 0);
  const [tr, tg, tb] = src ? [1, 1, 1] : hexToRgb(tint).map((c) => c / 255);
  const blurs = radii.map((rad, i) => {
    const c = (i === 0 ? R.q2 : R.q3).getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "copy";
    c.filter = `blur(${((rad * scale) / 4).toFixed(2)}px)`;
    c.drawImage(R.q1, 0, 0);
    c.filter = "none";
    c.globalCompositeOperation = "source-over";
    return c.getImageData(0, 0, qw, qh).data;
  });
  // Suma en screen con muestreo bilineal del buffer chico.
  for (let y = 0; y < h; y++) {
    const fy = Math.min(qh - 1.001, Math.max(0, (y + 0.5) / 4 - 0.5));
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(qw - 1.001, Math.max(0, (x + 0.5) / 4 - 0.5));
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const i00 = (y0 * qw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + qw * 4;
      const i11 = i01 + 4;
      if (src) {
        const p = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) {
          let e = 0;
          for (let k = 0; k < blurs.length; k++) {
            const B = blurs[k];
            e += ((B[i00 + c] * (1 - tx) + B[i10 + c] * tx) * (1 - ty) + (B[i01 + c] * (1 - tx) + B[i11 + c] * tx) * ty) * amounts[k];
          }
          if (e < 0.5) continue;
          avg[p + c] = 255 - (255 - avg[p + c]) * (1 - clamp((e * weight) / 255));
        }
        continue;
      }
      let e = 0;
      for (let k = 0; k < blurs.length; k++) {
        const B = blurs[k];
        // Intensidad del brillo: el máximo de los canales (el color lo pone el tinte).
        const v00 = Math.max(B[i00], B[i00 + 1], B[i00 + 2]);
        const v10 = Math.max(B[i10], B[i10 + 1], B[i10 + 2]);
        const v01 = Math.max(B[i01], B[i01 + 1], B[i01 + 2]);
        const v11 = Math.max(B[i11], B[i11 + 1], B[i11 + 2]);
        const v = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
        e += v * amounts[k];
      }
      if (e < 0.5) continue;
      e *= weight / 255;
      const p = (y * w + x) * 3;
      avg[p] = 255 - (255 - avg[p]) * (1 - clamp(e * tr));
      avg[p + 1] = 255 - (255 - avg[p + 1]) * (1 - clamp(e * tg));
      avg[p + 2] = 255 - (255 - avg[p + 2]) * (1 - clamp(e * tb));
    }
  }
}

// ─── pase final ──────────────────────────────────────────────────────────────
// acc: Uint16Array RGBA con la suma de n sub-frames. em: idem para la capa
// emisiva (o null). Devuelve Uint8Array RGB.
// g: parámetros del grade de este frame (los decide la pieza):
//   { tone:{shadow, shadowAmt, highlight, highlightAmt, contrast, blackLift},
//     vignette, vignetteColor, grain, grainSize, emissive, ca, seed, scale,
//     glowTint, glowRadii, glowAmounts, rowGain }
//   rowGain: Float32Array con una ganancia por fila del lienzo nominal, que se
//   aplica después del brillo (apaga una franja entera, brillo incluido).

export function finish(acc, n, w, h, g = {}, em = null) {
  const R = res(w, h);
  const px = w * h;
  const inv = 1 / n;
  const avg = new Float32Array(px * 3);
  for (let i = 0, j = 0; j < px * 3; i += 4, j += 3) {
    avg[j] = acc[i] * inv;
    avg[j + 1] = acc[i + 1] * inv;
    avg[j + 2] = acc[i + 2] * inv;
  }

  if (em && (g.emissive ?? 1) > 0.001) {
    const go = { weight: g.emissive ?? 1, scale: g.scale ?? 1 };
    if (g.glowTint) go.tint = g.glowTint;
    if (g.glowRadii) go.radii = g.glowRadii;
    if (g.glowAmounts) go.amounts = g.glowAmounts;
    glow(avg, em, n, w, h, R, go);
  }
  if (g.rowGain) {
    const rg = g.rowGain;
    const sc = rg.length / h;
    for (let y = 0; y < h; y++) {
      const k = rg[Math.min(rg.length - 1, Math.floor((y + 0.5) * sc))];
      if (k === 1) continue;
      for (let i = y * w * 3, e = i + w * 3; i < e; i++) avg[i] *= k;
    }
  }

  const out = new Uint8Array(px * 3);
  const T = lut(g.tone || {});
  const vig = g.vignette ?? 0;
  const vc = hexToRgb(g.vignetteColor ?? "#b89d7c").map((c) => c / 255);
  const gAmt = (g.grain ?? 0) * 255;
  const G = R.G;
  const gr = rng((g.seed ?? 0) * 7919 + 13);
  const ox = Math.floor(gr() * G);
  const oy = Math.floor(gr() * G);
  const gs = Math.max(1, g.grainSize ?? 1);
  const ca = (g.ca ?? 0) * (g.scale ?? 1);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < h; y++) {
    const gy = ((Math.floor(y / gs) + oy) % G) * G;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let r;
      let gg;
      let b;
      if (ca) {
        // Aberración radial: rojo hacia afuera, azul hacia adentro, `ca` px en
        // el borde.
        const k = ca / maxR;
        const dx = x - cx;
        const dy = y - cy;
        const xr = clamp(Math.round(x + dx * k), 0, w - 1);
        const yr = clamp(Math.round(y + dy * k), 0, h - 1);
        const xb = clamp(Math.round(x - dx * k), 0, w - 1);
        const yb = clamp(Math.round(y - dy * k), 0, h - 1);
        r = avg[(yr * w + xr) * 3];
        gg = avg[p * 3 + 1];
        b = avg[(yb * w + xb) * 3 + 2 ];
      } else {
        r = avg[p * 3];
        gg = avg[p * 3 + 1];
        b = avg[p * 3 + 2];
      }
      let rr = T[0][clamp(Math.round(r * 16.0588), 0, 4095)];
      let g2 = T[1][clamp(Math.round(gg * 16.0588), 0, 4095)];
      let bb = T[2][clamp(Math.round(b * 16.0588), 0, 4095)];
      if (vig) {
        // Viñeta de color: multiplica hacia vignetteColor (un marrón de la
        // paleta), no hacia gris.
        const v = vig * R.rad[p];
        rr *= 1 - v * (1 - vc[0]);
        g2 *= 1 - v * (1 - vc[1]);
        bb *= 1 - v * (1 - vc[2]);
      }
      if (gAmt) {
        const lum = (0.2126 * rr + 0.7152 * g2 + 0.0722 * bb) / 255;
        // Más grano en los medios tonos que en blancos y negros puros.
        const wgt = 0.45 + 2.2 * lum * (1 - lum);
        const nz = R.grain[gy + ((Math.floor(x / gs) + ox) % G)] * gAmt * wgt;
        rr += nz;
        g2 += nz;
        bb += nz;
      }
      out[p * 3] = rr < 0 ? 0 : rr > 255 ? 255 : rr + 0.5;
      out[p * 3 + 1] = g2 < 0 ? 0 : g2 > 255 ? 255 : g2 + 0.5;
      out[p * 3 + 2] = bb < 0 ? 0 : bb > 255 ? 255 : bb + 0.5;
    }
  }
  return out;
}
