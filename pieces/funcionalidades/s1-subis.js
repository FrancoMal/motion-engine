// Escena S1 "Subís tu planificación." (tratamiento final 3.2), f0-84, Papel.
//
// El punto es el actor de toda la escena: cae en f0 a mitad de impacto,
// "planificación" sale de él hacia la izquierda (K6), viaja como punto final
// del título cuando la frase se recorta y se vuelve el .docx (T1), se despega
// del documento que se aleja, vuela y toca "Formación Personal y Social"
// (T2), y esa pestaña, inundada de acento desde el toque, crece hasta ser el
// campo de S2 (T3). En f84 el cuadro es #c2410c plano (contrato C-P1-4).
//
// Capas: L1 fantasma "planific" (z +900), L2 grilla de 12 columnas (z +300),
// L4 UI (z 0), L5 motas desenfocadas (z -400) y la frase en pantalla, quieta
// de R a L mientras la cámara del mundo hace su dolly.

import { EASE, SPR, spr, ring } from "../../shared/system.js";
import { makePhrase, drawPhrase, drawDot, puntoPrimero, bumps } from "../../shared/phrase.js";
import { C, card, rr } from "../../shared/ui.js";
import { flightV, col } from "../../shared/punto.js";
import { camera, layer, offscreen } from "../../engine/camera.js";
import { env, emit } from "../../engine/env.js";
import { setType, textWidth, capHeight } from "../../engine/text.js";
import { clamp, lerp, lerpLog, smoothstep, noise1, rgba } from "../../engine/math.js";
import { createCanvas } from "@napi-rs/canvas";

const W = 1920;
const H = 1080;
const F = 1400; // focal del tratamiento (2.6)
const mctx = createCanvas(8, 8).getContext("2d");

// ─── frase ───────────────────────────────────────────────────────────────────
const PH1 = makePhrase({ text: "Subís tu", size: 216, wght: 760, tracking: -0.045, x: 120, baseline: 452, color: C.ink });
const PH2 = makePhrase({ text: "planificación.", size: 216, wght: 760, tracking: -0.045, x: 120, baseline: 640, color: C.ink, periodColor: C.accent });
const DOT = PH2.period; // centro de la tinta del punto y su diámetro
const CLIP_X = DOT.cx - DOT.d / 2 - 2; // borde del recorte de K6: 2 px antes de la tinta
const SLOT_Y = 464; // la ranura de la que sube "Subís tu"

// "Subís tu" sube de una ranura (el verbo es subir): por glifo, 0,6 f de
// stagger, hundida de 8 px, subida de +230 a -12 con lunge, asentado con snap.
// El peso carga de 420 a reposo mientras sube.
function sube(t, g, st, ph) {
  const tt = t - g.i * 0.6;
  let dy;
  if (tt < 0) dy = 230;
  else if (tt < 2) dy = 230 + 8 * EASE.swell(tt / 2);
  else if (tt < 7) dy = lerp(238, -12, EASE.lunge((tt - 2) / 5));
  else dy = lerp(-12, 0, spr(tt, 7, SPR.snap));
  st.dy += dy;
  if (tt < 7) st.clip = { x0: -1e4, x1: 1e4, y0: -1e4, y1: SLOT_Y };
  st.weight = lerp(420, ph.wght, EASE.ink(clamp((tt - 2) / 7)));
}

// "planificación" se entinta mientras sale del punto (520 → reposo).
const tintaCinta = (t, g, st, ph) => {
  st.weight = lerp(520, ph.wght, EASE.ink(clamp((t - 1) / 8)));
};

// Inhalación f45.5-48 (760 → 700, en el lugar) y exhalación con el recorte:
// el título del documento queda a 780.
const peso = (t, g, st) => {
  if (t < 45.5) return;
  const a = EASE.swell(clamp((t - 45.5) / 2.5));
  const b = EASE.ink(clamp((t - 48) / 5));
  st.weight = lerp(lerp(st.weight, 700, a), 780, b);
};

const PROG1 = [sube, bumps([28], 60), peso];
const PROG2 = [puntoPrimero(0, CLIP_X), tintaCinta, peso];

// ─── T1: recorte a documento ─────────────────────────────────────────────────
// La frase escala 1 → 0,24 (en log) alrededor del punto fijo que lleva el ancla
// (120, 452) a (790, 470); la máscara se cierra del cuadro entero a la tarjeta.
const S_DOC = 0.24;
const ZC = [(790 - S_DOC * 120) / (1 - S_DOC), (470 - S_DOC * 452) / (1 - S_DOC)];
const CARD = { x: 750, y: 290, w: 420, h: 540, r: 32 };
CARD.cx = CARD.x + CARD.w / 2;
CARD.cy = CARD.y + CARD.h / 2;
const eT1 = (t) => EASE.whip(clamp((t - 48) / 8));
const zoomOf = (t) => Math.pow(S_DOC, eT1(t));
const toDoc = (x, y, s = S_DOC) => [ZC[0] + s * (x - ZC[0]), ZC[1] + s * (y - ZC[1])];

function maskRect(t) {
  const e = eT1(t);
  const w = lerpLog(W, CARD.w, e);
  const h = lerpLog(H, CARD.h, e);
  const cx = CARD.cx;
  const cy = lerp(H / 2, CARD.cy, e);
  return { x: cx - w / 2, y: cy - h / 2, w, h, r: CARD.r * e, e };
}

// Renglones del cuerpo (se barren f54-58) y títulos que colapsan en renglones.
const BAR_W = [348, 300, 330, 280, 320, 250, 210];
const BARS = BAR_W.map((w, i) => ({ x: 790, y: 580 + 30 * i, w, h: 12 }));
const barLaunch = (i) => 62 + 1.5 * i;
const TITLE = [
  [PH1, 0],
  [PH1, 1],
  [PH2, 0],
].map(([ph, wi], k) => {
  const wd = ph.words[wi];
  const [x0, yb] = toDoc(wd.ax + 0.03 * ph.size, ph.baseline);
  const [x1] = toDoc(wd.ax + wd.w - 0.02 * ph.size, ph.baseline);
  const xh = ph.xh * S_DOC;
  return { ph, wi, k, x0, x1, xh, cy: yb - xh / 2 };
});
const DOT_DOC = [TITLE[2].x1 + 13, TITLE[2].cy]; // el punto al final del renglón
const DOT_DOC_D = 14;
const collapseK = (t, k) => EASE.glide(clamp((t - (56 + k)) / 3));

const TAG = { x: 790, y: 316, w: 84, h: 40 };

// ─── T2: renglones a pestañas ────────────────────────────────────────────────
const PILL_H = 64;
const AREAS = [
  ["Formación Personal y Social", 0],
  ["Prácticas del Lenguaje", 0],
  ["Matemática", 0],
  ["Ambiente Natural y Social", 1],
  ["Juego", 1],
  ["Literatura", 1],
  ["Educación Visual", 1],
];
const LABEL = { size: 30, weight: 600 };
const PILLS = (() => {
  const rows = [[], []];
  AREAS.forEach(([text, row], i) => rows[row].push({ text, i, w: textWidth(mctx, text, LABEL) + 56 }));
  const out = [];
  const cap = capHeight(mctx, LABEL);
  rows.forEach((items, row) => {
    const total = items.reduce((a, p) => a + p.w, 0) + 16 * (items.length - 1);
    let x = 960 - total / 2;
    const y = row === 0 ? 438 : 518;
    for (const p of items) {
      const cx = x + p.w / 2;
      const cy = y + PILL_H / 2;
      out[p.i] = {
        ...p,
        x,
        y,
        h: PILL_H,
        cx,
        cy,
        label: makePhrase({ text: p.text, size: LABEL.size, wght: LABEL.weight, tracking: 0, x: cx, baseline: cy + cap / 2, align: "center", color: C.inkSoft }),
      };
      x += p.w + 16;
    }
  });
  return out;
})();
const P0 = PILLS[0]; // Formación Personal y Social

// Tarjeta: squash f60-63 (anticipación de los lanzamientos) y retroceso
// f63-72 (z 0 → +700, desenfoque a 8 px, opacidad a 0, accel).
function cardState(t) {
  let sx = 1;
  let sy = 1;
  if (t >= 60 && t < 63) {
    const k = EASE.swell((t - 60) / 3);
    sx = 1 + 0.02 * k;
    sy = 1 - 0.03 * k;
  } else if (t >= 63) {
    const k = spr(t, 63, SPR.snap);
    sx = lerp(1.02, 1, k);
    sy = lerp(0.97, 1, k);
  }
  const r = EASE.accel(clamp((t - 63) / 9));
  return { sx, sy, z: 700 * r, s: F / (F + 700 * r), alpha: 1 - r, blur: 8 * r, r };
}
function cardToScreen(x, y, cs) {
  const xs = CARD.cx + (x - CARD.cx) * cs.sx;
  const ys = CARD.cy + (y - CARD.cy) * cs.sy;
  return [960 + (xs - 960) * cs.s, 540 + (ys - 540) * cs.s];
}

// Vuelo del renglón i: arco cuadrático (control 120 px arriba del punto
// medio), parámetro en whip, 8 f. La forma pasa de renglón a pastilla con un
// snap que arranca 2 f después del despegue, así aterriza con rebote.
function pillState(i, t) {
  const P = PILLS[i];
  const tL = barLaunch(i);
  if (t < tL) return null;
  const tA = tL + 8;
  const b = BARS[i];
  const cs0 = cardState(tL);
  const [x0, y0] = cardToScreen(b.x + b.w / 2, b.y + b.h / 2, cs0);
  const w0 = b.w * cs0.s * cs0.sx;
  const h0 = b.h * cs0.s * cs0.sy;
  const u = EASE.whip(clamp((t - tL) / 8));
  const mx = (x0 + P.cx) / 2;
  const my = (y0 + P.cy) / 2 - 120;
  const m1 = 1 - u;
  const x = m1 * m1 * x0 + 2 * m1 * u * mx + u * u * P.cx;
  const y = m1 * m1 * y0 + 2 * m1 * u * my + u * u * P.cy;
  const m = spr(t, tL + 2, SPR.snap);
  const mc = clamp(m);
  const bulge = Math.sin(Math.PI * clamp((t - tL) / 8));
  const sc = 1 + 0.14 * bulge;
  const w = lerp(w0, P.w, m) * sc;
  const h = lerpLog(h0, PILL_H, m, 1) * sc;
  // El color va detrás de la forma: a mitad de vuelo todavía es un renglón
  // beige que se infla, y blanquea al aterrizar.
  const ck = smoothstep(0.45, 1, mc);
  return { cx: x, cy: y, w, h, r: lerp(6, 14, mc) * sc, fill: col(C.border, "#ffffff", ck), borderA: ck, lift: bulge, tA, u };
}

// ─── el punto ────────────────────────────────────────────────────────────────
// Antes de f0 viene de cámara (escala 2,8 → 1,7 con accel): el cuadro 0 ya es
// el impacto, con su estela radial detrás.
function dotImpactScale(t) {
  if (t < 0) return lerp(2.8, 1.7, EASE.accel(clamp(t + 1)));
  return lerp(1.7, 1, spr(t, 0, SPR.slam));
}
const DOT_FLIGHT = { t0: 68, t1: 77 };
function dotFlightSpec() {
  const cs = cardState(DOT_FLIGHT.t0);
  const [x, y] = cardToScreen(DOT_DOC[0], DOT_DOC[1], cs);
  return {
    P0: [x, y],
    P1: [x - 40, y - 170],
    P2: [P0.cx + 150, P0.cy - 175],
    P3: [P0.cx, P0.cy],
    d0: DOT_DOC_D * cs.s * 0.78,
  };
}
const DF = dotFlightSpec();

// Posición y diámetro del punto (null cuando ya se absorbió en la pestaña).
function dotState(t) {
  if (t < 48) return { x: DOT.cx, y: DOT.cy, d: DOT.d * dotImpactScale(t) };
  if (t < 56) {
    const s = zoomOf(t);
    const [x, y] = toDoc(DOT.cx, DOT.cy, s);
    return { x, y, d: lerpLog(DOT.d, DOT_DOC_D, eT1(t), 1) };
  }
  if (t < DOT_FLIGHT.t0) {
    const [zx, zy] = toDoc(DOT.cx, DOT.cy);
    const k = EASE.glide(clamp((t - 56) / 3));
    const cs = cardState(t);
    const [x, y] = cardToScreen(lerp(zx, DOT_DOC[0], k), lerp(zy, DOT_DOC[1], k), cs);
    // Anticipación del despegue: se encoge un 22 % en f66-68.
    const a = 1 - 0.22 * EASE.swell(clamp((t - 66) / 2));
    return { x, y, d: DOT_DOC_D * cs.s * a };
  }
  if (t < DOT_FLIGHT.t1) {
    const f = flightV(t, { ...DOT_FLIGHT, P0: DF.P0, P1: DF.P1, P2: DF.P2, P3: DF.P3, v0: 3, v1: 30 });
    const k = clamp((t - DOT_FLIGHT.t0) / (DOT_FLIGHT.t1 - DOT_FLIGHT.t0));
    // Se acerca a cámara a mitad de vuelo (z -300) y llega con 22 px.
    const d = lerp(DF.d0, 30, k) * (1 + 0.8 * Math.sin(Math.PI * k));
    return { x: f.x, y: f.y, d, flying: true };
  }
  return null;
}

// ─── T3: pestaña a campo ─────────────────────────────────────────────────────
// La pestaña crece en log (ancho y alto) con whip hasta un rect más grande que
// el cuadro: lo cubre entero desde f83 y el f84 (que muestrea [83, 84)) es
// acento plano.
const T3 = { t0: 78, t1: 84.6, w: 2600, h: 1500 }; // t1 es el final virtual del whip: cubre el cuadro entero desde f82,35
const eT3 = (t) => EASE.whip(clamp((t - T3.t0) / (T3.t1 - T3.t0)));
function popFPyS(t) {
  if (t < 77) return 1;
  if (t < 79) return lerp(1, 1.08, EASE.brake((t - 77) / 2));
  return lerp(1.08, 1, spr(t, 79, SPR.snap));
}
function growRect(t) {
  const e = eT3(t);
  const pop = popFPyS(t);
  const w = lerpLog(P0.w, T3.w, e, 1) * pop;
  const h = lerpLog(PILL_H, T3.h, e, 1) * pop;
  const cx = lerp(P0.cx, 960, e);
  const cy = lerp(P0.cy, 540, e);
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, r: lerp(14, 60, e) * pop, e };
}
function coverage(t) {
  if (t < T3.t0) return 0;
  const R = growRect(t);
  const ix = Math.max(0, Math.min(W, R.x + R.w) - Math.max(0, R.x));
  const iy = Math.max(0, Math.min(H, R.y + R.h) - Math.max(0, R.y));
  return (ix * iy) / (W * H);
}
const floodR = (t) => lerp(15, 240, EASE.brake(clamp((t - 77) / 4)));

// Empuje radial de las otras seis pestañas (orden por distancia, 0,3 f).
const PUSH = (() => {
  const others = PILLS.slice(1).map((p) => {
    const dx = p.cx - P0.cx;
    const dy = p.cy - P0.cy;
    const dist = Math.hypot(dx, dy);
    return { i: p.i, ux: dx / dist, uy: dy / dist, dist };
  });
  const ranked = [...others].sort((a, b) => a.dist - b.dist);
  ranked.forEach((o, r) => {
    o.rank = r;
    o.amt = lerp(600, 200, r / (ranked.length - 1));
    o.t0 = T3.t0 + 0.3 * r;
  });
  const out = [];
  for (const o of others) out[o.i] = o;
  return out;
})();
function pushOf(i, t) {
  const o = PUSH[i];
  if (!o || t < o.t0) return { dx: 0, dy: 0, a: 1, s: 1 };
  const k = EASE.accel(clamp((t - o.t0) / (82 - o.t0)));
  return { dx: o.ux * o.amt * k, dy: o.uy * o.amt * k, a: 1 - EASE.accel(clamp((t - o.t0) / (81.6 - o.t0))), s: 1 - 0.12 * k };
}

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Impacto: 1,02 → 1 con snap desde f0. Dolly 1,00 → 1,03 (f8-48, swell) como
// avance de cámara en z (paralaje real: el fantasma escala menos que la
// grilla). Vuelve a 1 con el recorte (f48-56, whip). En T3 empuja hacia la
// pestaña (zoom 1 → 1,3 alrededor de su centro).
const DOLLY_Z = F * (1 - 1 / 1.03);
function worldCam(t) {
  let z = 0;
  if (t >= 8 && t < 48) z = DOLLY_Z * EASE.swell((t - 8) / 40);
  else if (t >= 48 && t < 56) z = DOLLY_Z * (1 - EASE.whip((t - 48) / 8));
  const impact = t < 0 ? 1.02 : lerp(1.02, 1, spr(t, 0, SPR.snap));
  const push = 1 + 0.3 * eT3(t);
  const zoom = impact * push;
  // El empuje deja fija la pestaña en pantalla (x, y compensan el zoom).
  const x = push > 1 ? P0.cx - 960 - (P0.cx - 960) / push : 0;
  const y = push > 1 ? P0.cy - 540 - (P0.cy - 540) / push : 0;
  return camera({ F, z, zoom, x, y });
}

// ─── capas de profundidad ────────────────────────────────────────────────────
const S_GHOST = F / (F + 900);
const S_GRID = F / (F + 300);
const S_MOTE = F / (F - 400);
const toLayer = (X, Y, s) => [960 + (X - 960) / s, 540 + (Y - 540) / s];

// L1: "planificación" fantasma a 640 px de mundo (≈390 en pantalla), solo se
// ve "planific", recortado por la derecha y abajo, deriva 18 px/s a la izq.
const GHOST_AT = toLayer(590, 1150, S_GHOST);
// El fantasma es un bitmap cacheado por resolución (a la escala que tiene en
// pantalla): rasterizar 13 glifos de 640 px en cada sub-frame costaba caro.
const ghostCache = new Map();
function ghostImage(q) {
  let g = ghostCache.get(q);
  if (!g) {
    const k = q * S_GHOST * 1.1;
    const st = { size: 640, weight: 760, tracking: -0.045 };
    const pad = 30;
    const asc = 560;
    const w = textWidth(mctx, "planificación", st) + pad * 2;
    const h = asc + 200;
    const cv = createCanvas(Math.ceil(w * k), Math.ceil(h * k));
    const x = cv.getContext("2d");
    x.setTransform(k, 0, 0, k, 0, 0);
    setType(x, st);
    x.fillStyle = "#f1e9dc";
    x.textAlign = "left";
    x.textBaseline = "alphabetic";
    x.fillText("planificación", pad, asc);
    g = { cv, w, h, asc, pad };
    ghostCache.set(q, g);
  }
  return g;
}
function drawGhost(ctx, cam, t) {
  const a = EASE.glide(clamp(t / 10));
  if (a <= 0) return;
  const g = ghostImage(env.scale);
  layer(ctx, cam, 900, (c) => {
    c.globalAlpha *= a;
    const x = GHOST_AT[0] - (t / 30) * (18 / S_GHOST) - g.pad;
    c.drawImage(g.cv, x, GHOST_AT[1] - g.asc, g.w, g.h);
  });
}

// L2: grilla de 12 columnas (márgenes 120, medianil 24, columna 118) que en
// pantalla, con la cámara en reposo, coincide con el margen de la frase. Se
// imprime con el impacto: un frente radial que sale del punto (f0-12).
const GRID_X = [];
for (let j = 0; j < 12; j++) {
  GRID_X.push(toLayer(120 + j * 142, 0, S_GRID)[0], toLayer(238 + j * 142, 0, S_GRID)[0]);
}
const GRID_DOT = toLayer(DOT.cx, DOT.cy, S_GRID);
function drawGrid(ctx, cam, t) {
  const fade = clamp(t / 12);
  if (fade <= 0) return;
  const rW = lerpLog(20, 2600, EASE.glide(clamp(t / 12)), 1) / S_GRID;
  layer(ctx, cam, 300, (c, s) => {
    c.strokeStyle = rgba(C.border, 0.35 * fade);
    c.lineWidth = 1 / s;
    c.beginPath();
    for (const x of GRID_X) {
      const dx = x - GRID_DOT[0];
      if (Math.abs(dx) >= rW) continue;
      const hh = Math.sqrt(rW * rW - dx * dx);
      c.moveTo(x, Math.max(-400, GRID_DOT[1] - hh));
      c.lineTo(x, Math.min(1500, GRID_DOT[1] + hh));
    }
    c.stroke();
  });
}

// L5: motas desenfocadas delante de todo. El impacto las empuja hacia afuera.
const MOTES = [
  [210, 170, 74, C.accent, 0.07],
  [1730, 205, 48, C.ink, 0.045],
  [1610, 940, 96, C.accent, 0.06],
  [320, 965, 56, C.ink, 0.04],
  [1090, 88, 30, C.accent, 0.08],
  [70, 610, 40, C.accent, 0.05],
].map(([x, y, d, c, a], i) => {
  const [wx, wy] = toLayer(x, y, S_MOTE);
  const dx = x - DOT.cx;
  const dy = y - DOT.cy;
  const l = Math.hypot(dx, dy);
  return { wx, wy, r: d / 2 / S_MOTE, c, a, ux: dx / l, uy: dy / l, i };
});
function drawMotes(ctx, cam, t, fadeOut) {
  const kick = t <= 0 ? 0 : 30 * (t / 4) * Math.exp(1 - t / 4);
  layer(ctx, cam, -400, (c) => {
    for (const m of MOTES) {
      const x = m.wx + m.ux * kick + noise1(t * 0.035 + m.i * 3.1, 11) * 14;
      const y = m.wy + m.uy * kick + noise1(t * 0.03 + m.i * 5.7, 23) * 10;
      const a = m.a * (1 - fadeOut) * clamp((t + 1) / 3);
      if (a <= 0.001) continue;
      const R = m.r * 1.5;
      const g = c.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(m.c, a));
      g.addColorStop(0.55, rgba(m.c, a * 0.7));
      g.addColorStop(1, rgba(m.c, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, R, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// Leak del preset Papel: una mancha #fb923c al 7 % en screen que deriva desde
// arriba a la derecha a 40 px/s. Se apaga con la cobertura del acento.
function drawLeak(ctx, t, amt) {
  if (amt <= 0.001) return;
  const x = 1780 - (40 / 30) * t;
  const y = 40 + 0.45 * t;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 980);
  g.addColorStop(0, `rgba(251,146,60,${0.07 * amt})`);
  g.addColorStop(0.45, `rgba(251,146,60,${0.03 * amt})`);
  g.addColorStop(1, "rgba(251,146,60,0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  ctx.restore();
}

// ─── piezas de dibujo ────────────────────────────────────────────────────────

// Anillo de impacto: 30 → 180 px en 10 f (glide). Arranca 0,7 f antes del
// contacto para que el cuadro 0 ya lo muestre saliendo, con su estela.
const RING0 = -0.7;
function impactRing(ctx, t) {
  if (t < RING0 || t > RING0 + 10) return;
  const k = EASE.glide((t - RING0) / 10);
  ctx.save();
  ctx.globalAlpha *= lerp(0.8, 0, k);
  ctx.lineWidth = lerp(4, 0.5, k);
  ctx.strokeStyle = C.accent;
  ctx.beginPath();
  ctx.arc(DOT.cx, DOT.cy, lerp(30, 180, k) / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// La hoja que se cierra (T1): el borde y la sombra se leen apenas entran al
// cuadro; el relleno va de papel a blanco. Es opaca: el mundo de adentro se
// vuelve a dibujar encima y se apaga (ver draw).
function drawMaskCard(ctx, M) {
  const x = M.x;
  const y = M.y;
  const lift = smoothstep(0, 0.3, M.e);
  const fill = col(C.surface, "#ffffff", smoothstep(0, 0.8, M.e));
  if (lift > 0.01) quarterShadow(ctx, M, lift);
  rr(ctx, x, y, M.w, M.h, M.r);
  ctx.fillStyle = fill;
  ctx.fill();
  const ba = smoothstep(0, 0.06, M.e);
  if (ba > 0.01) {
    ctx.save();
    ctx.globalAlpha *= ba;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    rr(ctx, x + 0.75, y + 0.75, M.w - 1.5, M.h - 1.5, Math.max(0, M.r - 0.75));
    ctx.stroke();
    ctx.restore();
  }
}

// Sombra blanda de un rect grande en cuarto de resolución: el desenfoque de
// Skia sobre formas de pantalla entera cuesta ~40 ms; a 1/4 cuesta 16 veces
// menos y, como es una sombra, subirla de escala no se nota. La forma va fuera
// del lienzo y solo cae su sombra (shadowOffset), así no queda un borde de
// relleno borroso alrededor de la hoja.
const QS = 4;
function quarterShadow(ctx, M, lift) {
  const { canvas, ctx: q } = offscreen("s1-mask-shadow", W / QS, H / QS);
  q.setTransform(1 / QS, 0, 0, 1 / QS, 0, 0);
  const far = 20000;
  rr(q, M.x - far, M.y, M.w, M.h, M.r);
  q.fillStyle = "#000";
  q.shadowOffsetX = far / QS;
  q.shadowColor = `rgba(28,25,23,${0.1 * lift})`;
  q.shadowBlur = 8 / QS;
  q.shadowOffsetY = 3 / QS;
  q.fill();
  q.shadowColor = `rgba(28,25,23,${0.16 * lift})`;
  q.shadowBlur = 56 / QS;
  q.shadowOffsetY = 28 / QS;
  q.fill();
  ctx.drawImage(canvas, 0, 0, W, H);
}

// Renglones del cuerpo: se barren de izquierda a derecha (pen, 0,4 f).
function drawBodyBars(c, t, onlyDocked = true) {
  c.fillStyle = C.border;
  for (let i = 0; i < BARS.length; i++) {
    if (onlyDocked && t >= barLaunch(i)) continue;
    const k = EASE.pen(clamp((t - (54 + 0.4 * i)) / 2.8));
    if (k <= 0) continue;
    const b = BARS[i];
    rr(c, b.x, b.y, Math.max(b.h, b.w * k), b.h, 6);
    c.globalAlpha = clamp(k * 4);
    c.fill();
    c.globalAlpha = 1;
  }
}

// Título dentro del documento: las palabras colapsan en renglones de 14 px
// (tinta → #d6cdba, glide, 1 f por palabra).
function drawTitle(c, t) {
  const alphaOf = (k) => 1 - smoothstep(0, 0.45, collapseK(t, k));
  const prog = (base) => (tt, g, st) => {
    st.weight = 780;
    st.alpha *= alphaOf(base + g.word);
  };
  c.save();
  c.translate(ZC[0], ZC[1]);
  c.scale(S_DOC, S_DOC);
  c.translate(-ZC[0], -ZC[1]);
  drawPhrase(c, PH1, t, [prog(0)]);
  drawPhrase(c, PH2, t, [puntoPrimero(0, CLIP_X), prog(2)]);
  c.restore();
  for (const w of TITLE) {
    const k = collapseK(t, w.k);
    if (k <= 0) continue;
    const h = lerp(w.xh, 14, k);
    c.save();
    c.globalAlpha *= smoothstep(0, 0.22, k);
    rr(c, w.x0, w.cy - h / 2, w.x1 - w.x0, h, h / 2);
    c.fillStyle = col(C.ink, C.borderStrong, k);
    c.fill();
    c.restore();
  }
}

// Tag "DOCX" (K3: escala 0 → 1 con snap, -8° → 0, opacidad en 2 f).
function drawTag(c, t) {
  if (t < 58) return;
  const k = spr(t, 58, SPR.snap);
  const a = clamp((t - 58) / 2);
  c.save();
  c.globalAlpha *= a;
  c.translate(TAG.x + TAG.w / 2, TAG.y + TAG.h / 2);
  c.rotate((-8 * Math.PI) / 180 * (1 - k));
  c.scale(k, k);
  rr(c, -TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 10);
  c.fillStyle = C.accentSoft;
  c.fill();
  const st = { size: 20, weight: 800, tracking: 0.06 };
  const tw = textWidth(c, "DOCX", st);
  setType(c, st);
  c.fillStyle = C.accentInk;
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillText("DOCX", -tw / 2, capHeight(c, st) / 2);
  c.restore();
}

// Contenido de la tarjeta en coordenadas de la tarjeta (sin cámara).
function drawCardLocal(c, t, q) {
  c.drawImage(cardBase(q), OFF.x, OFF.y, OFF.w, OFF.h);
  drawTag(c, t);
  drawTitle(c, t);
  drawBodyBars(c, t);
}

// La tarjeta en pantalla: en vivo mientras está en z 0; mientras retrocede se
// dibuja a un buffer, se desenfoca ahí (sin transformación: el filtro sobre
// un drawImage transformado costaba ~120 ms) y se compone escalada y
// desvanecida.
const OFF = { x: 640, y: 200, w: 640, h: 760 };

// Base de la tarjeta (relleno, borde y sombra): no cambia, se dibuja una vez
// por resolución de render.
const baseCache = new Map();
function cardBase(q) {
  let cv = baseCache.get(q);
  if (!cv) {
    cv = createCanvas(Math.ceil(OFF.w * q), Math.ceil(OFF.h * q));
    const x = cv.getContext("2d");
    x.setTransform(q, 0, 0, q, -OFF.x * q, -OFF.y * q);
    card(x, CARD.x, CARD.y, CARD.w, CARD.h, { r: CARD.r, lift: 1 });
    baseCache.set(q, cv);
  }
  return cv;
}

function drawCard(ctx, t) {
  const cs = cardState(t);
  if (cs.alpha <= 0.002) return;
  const q = env.scale;
  const place = (c) => {
    c.translate(960, 540);
    c.scale(cs.s, cs.s);
    c.translate(-960, -540);
    c.translate(CARD.cx, CARD.cy);
    c.scale(cs.sx, cs.sy);
    c.translate(-CARD.cx, -CARD.cy);
  };
  if (cs.blur < 0.3) {
    ctx.save();
    place(ctx);
    drawCardLocal(ctx, t, q);
    ctx.restore();
    return;
  }
  const A = offscreen("s1-card", OFF.w * q, OFF.h * q);
  A.ctx.setTransform(q, 0, 0, q, -OFF.x * q, -OFF.y * q);
  drawCardLocal(A.ctx, t, q);
  // Desenfoque de profundidad: 8 px en pantalla al final del retroceso (se
  // compensa la escala de perspectiva que se aplica después).
  // El desenfoque se hace a media resolución (la tarjeta ya está borrosa).
  const B = offscreen("s1-card-b", (OFF.w * q) / 2, (OFF.h * q) / 2);
  B.ctx.filter = `blur(${((cs.blur / cs.s) * q * 0.5).toFixed(2)}px)`;
  B.ctx.drawImage(A.canvas, 0, 0, B.canvas.width, B.canvas.height);
  B.ctx.filter = "none";
  ctx.save();
  place(ctx);
  ctx.globalAlpha *= cs.alpha;
  ctx.drawImage(B.canvas, OFF.x, OFF.y, OFF.w, OFF.h);
  ctx.restore();
}

// Una pastilla de área (rect centrado) con relleno, borde y sombra de vuelo.
function drawPillShape(c, R, { fill = "#ffffff", borderA = 1, lift = 0 } = {}) {
  const x = R.cx - R.w / 2;
  const y = R.cy - R.h / 2;
  if (lift > 0.01) {
    c.save();
    c.shadowColor = `rgba(28,25,23,${0.07 * lift})`;
    c.shadowBlur = 26 * lift;
    c.shadowOffsetY = 12 * lift;
    rr(c, x, y, R.w, R.h, R.r);
    c.fillStyle = fill;
    c.fill();
    c.restore();
  }
  rr(c, x, y, R.w, R.h, R.r);
  c.fillStyle = fill;
  c.fill();
  if (borderA > 0.01) {
    c.save();
    c.globalAlpha *= borderA;
    rr(c, x + 1, y + 1, R.w - 2, R.h - 2, Math.max(0, R.r - 1));
    c.lineWidth = 2;
    c.strokeStyle = C.border;
    c.stroke();
    c.restore();
  }
}

// Etiqueta de la pastilla: aparece en la llegada (-2 a +2 f) mientras el
// tracking se cierra de +0,12em a 0. Sigue al rect si todavía se mueve.
function labelProgram(t, tA, extraW = 0) {
  const k = clamp((t - (tA - 2)) / 4);
  const extra = 0.12 * LABEL.size * (1 - EASE.ink(k));
  return (tt, g, st, ph) => {
    st.alpha *= k;
    st.dx += (g.i - (ph.n - 1) / 2) * extra;
    if (extraW) st.weight = lerp(ph.wght, 700, extraW);
  };
}
function drawLabel(c, P, R, program, o, s = R.w / P.w) {
  c.save();
  c.translate(R.cx, R.cy);
  c.scale(s, s);
  c.translate(-P.cx, -P.cy);
  drawPhrase(c, P.label, 0, program, o);
  c.restore();
}

// Formación Personal y Social seleccionada: el acento inunda desde el toque
// del punto (círculo 11 → 240 px, brake) y la etiqueta se invierte por la
// misma máscara (K7): blanca y w700 adentro, #57534e afuera.
function drawSelected(c, t, R, labelAlpha = 1) {
  const x = R.cx - R.w / 2;
  const y = R.cy - R.h / 2;
  const scaleK = R.w / P0.w;
  const fr = floodR(t) * scaleK;
  const full = fr >= Math.hypot(R.w, R.h) / 2;
  drawPillShape(c, R, { fill: "#ffffff", borderA: full ? 0 : 1 });
  c.save();
  rr(c, x, y, R.w, R.h, R.r);
  c.clip();
  c.fillStyle = C.accent;
  if (full) c.fillRect(x - 2, y - 2, R.w + 4, R.h + 4);
  else {
    c.beginPath();
    c.arc(R.cx, R.cy, fr, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  if (labelAlpha <= 0.002) return;
  const base = labelProgram(t, barLaunch(0) + 8);
  const fade = (tt, g, st) => {
    st.alpha *= labelAlpha;
  };
  const inv = (tt, g, st) => {
    st.weight = lerp(600, 700, EASE.ink(clamp((t - 77) / 4)));
  };
  // Afuera del círculo.
  if (!full) {
    c.save();
    c.beginPath();
    c.rect(-4000, -4000, 12000, 12000);
    c.arc(R.cx, R.cy, fr, 0, Math.PI * 2);
    c.clip("evenodd");
    drawLabel(c, P0, R, [base, fade]);
    c.restore();
  }
  // Adentro.
  c.save();
  c.beginPath();
  c.arc(R.cx, R.cy, full ? 1e5 : fr, 0, Math.PI * 2);
  c.clip();
  drawLabel(c, P0, R, [base, inv, fade], { colorOverride: "#ffffff" });
  c.restore();
}

// Anillo de foco del toque: el borde de la pestaña se expande 0 → 16 px.
function tapRing(c, t) {
  if (t < 77 || t > 84) return;
  const k = EASE.glide(clamp((t - 77) / 7));
  const g = 16 * k;
  c.save();
  c.globalAlpha *= 0.7 * (1 - k);
  c.lineWidth = lerp(3, 1, k);
  c.strokeStyle = C.accent;
  rr(c, P0.x - g, P0.y - g, P0.w + 2 * g, PILL_H + 2 * g, 14 + g);
  c.stroke();
  c.restore();
}

function drawPills(ctx, cam, t) {
  layer(ctx, cam, 0, (c) => {
    // Primero las que vuelan detrás de las que ya aterrizaron.
    const order = [...PILLS.keys()].sort((a, b) => b - a);
    for (const i of order) {
      if (i === 0 && t >= T3.t0) continue; // la dibuja T3 en pantalla
      const S = pillState(i, t);
      if (!S) continue;
      const P = PILLS[i];
      const pu = pushOf(i, t);
      if (pu.a <= 0.002) continue;
      c.save();
      c.globalAlpha *= pu.a;
      c.translate(pu.dx, pu.dy);
      if (pu.s !== 1) {
        c.translate(S.cx, S.cy);
        c.scale(pu.s, pu.s);
        c.translate(-S.cx, -S.cy);
      }
      if (i === 0 && t >= 77) {
        drawSelected(c, t, { ...S, w: S.w * popFPyS(t), h: S.h * popFPyS(t), r: S.r * popFPyS(t) });
      } else {
        drawPillShape(c, S, { fill: S.fill, borderA: S.borderA, lift: S.lift });
        if (t >= S.tA - 2) drawLabel(c, P, S, [labelProgram(t, S.tA)]);
      }
      c.restore();
    }
    if (t < T3.t0 + 3) tapRing(c, t);
  });
}

// T3: la pestaña seleccionada, en pantalla, crece hasta ser el campo.
function drawGrow(ctx, t) {
  const R = growRect(t);
  const la = 1 - EASE.accel(clamp((t - 78.5) / 3.5));
  drawSelected(ctx, t, R, la);
}

// ─── frase y punto ───────────────────────────────────────────────────────────
function drawPhraseLayer(ctx, t) {
  drawPhrase(ctx, PH1, t, PROG1);
  drawPhrase(ctx, PH2, t, PROG2);
}

function drawDotActor(ctx, t) {
  const D = dotState(t);
  if (!D) return;
  drawDot(ctx, D.x, D.y, D.d, C.accent);
  if (D.flying) {
    emit(ctx, (e) => {
      e.fillStyle = "rgba(251,146,60,0.9)";
      e.beginPath();
      e.arc(D.x, D.y, D.d * 0.7, 0, Math.PI * 2);
      e.fill();
    });
  }
}

// Anillos del pulso: f14, f28, f42 en la frase; f56 en el punto del documento.
function drawRings(ctx, t) {
  for (const Hh of [14, 28, 42]) ring(ctx, t, Hh, DOT.cx, DOT.cy, DOT.d, C.accent);
}

// ─── draw ────────────────────────────────────────────────────────────────────
function draw(ctx, t) {
  const cam = worldCam(t);
  const cov = coverage(t);

  ctx.fillStyle = C.surface;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  drawGhost(ctx, cam, t);
  drawGrid(ctx, cam, t);

  if (t < 48) {
    // Frase en pantalla (quieta de R a L; la cámara solo mueve el mundo).
    drawPhraseLayer(ctx, t);
    impactRing(ctx, t);
    drawRings(ctx, t);
    drawDotActor(ctx, t);
  } else if (t < 56) {
    // T1: la máscara se cierra hasta la tarjeta; adentro la frase se achica.
    const M = maskRect(t);
    drawMaskCard(ctx, M);
    ctx.save();
    rr(ctx, M.x, M.y, M.w, M.h, M.r);
    ctx.clip();
    // Adentro de la hoja el mundo se apaga mientras el papel se vuelve blanco.
    const worldIn = 1 - smoothstep(0, 0.7, M.e);
    if (worldIn > 0.002) {
      ctx.save();
      ctx.globalAlpha *= worldIn;
      drawGhost(ctx, cam, t);
      drawGrid(ctx, cam, t);
      ctx.restore();
    }
    const s = zoomOf(t);
    ctx.save();
    ctx.translate(ZC[0], ZC[1]);
    ctx.scale(s, s);
    ctx.translate(-ZC[0], -ZC[1]);
    drawPhraseLayer(ctx, t);
    drawRings(ctx, t);
    ctx.restore();
    if (t >= 54) {
      // Los renglones ya viven en la tarjeta, que todavía termina de cerrar.
      const k = s / S_DOC;
      ctx.save();
      ctx.translate(ZC[0], ZC[1]);
      ctx.scale(k, k);
      ctx.translate(-ZC[0], -ZC[1]);
      drawBodyBars(ctx, t);
      ctx.restore();
    }
    ctx.restore();
    drawDotActor(ctx, t);
  } else {
    drawCard(ctx, t);
    const D = dotState(t);
    if (D && t < 67) ring(ctx, t, 56, D.x, D.y, D.d, C.accent);
    if (t < T3.t0) {
      drawPills(ctx, cam, t);
      drawDotActor(ctx, t);
    } else {
      drawGrow(ctx, t);
      drawPills(ctx, cam, t);
    }
  }

  drawMotes(ctx, cam, t, cov);
  drawLeak(ctx, t, 1 - cov);
}

// ─── interfaz de escena ──────────────────────────────────────────────────────

// Motion blur (2.5): 270° en el impacto, la cinta de K6 y la subida; 180° en
// la lectura; 360° en el cierre de máscara; 270° en renglones, vuelos y tag;
// 360° en T3.
// Donde el recorrido por cuadro es enorme (la cinta de K6 a ~400 px/f, el zoom
// del recorte, la inundación y el crecimiento de T3) se suben los sub-frames
// para que la estela sea continua y no una serie de copias.
function motion(t) {
  if (t >= 1 && t < 5) return { shutter: 0.75, samples: 40 };
  if (t < 17) return { shutter: 0.75, samples: 12 };
  if (t < 48) return { shutter: 0.5, samples: 8 };
  if (t < 56) return { shutter: 1, samples: 24 };
  if (t >= 68 && t < 77) return { shutter: 0.75, samples: 24 }; // vuelo del punto
  if (t < 77) return { shutter: 0.75, samples: 12 };
  if (t < 78) return { shutter: 0.75, samples: 32 };
  if (t < 80) return { shutter: 1, samples: 32 };
  return { shutter: 1, samples: 64 };
}

// Grade: Papel hasta T3; después Papel → Acento por la cobertura de la
// pestaña que crece, promediada sobre el obturador del cuadro.
function field(f) {
  if (f < T3.t0) return { papel: 1 };
  const m = motion(f);
  const n = 16;
  let acc = 0;
  for (let s = 0; s < n; s++) acc += coverage(f + ((s + 0.5) / n - 1) * m.shutter);
  const cov = acc / n;
  return { papel: 1 - cov, acento: cov };
}

export const phrases = [{ id: "subis-tu-planificacion", words: 3, R: 14, L: 48 }];

export const hits = [
  { f: 0, level: "H1", kind: "impacto del punto" },
  { f: 7, level: "H3", kind: "contacto de Subís" },
  { f: 14, level: "H2", kind: "anillo" },
  { f: 28, level: "H2", kind: "anillo y golpe de peso" },
  { f: 42, level: "H2", kind: "anillo" },
  { f: 45.5, level: "H3", kind: "inhalación" },
  { f: 56, level: "H1", kind: "tarjeta .docx" },
  { f: 63, level: "H3", kind: "renglones lanzados" },
  { f: 70, level: "H2", kind: "primera pestaña" },
  { f: 77, level: "H3", kind: "toque en Formación Personal y Social" },
];

export default {
  id: "s1",
  start: 0,
  end: 84,
  draw,
  motion,
  field,
  phrases,
  hits,
};
