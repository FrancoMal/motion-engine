// Matemática chica: interpolación, azar determinista, ruido y color.
//
// Nada de Math.random: cada frame se renderiza en un worker distinto y con
// sub-frames, así que todo lo "aleatorio" tiene que ser función pura de una
// semilla.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a0, a1, b0, b1, doClamp = true) => {
  const t = invLerp(a0, a1, v);
  return lerp(b0, b1, doClamp ? clamp(t) : t);
};
export const smoothstep = (a, b, v) => {
  const t = clamp(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;
export const deg = (d) => (d * Math.PI) / 180;

// ─── azar determinista ───────────────────────────────────────────────────────

// Hash entero → [0, 1). Rápido y sin estado.
export function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hash2(a, b) {
  return hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
}

// Generador con estado (mulberry32) para cuando hacen falta muchos valores.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── ruido ───────────────────────────────────────────────────────────────────
// Ruido de valor 1D suavizado (quíntica), en [-1, 1]. Para micro-movimiento
// orgánico: respiración de cámara, flotación de capas, temblor de mano.

export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

export function fbm1(x, seed = 0, octaves = 3) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise1(x * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return v / norm;
}

// ─── color ───────────────────────────────────────────────────────────────────
// Los colores de marca se escriben en hex. Las mezclas se hacen en OKLab para
// que un ámbar que pasa a crema no se ensucie en el medio (la mezcla en sRGB
// crudo agrisa).

export function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const toSrgb = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp(Math.round(c * 255), 0, 255);
};

function rgbToOklab([r, g, b]) {
  const lr = toLin(r);
  const lg = toLin(g);
  const lb = toLin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const labCache = new Map();
function labOf(hex) {
  let v = labCache.get(hex);
  if (!v) {
    v = rgbToOklab(hexToRgb(hex));
    labCache.set(hex, v);
  }
  return v;
}

// Mezcla dos hex en OKLab y devuelve un color CSS.
export function mix(hexA, hexB, t, alpha = 1) {
  const a = labOf(hexA);
  const b = labOf(hexB);
  const [r, g, bl] = oklabToRgb([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha})`;
}

// Mezcla y devuelve hex (para poder seguir mezclando).
export function mixHex(hexA, hexB, t) {
  const a = labOf(hexA);
  const b = labOf(hexB);
  const [r, g, bl] = oklabToRgb([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  return "#" + [r, g, bl].map((c) => c.toString(16).padStart(2, "0")).join("");
}

export function rgba(hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Interpolación en espacio logarítmico: para tamaños, radios y zooms que
// cambian más de 4x en un movimiento. Lineal en log se lee como velocidad
// constante de escala; lineal en px frena en seco al final o arranca a saltos.
// Si a es 0 se usa `floor` (20 px por defecto) como punto de partida.
export function lerpLog(a, b, t, floor = 20) {
  const la = Math.log(Math.max(a, floor));
  const lb = Math.log(Math.max(b, floor));
  return Math.exp(la + (lb - la) * t);
}
