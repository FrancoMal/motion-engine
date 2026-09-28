// S3 "Área por área." (tratamiento final 3.3 TW y 3.4), f134-199, Noche.
//
// Trazo Inicial redacta y la docente ve PROGRESO, nunca texto: "Trabajando en
// Ejemplo, Alex", "Redactando sección N de 7…", "Revisando la redacción…",
// "Sala Verde · 3/12 listos". Todo sale de la app real.
//
//   TW  f134-146  barrido de swash: un cuerpo de tinta cuyo borde es el swash
//                 del logo x34 barre el cuadro; su talón, como una lapicera,
//                 deja el trazo que después es la pista de progreso.
//       f140      "Área" (K1) mientras el borde cruza el centro; f147 "por";
//                 f154 "área."; el punto aparece en f156.5 con destello.
//       f147-182  siete secciones: cada relleno rueda "sección N de 7", manda
//                 una onda de tinta por la frase (K8) y empuja la cámara del
//                 mundo un escalón (+0,8 %), con paralaje entre capas.
//   T7  f184-188  los huecos se cierran: los segmentos se vuelven una barra.
//       f185.5    "Listo" y "4/12 listos".
//   T8  f191-199  la barra se parte en dos reglas que se abren como un
//                 párpado; cada mitad de la noche se lleva lo suyo y adentro
//                 aparece S4 (papel, el informe terminado).
//
// La frase y la placa de UI (pista y textos) quedan quietas en pantalla; la
// cámara mueve solo el mundo de atrás (renglones, grilla, número fantasma) y
// las motas de adelante.

import { makePhrase, drawPhrase, drawDot, golpe, onda, evaporar, periodScale, glyphsStill } from "../../shared/phrase.js";
import { EASE, SPR, spr, ring, minHold } from "../../shared/system.js";
import { swashEdgePath } from "../../shared/masks.js";
import { kf, cubicBezier, spring } from "../../engine/ease.js";
import { clamp, lerp, lerpLog, mixHex, rgba, hash1, noise1, deg } from "../../engine/math.js";
import { camera, layer } from "../../engine/camera.js";
import { emit } from "../../engine/env.js";
import { setType } from "../../engine/text.js";
import { tag } from "../../shared/ui.js";
import { C } from "../../shared/brand.js";
import { edgeAt, edgeStroke, swashTail, swashBristles, swashCoverage, makeCaption, drawCaption, beatEnv } from "./s3-parts.js";

// ─── paleta (tokens ámbar, modo oscuro) ──────────────────────────────────────
const FIELD = C.ink; // #1c1917
const LINE = C.dCard; // #26201c
const HOT = C.dAccent; // #fb923c
const EMBER = C.accent; // #c2410c
const GLOW = C.dAccentInk; // #fed7aa
const WHITE_HOT = "#fff3e3";
const TRACK = C.dBorder; // #3a322c

// ─── tiempo ──────────────────────────────────────────────────────────────────
const START = 134;
const END = 199;
// "Área" golpea cuando el borde del swash ya pasó entera la palabra (x ~740 en
// f140): si golpeara en f140, el motion blur de ese frame mezclaría sus glifos
// con las palabras de S2 que el barrido está tapando.
const H_AREA = 143;
const H_POR = 147;
const H_AREA2 = 154;
const POP = 156.5; // punto de "área.": pegado +2,5 f al golpe de f154
const FILLS = [147, 154, 161, 168, 175, 182]; // segmentos 2..7
const FUSE0 = 184; // T7
const LISTO = 185.5;
const EXT0 = 188.5; // la barra estira sus puntas hasta los bordes
const EYE0 = 191; // T8
// La frase se termina de ir antes de que el párpado se abra de verdad (f194):
// si no, el motion blur deja un fantasma de "área" sobre el informe.
const EVAP_T0 = 187.5;
const EVAP_STAGGER = 0.25; // K5 comprimido: todo (con el punto) evaporado en f196.75,
const EVAP_DUR = 4; // antes de que el párpado termine de abrir

// ─── swash (TW) ──────────────────────────────────────────────────────────────
const OUT_QUART = cubicBezier(0.25, 1, 0.5, 1);
// Borde: cruza x 960 con el medio del swash (X + 68) justo en f140, a velocidad
// pico.
export const swashX = (t) => kf(t, [[134, -600], [140, 892, EASE.accel], [146, 2000, OUT_QUART]]);
const swashV = (t) => (swashX(t + 0.01) - swashX(t - 0.01)) / 0.02;
const NIB_DX = edgeAt(0, 708); // el talón a la altura del centro de la pista
// Banda de la frase: ahí el labio se dibuja arriba de los glifos (drawTop).
const BAND = { x: 100, y: 300, w: 1720, h: 345 };
const WIPE_SAMPLES = 16;

// ─── párpado (T8) ────────────────────────────────────────────────────────────
// Reglas de 8 px desde y 704 / 712 hasta -10 / 1090 en whip. La apertura va de
// 8 a 1100 px (x137): regla del log (2.2), así el ojo se ve "abierto a medias"
// justo en el beat de f196.
// El centro acompaña a la apertura (no al tiempo): si no, la ranura subiría
// antes de abrirse.
export function eyelid(t) {
  const u = EASE.whip(clamp((t - EYE0) / 8));
  const h = lerpLog(8, 1100, u, 1);
  const c = lerp(708, 540, (h - 8) / 1092);
  return { top: c - h / 2, bottom: c + h / 2 };
}
function eyelidV(t) {
  const a = eyelid(t - 0.01);
  const b = eyelid(t + 0.01);
  return { top: (b.top - a.top) / 0.02, bottom: (b.bottom - a.bottom) / 0.02 };
}

// ─── frase ───────────────────────────────────────────────────────────────────
const PH = makePhrase({
  text: "Área por área.",
  size: 250,
  wght: 760,
  tracking: -0.045,
  x: 960,
  baseline: 560,
  align: "center",
  color: C.dInk,
  periodColor: HOT,
});
const PROGRAM = [
  golpe(H_AREA, 0),
  golpe(H_POR, 1),
  golpe(H_AREA2, 2),
  ...FILLS.map((f) => onda(f, 90)),
  evaporar(EVAP_T0, { stagger: EVAP_STAGGER, dur: EVAP_DUR }),
];
const RINGS = [POP, 168, 182];

// R y L medidos con el mismo chequeo de E9 (glifos quietos, enteros, a peso de
// reposo), muestreando cada 0,25 f: el tramo legible continuo que contiene la
// sostenida (f170). R = primer frame entero adentro del tramo, L = primer
// frame entero que ya no es legible.
function measureRL() {
  const step = 0.25;
  const still = (t) => glyphsStill(PH, t, PROGRAM);
  let a = 170;
  while (a - step >= H_AREA && still(a - step)) a -= step;
  let b = 170;
  while (b + step < END && still(b + step)) b += step;
  return { R: Math.ceil(a), L: Math.ceil(b + step) };
}
const RL = measureRL();

// ─── pista ───────────────────────────────────────────────────────────────────
const X0 = 187;
const X1 = 1733;
const TY = 700;
const TH = 16;
const SEG_W = 207.1;
const PITCH = 223.1;
const FUSED_W = (X1 - X0) / 7;
// Relleno de segmento: rigidez del snap con amortiguación más firme, así el
// pico queda en ~214 px (7 px dentro del hueco) como pide 3.4, no en 231.
const FILL_SPR = { stiffness: 700, damping: 39, mass: 1 };
const fillP = (t, f) => (t <= f ? 0 : spring(t - f, FILL_SPR));

// El trazo del talón se enfría de izquierda a derecha (f142-147) desde x 394;
// el frente es suave (180 px) y los huecos se abren a medida que pasa.
const coolFront = (t) => lerp(394, 1913, clamp((t - 142) / 5));
const coolAt = (x, front) => clamp((front - x) / 180);

function segments(t) {
  const front = coolFront(t);
  const fuse = EASE.brake(clamp((t - FUSE0) / 4));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const gl = i === 0 ? 0 : 16 * coolAt(X0 + PITCH * i - 8, front);
    const gr = i === 6 ? 0 : 16 * coolAt(X0 + PITCH * (i + 1) - 8, front);
    let a = i === 0 ? X0 : X0 + PITCH * i - 8 + gl / 2;
    let b = i === 6 ? X1 : X0 + PITCH * (i + 1) - 8 - gr / 2;
    const fa = X0 + FUSED_W * i;
    a = lerp(a, fa, fuse);
    b = lerp(b, fa + FUSED_W, fuse);
    const rl = i === 0 ? 8 : 8 * (gl / 16) * (1 - fuse);
    const rr = i === 6 ? 8 : 8 * (gr / 16) * (1 - fuse);
    // Solape de medio px donde no hay hueco: sin costuras de antialias.
    const ol = rl < 0.5 && i > 0 ? 0.6 : 0;
    const or = rr < 0.5 && i < 6 ? 0.6 : 0;
    out.push({ a: a - ol, b: b + or, rl, rr });
  }
  return out;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2))));
}

// La pista completa. em = true la dibuja para la capa emisiva: lo frío no
// brilla (negro) y lo caliente sí.
function drawTrack(ctx, t, em = false) {
  if (t >= EYE0) return;
  const nib = swashX(t) + NIB_DX;
  if (nib <= X0) return;
  const cool = em ? "#000000" : TRACK;
  const ext = EASE.brake(clamp((t - EXT0) / 2.5));

  if (t >= EXT0) {
    // Barra fundida estirándose hasta los bordes del cuadro (antesala del
    // párpado: la línea se vuelve horizonte).
    const xa = lerp(X0, -40, ext);
    const xb = lerp(X1, 1960, ext);
    ctx.fillStyle = HOT;
    rrect(ctx, xa, TY, xb - xa, TH, [8, 8, 8, 8]);
    ctx.fill();
    if (em) fuseBoost(ctx, t, xa, xb);
    return;
  }

  const front = coolFront(t);
  let slotFill;
  if (t < 142) slotFill = HOT;
  else if (front >= 1912.9) slotFill = cool;
  else {
    const g = ctx.createLinearGradient(front - 180, 0, front, 0);
    g.addColorStop(0, cool);
    g.addColorStop(1, HOT);
    slotFill = g;
  }
  const trailEnd = Math.min(X1, nib);
  ctx.save();
  if (trailEnd < X1) {
    ctx.beginPath();
    ctx.rect(X0 - 20, TY - 20, trailEnd - X0 + 20, TH + 40);
    ctx.clip();
  }
  const S = segments(t);
  S.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? HOT : slotFill;
    rrect(ctx, s.a, TY, s.b - s.a, TH, [s.rl, s.rr, s.rr, s.rl]);
    ctx.fill();
    if (i === 0) return;
    const p = fillP(t, FILLS[i - 1]);
    if (p <= 0.001) return;
    const w = (s.b - s.a) * p;
    const rrF = Math.min(8, s.rr + 8 * (1 - clamp(p)));
    ctx.fillStyle = HOT;
    rrect(ctx, s.a, TY, w, TH, [s.rl > 0.5 ? s.rl : 0, rrF, rrF, s.rl > 0.5 ? s.rl : 0]);
    ctx.fill();
    // Punta caliente mientras llena.
    const hk = 1 - clamp((t - FILLS[i - 1]) / 7);
    if (hk > 0.01) {
      const hx = s.a + w;
      const g = ctx.createLinearGradient(hx - 46, 0, hx, 0);
      g.addColorStop(0, rgba(GLOW, 0));
      g.addColorStop(1, rgba(em ? HOT : GLOW, 0.95 * hk));
      ctx.fillStyle = g;
      rrect(ctx, Math.max(s.a, hx - 46), TY, Math.min(46, w), TH, [0, rrF, rrF, 0]);
      ctx.fill();
    }
  });
  ctx.restore();
  if (em) {
    // El residuo del segmento 1 se asienta en f144 con un latido.
    const r = beatEnv(t, [144]);
    if (r > 0) {
      ctx.fillStyle = rgba(HOT, 0.5 * r);
      rrect(ctx, X0 - 6, TY - 6, SEG_W + 12, TH + 12, [14, 14, 14, 14]);
      ctx.fill();
    }
    fuseBoost(ctx, t, X0, X1);
  }
  // Chispas en las juntas cuando los huecos terminan de cerrarse.
  if (t >= FUSE0 && t < FUSE0 + 7) {
    const fuse = EASE.brake(clamp((t - FUSE0) / 4));
    const k = clamp((fuse - 0.72) / 0.28) * (1 - clamp((t - (FUSE0 + 3.5)) / 3.5));
    if (k > 0.01) {
      for (let j = 1; j < 7; j++) {
        const x = X0 + FUSED_W * j;
        const g = ctx.createRadialGradient(x, TY + TH / 2, 0, x, TY + TH / 2, 26);
        g.addColorStop(0, rgba(WHITE_HOT, 0.95 * k));
        g.addColorStop(0.35, rgba(GLOW, 0.5 * k));
        g.addColorStop(1, rgba(HOT, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(x, TY + TH / 2);
        ctx.scale(1, 0.55);
        ctx.translate(-x, -(TY + TH / 2));
        ctx.fillRect(x - 26, TY + TH / 2 - 26, 52, 52);
        ctx.restore();
      }
    }
  }
}

// Brasas: cuando un relleno llega al final de su segmento suelta 8 chispas (5
// en f144, el residuo del segmento 1), con tiro balístico analítico (sin
// estado: posición = f(edad)). Semillas fijas.
const EMBERS = [
  { f: 144, x: X0 + SEG_W, n: 5 },
  ...FILLS.map((f, i) => ({ f: f + 3, x: X0 + PITCH * (i + 1) + SEG_W, n: 8 })),
].flatMap((b, j) =>
  Array.from({ length: b.n }, (_, k) => {
    const h = (m) => hash1(j * 97 + k * 13 + m);
    return {
      t0: b.f + 0.35 * k,
      x: b.x - 6 + 8 * h(1),
      vx: -2 + 8 * h(2),
      vy: -(6 + 9 * h(3)),
      life: 9 + 9 * h(4),
      r: 2 + 2.6 * h(5),
    };
  }),
);
const GRAV = 0.5;
function drawEmbers(ctx, t, em = false) {
  for (const e of EMBERS) {
    const a = t - e.t0;
    if (a <= 0 || a >= e.life) continue;
    const x = e.x + e.vx * a;
    const y = TY + TH / 2 + e.vy * a + 0.5 * GRAV * a * a;
    const vy = e.vy + GRAV * a;
    const k = a / e.life;
    const alpha = Math.pow(1 - k, 1.4);
    const col = k < 0.25 ? WHITE_HOT : k < 0.6 ? GLOW : HOT;
    // Chispa estirada en la dirección de su velocidad (0,8 f de recorrido).
    ctx.strokeStyle = rgba(em ? HOT : col, alpha);
    ctx.lineWidth = e.r * (1 - 0.5 * k);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - e.vx * 0.8, y - vy * 0.8);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

// Emisivo +0,2 durante 3 f cuando la barra se funde (T7).
function fuseBoost(ctx, t, xa, xb) {
  // 3 f: sube en 1 f cuando los huecos terminan de cerrarse y cae en 2.
  const a = t - 186;
  if (a <= 0 || a >= 3) return;
  const k = a < 1 ? EASE.brake(a) : 1 - EASE.swell((a - 1) / 2);
  ctx.fillStyle = rgba(HOT, 0.2 * k);
  rrect(ctx, xa - 8, TY - 8, xb - xa + 16, TH + 16, [16, 16, 16, 16]);
  ctx.fill();
}

// ─── textos de la tarjeta de progreso ────────────────────────────────────────
const CAP_TOP = makeCaption("Trabajando en Ejemplo, Alex", { size: 34, weight: 600, x: 215, baseline: 250, color: C.dInkSoft });
const CAP_SEC = makeCaption("Redactando sección 1 de 7…", { size: 34, weight: 500, x: 187, baseline: 790, color: C.dInkSoft });
const CAP_REV = makeCaption("Revisando la redacción…", { size: 34, weight: 500, x: 187, baseline: 790, color: C.dInkSoft });
const CAP_SALA = makeCaption("Sala Verde · 3/12 listos", { size: 30, weight: 600, x: 1733, baseline: 790, align: "right", color: C.dInkMute });
const SEC_STEPS = [[0, "Redactando sección 1 de 7…"], ...FILLS.map((f, i) => [f, `Redactando sección ${i + 2} de 7…`])];
const SALA_STEPS = [[0, "Sala Verde · 3/12 listos"], [LISTO, "Sala Verde · 4/12 listos"]];
const DOT = { x: 197, y: 238, d: 12 };
const ROLL0 = 183; // "Revisando la redacción…" entra rodando (4 f)

function drawCaptions(ctx, t, part) {
  if (t < 140.5) return;
  if (part !== "lower") {
    // Punto que late en cada beat y "Trabajando en Ejemplo, Alex".
    const pop = spr(t, 141, SPR.slam);
    const out = 1 - EASE.accel(clamp((t - 187.5) / 3));
    const sc = pop * out * (1 + 0.35 * beatEnv(t, [154, 168, 182]));
    if (sc > 0.01) {
      drawDot(ctx, DOT.x, DOT.y, DOT.d, HOT, { scale: sc });
      emit(ctx, (e) => drawDot(e, DOT.x, DOT.y, DOT.d, HOT, { scale: sc * 1.15 }));
    }
    drawCaption(ctx, CAP_TOP, t, { rise: { t0: 141.5, stagger: 0.1 }, evap: { t0: 187.8, stagger: 0.1, dur: 4 } });
  }
  if (part !== "upper") {
    // "Redactando sección N de 7…" rueda a "Revisando la redacción…".
    const u = EASE.lunge(clamp((t - ROLL0) / 4));
    const D = 46;
    ctx.save();
    if (u > 0 && u < 1) {
      ctx.beginPath();
      ctx.rect(150, 790 - 40, 900, 54);
      ctx.clip();
    }
    if (u < 1) {
      ctx.save();
      ctx.translate(0, -D * u);
      drawCaption(ctx, CAP_SEC, t, { steps: SEC_STEPS, rise: { t0: 142.5, stagger: 0.1 }, alpha: 1 - u * u });
      ctx.restore();
    }
    if (u > 0) {
      ctx.save();
      ctx.translate(0, D * (1 - u));
      drawCaption(ctx, CAP_REV, t, { evap: { t0: 188.3, stagger: 0.12, dur: 4 }, alpha: Math.sqrt(u) });
      ctx.restore();
    }
    ctx.restore();
    drawCaption(ctx, CAP_SALA, t, { steps: SALA_STEPS, rise: { t0: 143.5, stagger: 0.1 }, evap: { t0: 188.8, stagger: 0.12, dur: 4 } });
  }
}

// "Listo" (K3 con back): viaja montado en la barra y después en la regla de
// abajo del párpado.
function drawListo(ctx, t, dy = 0, fade = 1) {
  if (t < LISTO || fade <= 0.002) return;
  const u = clamp((t - LISTO) / 6);
  const s = EASE.back(u);
  const alpha = clamp((t - LISTO) / 2) * fade;
  const cx = 1789;
  const cy = 708 + dy;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(deg(-8) * (1 - clamp(s)));
  ctx.translate(-cx, -cy);
  tag(ctx, 1749, 690 + dy, "Listo", { tone: "success", size: 22, scale: s, alpha });
  ctx.restore();
}

// ─── mundo (capas con profundidad) ───────────────────────────────────────────
// Escalones de cámara: +0,8 % por relleno (snap), de 1,000 a 1,048 en el plano
// z = 0. Se hace como dolly en z, así cada capa escala distinto (paralaje real).
const F = 1400;
function worldCam(t) {
  let s0 = 1;
  for (const f of FILLS) s0 += 0.008 * spr(t, f, SPR.snap);
  return camera({ F, z: F * (1 - 1 / s0) });
}

// Sección visible en el número fantasma.
function sectionAt(t) {
  let n = 1;
  let since = -1e9;
  FILLS.forEach((f, i) => {
    if (t >= f) {
      n = i + 2;
      since = f;
    }
  });
  return { n, since };
}

function drawWorld(ctx, t) {
  ctx.fillStyle = FIELD;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  // Aire cálido detrás de la frase: la barra es la fuente de luz.
  const glowK = 0.55 + 0.45 * clamp((t - 142) / 40);
  const g = ctx.createRadialGradient(960, 640, 0, 960, 640, 1150);
  g.addColorStop(0, rgba("#2c211b", 0.9 * glowK));
  g.addColorStop(1, rgba("#2c211b", 0));
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 12000, 12000);

  const cam = worldCam(t);

  // L1: número de sección fantasma, muy lejos (z +900).
  layer(ctx, cam, 900, (c) => {
    const { n, since } = sectionAt(t);
    const u = EASE.lunge(clamp((t - since) / 9));
    const style = { size: 1150, weight: 800, tracking: 0 };
    setType(c, style);
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    const X = 1780;
    const Y = 1010;
    const D = 360;
    c.fillStyle = "#29211d";
    if (u < 1 && n > 1) {
      c.globalAlpha = 1 - u;
      c.fillText(String(n - 1), X, Y - D * u);
    }
    c.globalAlpha = u < 1 && n > 1 ? u : 1;
    c.fillText(String(n), X, Y + (n > 1 ? D * (1 - u) : 0));
    c.globalAlpha = 1;
    c.textAlign = "left";
  });

  // L1: renglones (el papel donde se va a escribir el informe), subiendo 12 px/s.
  layer(ctx, cam, 600, (c) => {
    const off = (((-0.4 * (t - START)) % 64) + 64) % 64;
    c.strokeStyle = "#2b2420";
    c.lineWidth = 2;
    c.beginPath();
    for (let y = -700 + off; y < 1800; y += 64) {
      c.moveTo(-900, y);
      c.lineTo(2820, y);
    }
    c.stroke();
    // Margen de cuaderno, en brasa.
    c.strokeStyle = "#3e231a";
    c.beginPath();
    c.moveTo(40, -700);
    c.lineTo(40, 1800);
    c.stroke();
  });

  // L2: grilla de 12 columnas (márgenes 120, calle 24, columna 118), z +300.
  layer(ctx, cam, 300, (c) => {
    c.strokeStyle = "#2a231f";
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const x0 = 120 + i * 142;
      c.moveTo(x0, -400);
      c.lineTo(x0, 1500);
      c.moveTo(x0 + 118, -400);
      c.lineTo(x0 + 118, 1500);
    }
    c.stroke();
  });
  return cam;
}

// L5: motas desenfocadas por delante de todo (z -400), polvo en la luz de la
// barra. Deterministas: semilla fija.
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  x: 960 + (hash1(i * 7 + 11) - 0.5) * 1480,
  y: 540 + (hash1(i * 7 + 12) - 0.5) * 900,
  r: 5 + hash1(i * 7 + 13) * 16,
  a: 0.035 + hash1(i * 7 + 14) * 0.075,
  vy: 5 + hash1(i * 7 + 15) * 12,
  ph: hash1(i * 7 + 16) * 100,
}));
function drawMotes(ctx, t, cam) {
  layer(ctx, cam, -400, (c) => {
    for (const m of MOTES) {
      const x = m.x + 14 * noise1(t * 0.02 + m.ph, 5);
      let y = m.y - (m.vy / 30) * (t - START);
      // Las motas cerca de la pista se encienden un poco con cada relleno.
      const near = 1 - clamp(Math.abs(y - 700) / 260);
      const lit = 1 + 1.4 * near * beatEnv(t, FILLS);
      const a = m.a * lit;
      const g = c.createRadialGradient(x, y, 0, x, y, m.r);
      g.addColorStop(0, rgba(GLOW, a));
      g.addColorStop(0.6, rgba(HOT, a * 0.45));
      g.addColorStop(1, rgba(HOT, 0));
      c.fillStyle = g;
      c.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
  });
}

// Luces (screen): dos manchas del preset Noche (10 %) y la que arrastra el
// barrido 200 px detrás del borde (f134-148).
function blob(ctx, cx, cy, r, color, a) {
  if (a <= 0.002) return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.45, rgba(color, a * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function drawLeaks(ctx, t) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const d = t - START;
  blob(ctx, 1760 - 0.8 * d, 70 + 0.3 * d, 860, HOT, 0.1);
  blob(ctx, 140 + 0.5 * d, 1030, 720, HOT, 0.07);
  ctx.restore();
  // Después de f146 el compositor ya no llama a drawWipe: el resto de la luz
  // del barrido (se apaga en f148) la dibuja la escena.
  if (t >= 146) swashLeak(ctx, t);
}

// Una mitad (o todo) de la noche. part: "all" | "upper" | "lower".
function drawPlate(ctx, t, part) {
  const cam = drawWorld(ctx, t);
  if (part !== "upper") {
    drawTrack(ctx, t);
    drawEmbers(ctx, t);
    emit(ctx, (e) => {
      drawTrack(e, t, true);
      drawEmbers(e, t, true);
    });
  }
  drawCaptions(ctx, t, part);
  if (part !== "upper" && t < EYE0) drawListo(ctx, t);
  drawMotes(ctx, t, cam);
  drawLeaks(ctx, t);
}

function draw(ctx, t) {
  if (t < EYE0) {
    drawPlate(ctx, t, "all");
    return;
  }
  // T8: cada mitad de la noche se va con su regla y se lleva lo suyo.
  const { top, bottom } = eyelid(t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, -40, 2000, top + 40);
  ctx.clip();
  ctx.translate(0, top - 704);
  drawPlate(ctx, t, "upper");
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, bottom, 2000, 1160 - bottom);
  ctx.clip();
  ctx.translate(0, bottom - 712);
  drawPlate(ctx, t, "lower");
  ctx.restore();
}

// ─── TW: labio, cola y lapicera ──────────────────────────────────────────────
// region "outside": todo menos la banda de la frase (lo llama drawWipe);
// "inside": solo la banda, arriba de los glifos (lo llama drawTop).
function wipeFX(ctx, t, region) {
  if (t < START || t >= 146) return;
  const X = swashX(t);
  if (X > 1960 || X + LEAD_MAX < -40) return;
  const v = Math.max(0, swashV(t));
  const gap = v / WIPE_SAMPLES; // recorrido entre sub-frames
  // Cola de ~1 frame de recorrido: a 865 px/f un labio de 10 px promediado en
  // 16 muestras desaparece; con la cola, el calor queda como estela del swash.
  const tail = clamp(v * 1.15, 16, 1000);
  ctx.save();
  ctx.beginPath();
  if (region === "inside") ctx.rect(BAND.x, BAND.y, BAND.w, BAND.h);
  else {
    ctx.rect(-4000, -4000, 9920, 9080);
    ctx.rect(BAND.x, BAND.y, BAND.w, BAND.h);
  }
  ctx.clip(region === "inside" ? "nonzero" : "evenodd");

  const paint = (c, gain) => {
    // Cola adentro del cuerpo: calor que queda detrás del borde.
    swashTail(c, X, tail, {
      n: 18,
      colorAt: (k) => (k < 0.06 ? GLOW : k < 0.4 ? HOT : EMBER),
      alphaAt: (k) => gain * 0.9 * Math.pow(1 - k, 1.4),
    });
    // Labio de 10 px del lado de la tinta.
    c.save();
    c.clip(swashEdgePath(X));
    edgeStroke(c, X);
    c.lineWidth = 20;
    c.lineJoin = "round";
    c.strokeStyle = gain < 1 ? rgba(HOT, gain) : HOT;
    c.stroke();
    c.restore();
    // Pluma hacia adelante: rampa del largo de un sub-frame, para que las
    // 16 muestras se fundan en un degradé en vez de 16 escalones.
    if (gap > 1.5) {
      swashTail(c, X, gap, { n: 6, forward: true, colorAt: () => HOT, alphaAt: (k) => gain * 0.9 * (1 - k) });
    }
    // Cerdas del pincel: dibujan la curva del swash aun a velocidad pico.
    swashBristles(c, X, tail * 1.1, gain, { head: WHITE_HOT, hot: HOT, ember: EMBER });
  };
  paint(ctx, 1);
  emit(ctx, (e) => paint(e, 0.8));
  ctx.restore();
}
const LEAD_MAX = 272;

// La punta de la lapicera en el talón mientras escribe la pista: una cabeza
// blanca y una racha del largo de ~1 frame de recorrido (a 800 px/f una punta
// sola se promediaría a nada), así se lee "la lapicera dibuja la pista".
function drawNib(ctx, t) {
  if (t < START || t >= 146) return;
  const x = swashX(t) + NIB_DX;
  if (x < X0 - 40 || x > X1 + 80) return;
  const k = clamp((x - (X0 - 40)) / 40) * (1 - clamp((x - X1) / 80));
  const v = Math.max(0, swashV(t));
  const hx = Math.min(x, X1);
  const L = clamp(v * 1.1, 30, 1000);
  const y = TY + TH / 2;
  const paint = (c, gain) => {
    const x0 = Math.max(X0, hx - L);
    if (hx - x0 > 1) {
      const g = c.createLinearGradient(hx - L, 0, hx, 0);
      g.addColorStop(0, rgba(HOT, 0));
      g.addColorStop(0.7, rgba(GLOW, 0.55 * gain * k));
      g.addColorStop(1, rgba(WHITE_HOT, 0.95 * gain * k));
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(x0, TY, hx - x0, TH, 8);
      c.fill();
    }
    const r = 44;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(WHITE_HOT, gain * k));
    gr.addColorStop(0.3, rgba(GLOW, 0.7 * gain * k));
    gr.addColorStop(1, rgba(HOT, 0));
    c.fillStyle = gr;
    c.save();
    c.translate(x, y);
    c.scale(1.8, 0.55);
    c.translate(-x, -y);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  };
  paint(ctx, 1);
  emit(ctx, (e) => paint(e, 1));
}

// Luz que arrastra el barrido: 200 px detrás del borde, 10 % en screen. Como
// derrama por delante del borde, anticipa el barrido sobre S2.
function swashLeak(ctx, t) {
  if (t >= 148) return;
  const X = swashX(t);
  const env = clamp((t - 134.5) / 2) * (1 - clamp((t - 146) / 2));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  blob(ctx, edgeAt(X, 600) - 200, 600, 760, HOT, 0.1 * env);
  ctx.restore();
}

function drawWipe(ctx, t) {
  swashLeak(ctx, t);
  wipeFX(ctx, t, "outside");
  drawNib(ctx, t);
}

// ─── capa de pantalla: la frase ──────────────────────────────────────────────
function drawPeriod(ctx, t, color = HOT, glow = true) {
  const P = PH.period;
  const sc = periodScale(t, { H: POP, from: 1.7, cfg: SPR.slam });
  if (sc <= 0.001) return;
  const e0 = EVAP_T0 + PH.n * EVAP_STAGGER;
  const q = EASE.accel(clamp((t - e0) / EVAP_DUR));
  const alpha = 1 - q;
  const x = P.cx + 0.3 * PH.size * q;
  const y = P.cy - 14 * q;
  drawDot(ctx, x, y, P.d, color, { scale: sc, alpha });
  for (const H of RINGS) ring(ctx, t, H, P.cx, P.cy, P.d, color);
  if (!glow) return;
  emit(ctx, (e) => {
    drawDot(e, x, y, P.d, HOT, { scale: sc * 1.1, alpha });
    // Destello del punto al aparecer.
    const fk = 1 - clamp((t - POP) / 6);
    if (t >= POP && fk > 0) drawDot(e, P.cx, P.cy, P.d * 3.2, HOT, { alpha: fk * fk });
    for (const H of RINGS) ring(e, t, H, P.cx, P.cy, P.d, HOT);
  });
}

function drawTop(ctx, t) {
  if (t < H_AREA - 3.2) return;
  if (t < EYE0) {
    ctx.save();
    if (t < 146) ctx.clip(swashEdgePath(swashX(t)));
    drawPhrase(ctx, PH, t, PROGRAM);
    drawPeriod(ctx, t);
    ctx.restore();
    if (t < 146) wipeFX(ctx, t, "inside");
    return;
  }
  // T8: la frase se evapora solo afuera del párpado.
  const { top, bottom } = eyelid(t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, -40, 2000, top + 40);
  ctx.rect(-40, bottom, 2000, 1160 - bottom);
  ctx.clip();
  drawPhrase(ctx, PH, t, PROGRAM);
  drawPeriod(ctx, t);
  ctx.restore();
  // Adentro del párpado no se dibuja nada de la frase: ahí aparece el informe
  // terminado y tiene que verse limpio.
}

// ─── párpado (T8): reglas, sombras y estelas ─────────────────────────────────
function drawEyelid(ctx, t) {
  if (t < EYE0 || t >= END) return;
  const { top, bottom } = eyelid(t);
  const v = eyelidV(t);
  const u = clamp((t - EYE0) / 8);
  const col = mixHex(HOT, EMBER, u);
  const XA = -40;
  const XW = 2000;
  const open = bottom - top;
  // Rampa oscura del lado del papel, del largo del recorrido entre dos
  // sub-frames: el recorte duro del compositor avanza a saltos de 15-30 px y
  // sin esto el papel se vería en 16 franjas. Encima, la sombra de los
  // párpados sobre el papel.
  const ramp = (y, speed, dir, len, a) => {
    const L = Math.min(open / 2, len);
    if (L < 1) return;
    const g = ctx.createLinearGradient(0, y, 0, y + dir * L);
    g.addColorStop(0, rgba(FIELD, a));
    g.addColorStop(1, rgba(FIELD, 0));
    ctx.fillStyle = g;
    ctx.fillRect(XA, dir > 0 ? y : y - L, XW, L);
  };
  ramp(top, v.top, 1, Math.abs(v.top) / WIPE_SAMPLES, 1);
  ramp(bottom, v.bottom, -1, Math.abs(v.bottom) / WIPE_SAMPLES, 1);
  const sh = 0.2 * (1 - 0.5 * u);
  ramp(top, 0, 1, 46, sh);
  ramp(bottom, 0, -1, 46, sh);
  const paint = (c, gain) => {
    // Estela hacia el centro (de donde vienen las reglas).
    const trail = (y, speed, dir) => {
      const L = Math.min(open / 2, clamp(Math.abs(speed) * 0.3, 0, 220));
      if (L < 2) return;
      const g = c.createLinearGradient(0, y, 0, y + dir * L);
      g.addColorStop(0, rgba(col, 0.45 * gain));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(XA, dir > 0 ? y : y - L, XW, L);
    };
    trail(top + 4, v.top, 1);
    trail(bottom - 4, v.bottom, -1);
    // Regla estirada sobre su recorrido entre sub-frames con la misma energía
    // (8 / (8 + g)): así las 16 copias se tocan y forman una estela continua
    // en vez de 16 rayas.
    const rule = (y, speed, dir) => {
      const g = Math.min(open / 2, Math.abs(speed) / WIPE_SAMPLES);
      c.fillStyle = rgba(col, gain * (8 / (8 + g)));
      c.fillRect(XA, dir > 0 ? y - 4 : y - 4 - g, XW, 8 + g);
    };
    rule(top, v.top, 1);
    rule(bottom, v.bottom, -1);
  };
  paint(ctx, 1);
  emit(ctx, (e) => paint(e, 1 - u));
  // El "Listo" viaja en la regla de abajo mientras es lenta y se funde en su
  // brillo cuando acelera (a 300 px/f una etiqueta de 36 px se escalonaría).
  drawListo(ctx, t, bottom - 712, 1 - clamp((t - 193.5) / 1.5));
}

// ─── escena ──────────────────────────────────────────────────────────────────
function inWin(t, wins) {
  return wins.some(([a, b]) => t >= a && t <= b);
}
const FAST = [
  [H_AREA - 3, H_AREA + 1],
  [H_POR - 3, H_POR + 5],
  [H_AREA2 - 3, POP + 5],
  ...FILLS.map((f) => [f, f + 5]),
  [FUSE0, EYE0],
];

export default {
  id: "s3",
  start: START,
  end: END,
  draw,
  drawTop,
  topEnd: END,
  swashX,
  drawWipe,
  eyelid,
  drawEyelid,
  motion(t) {
    if ((t >= START && t <= 146) || (t >= EYE0 && t <= END)) return { shutter: 1, samples: WIPE_SAMPLES };
    if (inWin(t, FAST)) return { shutter: 0.75, samples: 12 };
    return { shutter: 0.5, samples: 8 };
  },
  // Grade por cobertura: acento → noche con el área barrida por el swash;
  // noche → papel con el área abierta del párpado.
  field(t) {
    if (t < 146) {
      const c = swashCoverage(swashX(t));
      return { acento: 1 - c, noche: c };
    }
    if (t < EYE0) return { noche: 1 };
    const { top, bottom } = eyelid(t);
    const c = clamp((bottom - top) / 1080);
    return { noche: 1 - c, papel: c };
  },
  phrases: [{ id: "Área por área.", words: 3, R: RL.R, L: RL.L, min: minHold(3) }],
  hits: [
    { f: 140, level: "H2", kind: "el swash cruza el centro; CA" },
    { f: H_AREA, level: "H3", kind: "Área (K1), ya sobre el cuerpo de tinta" },
    { f: 147, level: "H3", kind: "por (K1); segmento 2" },
    { f: 154, level: "H2", kind: "área. (K1); segmento 3" },
    { f: POP, level: "H3", kind: "punto de área. con destello (pegado +2,5)" },
    { f: 161, level: "H3", kind: "segmento 4; onda de tinta" },
    { f: 168, level: "H1", kind: "segmento 5; anillo del punto" },
    { f: 175, level: "H3", kind: "segmento 6; onda de tinta" },
    { f: 182, level: "H2", kind: "segmento 7; anillo del punto" },
    { f: LISTO, level: "H3", kind: "T7 funde la barra; Listo; 4/12 listos" },
    { f: 196, level: "H2", kind: "párpado abierto a medias" },
  ],
};
