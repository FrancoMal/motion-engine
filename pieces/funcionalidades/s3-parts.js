// Piezas de S3 "Área por área." (tratamiento final 3.3 TW y 3.4): geometría del
// borde de swash, estelas de movimiento para objetos finos y rápidos, y los
// textos chicos de la tarjeta de progreso (con rodillo por dígito y evaporado
// por glifo sobre un diagramado fijo).

import { createCanvas } from "@napi-rs/canvas";
import { setType } from "../../engine/text.js";
import { advance } from "../../shared/phrase.js";
import { clamp, lerp, rgba } from "../../engine/math.js";
import { EASE, SPR, spr } from "../../shared/system.js";

const mctx = createCanvas(8, 8).getContext("2d");
const ROLL_SPR = { stiffness: 900, damping: 52, mass: 1 };

// ─── borde de swash ──────────────────────────────────────────────────────────
// Mismo trazado que shared/masks.js swashEdgePath: vertical hasta y 370, el
// swash del logo x34 (Q con control 272 px abajo, fin 272 a la derecha y 340
// abajo) y vertical otra vez con el talón adelantado 272 px.

export const YH = 370;
export const LEAD = 272;

// x del borde a la altura y, para un borde en X.
export function edgeAt(X, y) {
  if (y <= YH) return X;
  if (y >= YH + 340) return X + LEAD;
  // y(s) = 370 + 544 s - 204 s^2  ->  s de la raíz chica.
  const s = (544 - Math.sqrt(544 * 544 - 816 * (y - YH))) / 408;
  return X + LEAD * s * s;
}

// Polilínea del borde (sin cerrar) desplazada a X.
const EDGE0 = (() => {
  const pts = [[0, -80], [0, YH]];
  const n = 32;
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    pts.push([LEAD * s * s, YH + 544 * s - 204 * s * s]);
  }
  pts.push([LEAD, 1160]);
  return pts;
})();

export function edgeStroke(ctx, X) {
  ctx.beginPath();
  EDGE0.forEach(([x, y], i) => (i ? ctx.lineTo(X + x, y) : ctx.moveTo(X + x, y)));
}

// Cinta entre el borde corrido `a` y el corrido `b` (a < b): el área que barre
// el borde al moverse de X + a a X + b. Es la forma exacta de una estela
// horizontal de algo pegado al borde.
export function edgeRibbon(ctx, X, a, b) {
  ctx.beginPath();
  EDGE0.forEach(([x, y], i) => (i ? ctx.lineTo(X + b + x, y) : ctx.moveTo(X + b + x, y)));
  for (let i = EDGE0.length - 1; i >= 0; i--) ctx.lineTo(X + a + EDGE0[i][0], EDGE0[i][1]);
  ctx.closePath();
}

// Fracción del cuadro a la izquierda del borde (cobertura para el grade).
export function swashCoverage(X) {
  let area = 0;
  const n = 54;
  for (let i = 0; i < n; i++) {
    const y = ((i + 0.5) / n) * 1080;
    area += clamp(edgeAt(X, y), 0, 1920);
  }
  return area / (n * 1920);
}

// ─── estelas ─────────────────────────────────────────────────────────────────
// Un objeto de 8 a 10 px que se mueve a 300-1000 px/f con 16 sub-frames deja
// 16 copias separadas por decenas de px: rayas en vez de estela. Cada sub-frame
// dibuja entonces el objeto con una cola hacia donde vino, de largo
// proporcional a la velocidad, en capas de opacidad decreciente. Al promediar,
// las copias se funden en una estela continua con la cabeza más caliente.

// Cola horizontal de un borde de swash: `len` px hacia la izquierda de X.
// Capas ANIDADAS (todas llegan hasta el borde, cada una más corta que la
// anterior) en vez de franjas contiguas: dos franjas semitransparentes que se
// tocan dejan una costura de antialias, y con 16 muestras eso son rayas.
// alphaAt(k) es la opacidad acumulada buscada a la distancia k (0 = cabeza,
// 1 = cola), decreciente; colorAt(k) el color de la capa que termina en k.
// forward = true la tiende hacia la derecha del borde (pluma de antialias
// temporal por delante).
export function swashTail(ctx, X, len, { n = 10, colorAt, alphaAt, offset = 0, forward = false }) {
  if (len < 1) return;
  let outer = 0; // opacidad acumulada de las capas más largas ya dibujadas
  for (let i = n - 1; i >= 0; i--) {
    const k = i / n;
    const A = clamp(alphaAt(k), 0, 0.999);
    // 1 - (1 - A) = 1 - (1 - a)(1 - outer)  ->  a
    const a = A <= outer ? 0 : 1 - (1 - A) / (1 - outer);
    outer = Math.max(outer, A);
    if (a <= 0.003) continue;
    ctx.fillStyle = rgba(colorAt(k), a);
    const reach = (len * (i + 1)) / n;
    if (forward) edgeRibbon(ctx, X, offset, offset + reach);
    else edgeRibbon(ctx, X, offset - reach, offset);
    ctx.fill();
  }
}

// Cerdas: rayas horizontales finas que arrastra el borde, con la cabeza sobre
// la curva del swash. El desenfoque de movimiento es horizontal, así que una
// raya horizontal sobrevive entera y dibuja la forma del borde aunque el borde
// en sí se vuelva un degradé.
// Irregulares a propósito (alturas, grosores, largos y brillo sembrados): una
// grilla pareja se leería como renglones y no como pincel.
const BRISTLES = Array.from({ length: 15 }, (_, i) => {
  const h = (n) => {
    let x = Math.imul((i * 7 + n + 3) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  return {
    y: 20 + (i + 0.5 + 0.9 * (h(1) - 0.5)) * (1040 / 15),
    w: 1 + 3.5 * h(2) * h(2),
    len: 0.2 + 0.7 * h(3) * h(3),
    a: 0.22 + 0.45 * h(4),
    hot: h(5) > 0.55,
  };
});
export function swashBristles(ctx, X, len, gain, { head = "#fff3e3", hot = "#fb923c", ember = "#c2410c" } = {}) {
  if (len < 4) return;
  for (const b of BRISTLES) {
    const xe = edgeAt(X, b.y) - 3;
    const L = len * b.len;
    const g = ctx.createLinearGradient(xe - L, 0, xe, 0);
    g.addColorStop(0, rgba(ember, 0));
    g.addColorStop(0.6, rgba(hot, 0.55 * b.a * gain));
    g.addColorStop(1, rgba(b.hot ? head : hot, b.a * gain));
    ctx.fillStyle = g;
    ctx.fillRect(xe - L, b.y - b.w / 2, L, b.w);
  }
}

// ─── textos chicos (captions) ────────────────────────────────────────────────
// Diagramado fijo una sola vez al peso de reposo, midiendo prefijos. Los
// dígitos ocupan el ancho del "0" (tabulares) para que un contador ruede sin
// mover el resto de la línea. Cada glifo se dibuja centrado en su celda, así
// puede cambiar de peso en el lugar.

export function makeCaption(text, { size, weight, x, baseline, align = "left", color }) {
  const style = { size, weight, tracking: 0 };
  setType(mctx, style);
  const items = [];
  let prefix = "";
  let prev = 0;
  for (const ch of Array.from(text)) {
    prefix += /\d/.test(ch) ? "0" : ch;
    const w = mctx.measureText(prefix).width;
    items.push({ ch, x: prev, w: w - prev });
    prev = w;
  }
  const width = prev;
  const x0 = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  const cap = mctx.measureText("H").actualBoundingBoxAscent;
  items.forEach((g) => (g.ax = x0 + g.x));
  return { text, items, width, x: x0, baseline, size, weight, color, cap, n: items.length };
}

// o: {
//   steps: [[f, texto], ...]  rodillo: los caracteres que cambian ruedan hacia
//                             arriba en su celda (snap); mismo largo siempre.
//   rise: { t0, stagger, dist = 20, dur = 8 }   entrada (glide) por glifo
//   evap: { t0, stagger, dur }                  salida K5 por glifo
//   alpha, color }
export function drawCaption(ctx, cap, t, o = {}) {
  let cur = cap.text;
  let prev = cap.text;
  let k = 1;
  if (o.steps) {
    let idx = 0;
    for (let i = 0; i < o.steps.length; i++) if (t >= o.steps[i][0]) idx = i;
    cur = o.steps[idx][1];
    prev = idx > 0 ? o.steps[idx - 1][1] : cur;
    // Rodillo de 5 f casi sin rebote (zeta 0,87): con el snap la cifra quedaba
    // 4 px arriba de la línea durante varios frames.
    if (idx > 0) k = Math.min(1.2, spr(t, o.steps[idx][0], ROLL_SPR));
  }
  const A = Array.from(cur);
  const B = Array.from(prev);
  const color = o.color ?? cap.color;
  const alpha0 = o.alpha ?? 1;
  if (alpha0 <= 0.002) return;
  ctx.save();
  const ga = ctx.globalAlpha;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i < cap.n; i++) {
    const g = cap.items[i];
    const ch = A[i] ?? g.ch;
    if (ch === " ") continue;
    let dx = 0;
    let dy = 0;
    let alpha = alpha0;
    let weight = cap.weight;
    if (o.rise) {
      const r = o.rise;
      const s = r.t0 + i * (r.stagger ?? 0);
      if (t < s) continue;
      dy += (r.dist ?? 20) * (1 - EASE.glide(clamp((t - s) / (r.dur ?? 8))));
      alpha *= clamp((t - s) / 3);
    }
    if (o.evap) {
      const e = o.evap;
      const s = e.t0 + i * e.stagger;
      if (t > s) {
        const q = EASE.accel(clamp((t - s) / e.dur));
        weight = lerp(weight, 200, q);
        dx += 0.3 * cap.size * q;
        dy -= 10 * q;
        alpha *= 1 - q;
      }
    }
    if (alpha <= 0.002) continue;
    setType(ctx, { size: cap.size, weight, tracking: 0 });
    ctx.globalAlpha = ga * alpha;
    const old = B[i] ?? ch;
    if (old !== ch && k < 1.2 && Math.abs(k - 1) > 0.002) {
      // Celda con rodillo: el viejo sube y sale, el nuevo entra desde abajo.
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.ax - 2 + dx, cap.baseline - cap.cap * 1.35 + dy, g.w + 4, cap.cap * 1.7);
      ctx.clip();
      // Además del rodillo, fundido cruzado: sin él, el recorte de la celda se
      // lee como una caja cuando el desenfoque estira los dos dígitos.
      const off = (1 - k) * cap.cap * 1.4;
      const kc = clamp(k);
      ctx.globalAlpha = ga * alpha * Math.pow(1 - kc, 0.7);
      if (old !== " ") ctx.fillText(old, g.ax + (g.w - advance(old, cap.size, weight)) / 2 + dx, cap.baseline - (cap.cap * 1.4 - off) + dy);
      ctx.globalAlpha = ga * alpha * Math.min(1, kc * 1.3);
      ctx.fillText(ch, g.ax + (g.w - advance(ch, cap.size, weight)) / 2 + dx, cap.baseline + off + dy);
      ctx.restore();
    } else {
      ctx.fillText(ch, g.ax + (g.w - advance(ch, cap.size, weight)) / 2 + dx, cap.baseline + dy);
    }
  }
  ctx.restore();
}

// Envolvente de pulso por beat: sube en 2 f (brake) y vuelve en 6 f (swell).
export function beatEnv(t, beats) {
  let v = 0;
  for (const H of beats) {
    if (t < H || t > H + 8) continue;
    const e = t < H + 2 ? EASE.brake((t - H) / 2) : 1 - EASE.swell((t - H - 2) / 6);
    v = Math.max(v, e);
  }
  return v;
}

export { lerp };
