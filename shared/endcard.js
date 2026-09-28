// Placa final compartida (tratamiento final, sección 5), f358 a f449.
//
// Un punto llega volando (lo entrega la escena anterior según el contrato de
// f358). Es la punta de una lapicera: recorre el cuarto inferior del círculo
// del logo dejando las 8 observaciones (el tramo punteado real del símbolo),
// se apoya, se vuelve tinta y traza el arco sólido. Con el mismo gesto entinta
// "Trazo Inicial redacta." y cierra el círculo exactamente sobre el primer
// punto en el downbeat de f392. Después la T: barra, anticipación, fuste,
// swash. Punteado (observar) se vuelve trazo (redactar): la tesis del producto
// es la geometría del logo.

import { EASE, SPR, spr, p as prog } from "./system.js";
import { makePhrase, drawPhrase, drawDot, tinta, periodScale } from "./phrase.js";
import { masked, lightLeak } from "../engine/fx.js";
import { emit } from "../engine/env.js";
import { softEdgeLeft } from "./masks.js";
import { clamp, lerp, lerpLog, mix, deg } from "../engine/math.js";
import { kf, E } from "../engine/ease.js";
import { C } from "./brand.js";

// ─── geometría (espacio de la placa, antes de la cámara) ─────────────────────
const S = 3.846; // px por unidad del viewBox 64
const CX = 960;
const CY = 318;
const R = 100;
const ARC_W = 2.4 * S; // 9.2 px
const T_W = 3.8 * S; // 14.6 px
const DOT_D = ARC_W; // los puntos del tramo punteado tienen el diámetro del trazo
const TIP_D = 12; // punta de la lapicera: 1,3 veces un punto
const PIVOT = [960, 318];

const DOT_ANG = Array.from({ length: 8 }, (_, k) => 60 + 12.34 * k);
const onCircle = (a) => [CX + R * Math.cos(deg(a)), CY + R * Math.sin(deg(a))];

// Barra, fuste y swash de la T.
const BAR_Y = 287.2;
const BAR_X0 = 910;
const BAR_X1 = 1010;
const STEM_Y1 = 348.8;
const SW0 = [960, 348.8];
const SWC = [960, 379.5];
const SW1 = [990.8, 387.2];

// ─── texto ───────────────────────────────────────────────────────────────────
const line1 = makePhrase({ text: "Vos observás.", size: 104, wght: 560, tracking: -0.03, x: 960, baseline: 610, align: "center", color: C.ink, periodColor: C.accent });
const line2 = makePhrase({ text: "Trazo Inicial redacta.", size: 104, wght: 760, tracking: -0.03, x: 960, baseline: 730, align: "center", color: C.ink, periodColor: C.accent });
const url = makePhrase({ text: "trazoinicial.com", size: 60, wght: 600, tracking: 0.01, x: 960, baseline: 872, align: "center", color: C.inkSoft });

// Contrato de entrada (5.1): lo cumple la escena anterior en f358.
export const contract = {
  frame: 358,
  dot: { x: 1025.0, y: 430.6, d: 15.6, color: C.accent, v: [-12.13, 7.0] },
  zoom: 1.3,
  pivot: PIVOT,
};

// ─── tiempo ──────────────────────────────────────────────────────────────────
const zoomAt = (t) => lerpLog(1.3, 1.0, prog(t, 358, 390, EASE.endCam), 0.001);

// Ángulo de la punta: recorrido constante del tramo punteado, apoyo, y después
// la cabeza del trazo sólido (de 150° a 420° = 60° + 360°).
function tipAngle(t) {
  if (t <= 372) return 60 + 6.171 * (t - 358);
  if (t <= 374) return lerp(146.39, 150, EASE.brake((t - 372) / 2));
  return 150;
}
const arcProgress = (t) => prog(t, 375, 392, EASE.pen); // trim del arco sólido 0..1
// Borde que entinta la línea 2 (mismo lápiz): llega al final en f389.
const edgeX = (t) => 427 + 1066 * prog(t, 375, 389, EASE.pen);

// Escala de pop de un punto depositado: 0 → 1,45 → 1.
function depositScale(t, tk) {
  if (t < tk) return 0;
  const s = kf(t, [
    [tk, 0],
    [tk + 2, 1.45, E.outCubic],
    [tk + 7, 1, E.inOutCubic],
  ]);
  // Titilar de f420: 1 → 1,3 → 1 en 6 f, 1 f de stagger por punto.
  return s;
}
function twinkle(t, k) {
  const t0 = 420 + k;
  if (t < t0 || t > t0 + 6) return 1;
  const u = (t - t0) / 6;
  return 1 + 0.3 * Math.sin(Math.PI * u);
}

// ─── dibujo ──────────────────────────────────────────────────────────────────

export function draw(ctx, t) {
  // Campo de papel.
  ctx.fillStyle = C.surface;
  ctx.fillRect(-4000, -4000, 12000, 12000);

  const Z = zoomAt(t);
  ctx.save();
  ctx.translate(PIVOT[0], PIVOT[1]);
  ctx.scale(Z, Z);
  ctx.translate(-PIVOT[0], -PIVOT[1]);

  drawMark(ctx, t);
  drawClaim(ctx, t);

  ctx.restore();

  // Quietud final: solo grano y un leak ámbar lento arriba a la derecha.
  const leak = 0.07 + 0.05 * prog(t, 430, 449, EASE.swell);
  lightLeak(ctx, t, { intensity: leak / 0.55, x: 0.86, y: 0.08, seed: 3 });
}

function drawMark(ctx, t) {
  // Pulso de cierre en f392 y squash del contacto del fuste en f406: se
  // aplican al símbolo, nunca al texto.
  let sx = 1;
  let sy = 1;
  if (t >= 392) {
    const pulse = t < 394 ? lerp(1, 1.025, (t - 392) / 2) : lerp(1.025, 1, spr(t, 394, SPR.snap));
    sx *= pulse;
    sy *= pulse;
  }
  if (t >= 406) {
    const k = t < 408 ? 1 : 1 - spr(t, 408, SPR.snap);
    sy *= lerp(1, 0.975, k);
    sx *= lerp(1, 1.015, k);
  }
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(sx, sy);
  ctx.translate(-CX, -CY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Arco sólido: de 150° en sentido horario hasta 150° + 270°·p.
  const ap = arcProgress(t);
  if (ap > 0) {
    const a0 = deg(150);
    const a1 = deg(150 + 270 * ap);
    ctx.beginPath();
    ctx.arc(CX, CY, R, a0, a1, false);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = ARC_W;
    ctx.stroke();
  }

  // Puntos depositados (tramo punteado). Van ENCIMA del arco, como en el logo
  // real (el path punteado se dibuja después del sólido): el punto k0 queda
  // naranja sobre el extremo del trazo cuando el círculo cierra.
  for (let k = 0; k < 8; k++) {
    const tk = 358 + 2 * k;
    const sc = depositScale(t, tk) * twinkle(t, k);
    if (sc <= 0) continue;
    const [x, y] = onCircle(DOT_ANG[k]);
    drawDot(ctx, x, y, DOT_D, C.accent, { scale: sc });
  }

  // Punta de la lapicera.
  drawTip(ctx, t, ap);

  // Destello del cierre sobre el punto k0 (capa emisiva).
  if (t >= 392 && t < 396) {
    const [x, y] = onCircle(60);
    const k = 1 - (t - 392) / 4;
    emit(ctx, (e) => {
      e.fillStyle = `rgba(251,146,60,${0.9 * k})`;
      e.beginPath();
      e.arc(x, y, 22, 0, Math.PI * 2);
      e.fill();
    });
  }

  // T: la barra crece desde el centro hacia los dos lados.
  const bar = prog(t, 392, 398, EASE.glide);
  if (bar > 0) {
    ctx.beginPath();
    const h = (BAR_X1 - BAR_X0) / 2;
    ctx.moveTo(CX - h * bar, BAR_Y);
    ctx.lineTo(CX + h * bar, BAR_Y);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = T_W;
    ctx.stroke();
  }
  // Fuste: un muñón de 2 u que sube 1,5 u (anticipación) y después baja de
  // golpe hasta el pie; contacto en f406.
  let stemEnd = null;
  if (t >= 398 && t < 401) stemEnd = BAR_Y + (2 - 1.5 * EASE.swell((t - 398) / 3)) * S;
  else if (t >= 401) stemEnd = lerp(BAR_Y + 0.5 * S, STEM_Y1, EASE.accel(clamp((t - 401) / 5)));
  if (stemEnd !== null && bar >= 1) {
    ctx.beginPath();
    ctx.moveTo(CX, BAR_Y);
    ctx.lineTo(CX, stemEnd);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = T_W;
    ctx.stroke();
  }
  // Swash de acento que se enrosca desde el pie.
  const sw = prog(t, 406, 414, EASE.glide);
  if (sw > 0) {
    ctx.beginPath();
    ctx.moveTo(SW0[0], SW0[1]);
    const n = 24;
    for (let i = 1; i <= Math.ceil(n * sw); i++) {
      const u = Math.min(sw, i / n);
      const m = 1 - u;
      ctx.lineTo(m * m * SW0[0] + 2 * m * u * SWC[0] + u * u * SW1[0], m * m * SW0[1] + 2 * m * u * SWC[1] + u * u * SW1[1]);
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = T_W;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTip(ctx, t, ap) {
  if (t >= 392) return; // el círculo cerró: la punta ya es el trazo
  let x;
  let y;
  let d;
  let color;
  if (t < 375) {
    [x, y] = onCircle(tipAngle(t));
    // Apoyo: crece 12 → 16 y pasa de acento a tinta.
    const press = prog(t, 372, 375, EASE.brake);
    d = lerp(TIP_D, 16, press);
    color = press > 0 ? mix(C.accent, C.ink, press) : C.accent;
  } else {
    // Cabeza del trazo sólido: cap redondo a 1,2x el grosor los primeros 6 f.
    [x, y] = onCircle(150 + 270 * ap);
    d = ARC_W * (t < 381 ? lerp(16 / ARC_W, 1.2, prog(t, 375, 377)) : lerp(1.2, 1, prog(t, 381, 384)));
    color = C.ink;
  }
  drawDot(ctx, x, y, d, color);
  // Brillo tenue de la punta (emisivo, peso bajo en papel).
  emit(ctx, (e) => {
    e.fillStyle = "rgba(251,146,60,0.9)";
    e.beginPath();
    e.arc(x, y, d * 0.9, 0, Math.PI * 2);
    e.fill();
  });
}

function drawClaim(ctx, t) {
  // Línea 1: "Vos" y "observás." entintan (wght 300 → 560, sube 16 px).
  const l1prog = [tinta(360.5, { word: 0, from: 300, peak: 600, rise: 16 }), tinta(364, { word: 1, from: 300, peak: 600, rise: 16 })];
  drawPhrase(ctx, line1, t, l1prog);
  if (line1.period) {
    const sc = periodScale(t, { H: 367.5, from: 1.7, cfg: SPR.slam });
    drawDot(ctx, line1.period.cx, line1.period.cy, line1.period.d, C.accent, { scale: sc });
  }

  // Línea 2: la entinta el mismo lápiz con un borde suave de 36 px.
  if (t >= 375) {
    const xe = edgeX(t);
    const prog2 = [
      (tt, g, st, ph) => {
        // Cada glifo que pasa el borde sube 16 px y entinta 300 → 760 en 3 f.
        const gx = g.ax + g.w / 2;
        const tp = passTime(gx);
        const k = EASE.brake(clamp((tt - tp) / 3));
        st.dy += 16 * (1 - k);
        st.weight = lerp(300, ph.wght, k);
      },
    ];
    const periodTp = passTime(line2.period.cx);
    const drawLine2 = (c) => {
      drawPhrase(c, line2, t, prog2);
      const kp = EASE.brake(clamp((t - periodTp) / 3));
      drawDot(c, line2.period.cx, line2.period.cy + 16 * (1 - kp), line2.period.d, C.accent, { scale: t >= 434 ? periodPulse(t) : 1 });
    };
    if (xe < 1493 + 18) {
      masked(ctx, "endcard-l2", (m) => softEdgeLeft(m, xe, 36), drawLine2);
    } else drawLine2(ctx);
  }

  // URL: aparece y se cierra de tracking (+0,35em → +0,01em), wght 300 → 600.
  if (t >= 398) {
    const k = prog(t, 398, 408, EASE.glide);
    const a = prog(t, 398, 402);
    const extra = lerp(0.34, 0, k) * url.size;
    drawPhrase(ctx, url, t, [
      (tt, g, st, ph) => {
        st.alpha *= a;
        st.dx += (g.i - (ph.n - 1) / 2) * extra;
        st.dy += 10 * (1 - k);
        st.weight = lerp(300, ph.wght, k);
      },
    ]);
  }
}

// Frame en que el borde de entintado pasa por x (inversa de edgeX por
// bisección; el borde es monótono).
function passTime(x) {
  let lo = 375;
  let hi = 389;
  if (edgeX(hi) <= x) return hi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (edgeX(mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function periodPulse(t) {
  if (t < 434) return 1;
  if (t < 436) return lerp(1, 1.18, (t - 434) / 2);
  return lerp(1.18, 1, spr(t, 436, SPR.snap));
}

// Motion blur: 270° en la punta y el trazo, 180° desde f394 (lectura nítida).
export function motion(t) {
  if (t < 394) return { shutter: 0.75, samples: 16 };
  return { shutter: 0.5, samples: 8 };
}

export const phrases = [
  { id: "claim", words: 6, R: 392, L: 450 },
  { id: "url", words: 1, R: 408, L: 450 },
];

export const hits = [
  ...Array.from({ length: 8 }, (_, k) => ({ f: 358 + 2 * k, level: "H3", kind: "deposit" })),
  { f: 392, level: "H1", kind: "closure" },
  { f: 406, level: "H2", kind: "stem" },
  { f: 420, level: "H2", kind: "twinkle" },
  { f: 434, level: "H2", kind: "period" },
];

// Aberración cromática del cierre (4ª del cupo de cada pieza): 1,0 / 0,5 / 0,2.
export function caAt(f) {
  return f === 392 ? 1.0 : f === 393 ? 0.5 : f === 394 ? 0.2 : 0;
}

export const EndCard = { start: 358, end: 450, draw, motion, phrases, hits, contract, caAt };
export default EndCard;
