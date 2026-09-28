// S2 "Tocás. Marcás. Seguís." (f84-146), Acento, hemiola (tratamiento final 3.3).
//
// Tres palabras apiladas golpean en hemiola (9,33 f contra el beat de 14). El
// punto de cada una se despega y se vuelve una casilla vacía; la palabra
// siguiente la marca. Aparece el "Guardar (3 seleccionados)" real del modal,
// entra la tarjeta del indicador, y las tres casillas tildadas se vuelven
// avatares que vuelan a la fila 2: 9 / 12 pasa a 12 / 12. Termina con una
// inhalación (f133-136) antes del barrido de swash, que es de S3: esta escena
// sigue dibujando su mundo completo hasta f146 como si nada la tapara.
//
// Capas: L0 campo #c2410c · L1 "Marcás" fantasma (z +900) · L2 grilla de 12
// columnas y renglones de base (z +300) · L4 UI (z 0) · L5 motas (z -400) ·
// frases en pantalla (fijas de R a L; la cámara del mundo no las toca).

import { EASE, SPR, spr, p as prog, punch } from "../../shared/system.js";
import { makePhrase, drawPhrase, golpe, corte, bumps, inhala } from "../../shared/phrase.js";
import { flight, arc } from "../../shared/punto.js";
import { camera, layer, card3d } from "../../engine/camera.js";
import { clamp, lerp, mix, hash1, noise1 } from "../../engine/math.js";
import { kf, cubicBezier } from "../../engine/ease.js";
import { drawText, glyphs } from "../../engine/text.js";
import { lightLeak } from "../../engine/fx.js";
import { emit, env } from "../../engine/env.js";
import { C } from "../../shared/brand.js";
import { drawCard, cardTexture, devScale, TEX, TARGETS as TARGETS_H, LAND, AV_D, AV_FILL, TINT } from "./s2-card.js";
import { IS_V } from "../../engine/format.js";

// Vertical: la tarjeta del indicador va ABAJO de las palabras, alineada a su
// columna (en horizontal va a la derecha). Todo el grupo de la tarjeta se corre
// este desplazamiento, y los avatares vuelan directo a su fila en el lugar
// nuevo, así el arco casilla → avatar → fila sigue siendo uno solo.
export const CARD_OFF = IS_V ? [-888, 506] : [0, 0];
const TARGETS = TARGETS_H.map(([x, y]) => [x + CARD_OFF[0], y + CARD_OFF[1]]);

const START = 84;
const END = 146;
// Desde acá las frases se dibujan dentro de draw() y no en drawTop: el barrido
// de swash (S3 recortado a la izquierda del borde) tiene que taparlas.
const TOP_END = 134;

const F = 1400; // focal del tratamiento (2.6)
const PAPER = C.surface; // #faf6ef
const PERIOD = C.accentSoft; // puntos sobre Acento: #fde9d3
const ACC = C.accent;

// ─── tiempos (hemiola: 84, 93,33, 102,67) ────────────────────────────────────
const H = [84, 84 + 28 / 3, 84 + 56 / 3];
// T4: vuelo de cada punto a su casilla (contrato C-P1-5: casillas vacías en
// f89, f99,3 y f108,5).
const FLY = [
  [85, 89],
  [H[1] + 1, H[1] + 6],
  [H[2] + 1, 108.5],
];
// Marcado: inundación de papel desde el centro y tilde por trim.
const FILL = [H[1], H[2], 108.5];
const FLOOD_DUR = [3, 3, 1.5];
const CHECK = [
  [H[1] + 2, H[1] + 6],
  [H[2] + 2, H[2] + 6],
  [109.5, 112],
];
// T5: casilla → avatar y vuelo a la fila 2.
const MORPH = [112, 116];
const LAUNCH = [112, 114.5, 117];
const FLIGHT_DUR = 9;
const INITIALS = ["AE", "JE", "CE"];
// Casillas: 84 x 84, radio 18, borde 6.
const BOX = [
  [860, 291],
  [860, 479],
  [860, 667],
];
const BOX_S = 84;
const BOX_R = 18;
const BOX_B = 6;
const AV_BIG = 76; // el avatar recién nacido de la casilla

// ─── frases ──────────────────────────────────────────────────────────────────
const WORDS = [
  ["Tocás.", 360],
  ["Marcás.", 548],
  ["Seguís.", 736],
].map(([text, baseline]) => makePhrase({ text, size: 190, wght: 760, tracking: -0.045, x: 120, baseline, color: PAPER, periodColor: PERIOD }));

// Toque de "Tocás." en H+1: se hunde a 0,97 durante 2 f y vuelve con snap,
// con pivote en el centro de la palabra.
const press = (T0, amt = 0.03) => (t, g, st, ph) => {
  if (t < T0) return;
  let k;
  if (t < T0 + 1) k = EASE.brake(t - T0);
  else if (t < T0 + 2) k = 1;
  else k = 1 - spr(t, T0 + 2, SPR.snap);
  const s = 1 - amt * k;
  const wd = ph.words[g.word];
  const gcx = g.ax + g.w / 2;
  st.dx = wd.cx + (gcx + st.dx - wd.cx) * s - gcx;
  st.dy *= s;
  st.scale *= s;
};

// El pulso no se corta durante la lectura: golpe de peso en cascada en el
// downbeat (f112) y en el beat 10 (f126). Inhalación f133-136: 760 → 700.
const beatBumps = (i) => bumps([112 + 1.5 * i, 126 + 1.5 * i], 60);
const PROG = [
  [golpe(H[0]), press(H[0] + 1), beatBumps(0), inhala(133, 136, 700)],
  [golpe(H[1]), beatBumps(1), inhala(133, 136, 700)],
  [corte(H[2]), beatBumps(2), inhala(133, 136, 700)],
];

// El punto de cada frase, mientras sigue pegado a ella, comparte la
// transformación de su palabra: se lo trata como un glifo más y se lee el
// estado que le dejan los presets.
function attachedDot(j, t) {
  const ph = WORDS[j];
  const P = ph.period;
  const g = { ch: ".", ax: P.cx - P.d / 2, w: P.d, i: ph.n, word: 0, wordLocal: ph.n, isPeriod: true };
  const st = { dx: 0, dy: 0, scale: 1, sx: 1, sy: 1, rot: 0, alpha: 1, weight: ph.wght, wAdd: 0, color: ph.color, clip: null, split: null };
  for (const fn of PROG[j]) fn(t, g, st, ph);
  const pivotY = ph.baseline - ph.cap / 2;
  const x = P.cx + st.dx + (st.split ? st.split.bottom : 0);
  const y = pivotY + st.dy + (P.cy - pivotY) * st.scale * st.sy;
  return { x, y, d: P.d * st.scale, alpha: st.alpha };
}

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Identidad salvo: punch 1 en f112 (+1,2 %), inhalación f133-136 (el mundo se
// comprime 1 % hacia el centro) y, mientras pasa el barrido, un arrastre de
// 40 px hacia la derecha: el cuerpo de tinta empuja lo que queda. Punch e
// inhalación son un dolly (cam.z), así cada plano se escala según su
// profundidad y el paralaje sale solo.
function camAt(t) {
  const k = punch(t, 112) * (1 - 0.01 * EASE.swell(clamp((t - 133) / 3)));
  const drag = 40 * EASE.accel(clamp((t - 137) / 9));
  return camera({ F, z: F * (1 - 1 / k), x: -drag });
}

// ─── L1: "Marcás" fantasma ───────────────────────────────────────────────────
const Z_GHOST = 900;
const S_GHOST = F / (F + Z_GHOST);
// Tamaño en pantalla 800 px; se diseña en pantalla y se lleva al mundo.
const toWorld = (sx, sy, s) => [960 + (sx - 960) / s, 540 + (sy - 540) / s];
// Asoma debajo y a la derecha de la tarjeta; antes de que ella llegue
// equilibra las palabras de la izquierda.
const [GX, GY] = toWorld(1000, 1040, S_GHOST);
const GHOST = makePhrase({ text: "Marcás", size: 800 / S_GHOST, wght: 760, tracking: -0.045, x: GX, baseline: GY, color: "#b83d0b" });
// Arranca fino (300) y se entinta con el golpe de "Marcás"; deriva a la
// izquierda 18 px/s como el fantasma de S1.
const GHOST_PROG = [
  (t, g, st) => {
    st.dx -= ((t - START) * 0.6) / S_GHOST;
    st.alpha *= clamp((t - 84) / 6);
    // Entintado en el lugar con el golpe de "Marcás" (0,8 f por glifo).
    const h = H[1] + 0.8 * g.i;
    if (t < h - 4) st.weight = 300;
    else if (t < h + 2) st.weight = lerp(300, 820, EASE.ink(clamp((t - h + 4) / 6)));
    else st.weight = lerp(820, 760, EASE.swell(clamp((t - h - 2) / 4)));
  },
  bumps([112, 126], 60),
];
function drawGhost(ctx, t) {
  drawPhrase(ctx, GHOST, t, GHOST_PROG);
}

// ─── L2: grilla de 12 columnas y renglones de base ──────────────────────────
const Z_GRID = 300;
const S_GRID = F / (F + Z_GRID);
const GRID_X = [];
for (let i = 0; i < 12; i++) GRID_X.push(120 + 142 * i, 120 + 142 * i + 118);
const GRID_COLOR = "rgba(124,45,18,0.30)";
function drawGrid(ctx, t) {
  const lw = 1 / S_GRID; // 1 px en pantalla
  ctx.save();
  ctx.fillStyle = GRID_COLOR;
  const [, y0] = toWorld(0, -20, S_GRID);
  const [, y1] = toWorld(0, 1100, S_GRID);
  // Las columnas se trazan de arriba abajo, 0,5 f de stagger de izquierda a
  // derecha (pen, 10 f), apenas llega el campo.
  GRID_X.forEach((sx, i) => {
    const k = prog(t, 85 + 0.5 * i, 95 + 0.5 * i, EASE.pen);
    if (k <= 0) return;
    const [wx] = toWorld(sx, 0, S_GRID);
    ctx.fillRect(wx - lw / 2, y0, lw, (y1 - y0) * k);
  });
  // Renglones de base de cada palabra: se trazan de izquierda a derecha 2 f
  // después de su golpe.
  const [x0] = toWorld(120, 0, S_GRID);
  const [x1] = toWorld(1800, 0, S_GRID);
  WORDS.forEach((ph, j) => {
    const k = prog(t, H[j] + 2, H[j] + 12, EASE.pen);
    if (k <= 0) return;
    const [, wy] = toWorld(0, ph.baseline, S_GRID);
    ctx.fillRect(x0, wy - lw / 2, (x1 - x0) * k, lw);
  });
  ctx.restore();
}

// ─── L5: motas fuera de foco ─────────────────────────────────────────────────
const Z_MOTES = -400;
const S_MOTES = F / (F + Z_MOTES);
const MOTES = Array.from({ length: 9 }, (_, i) => {
  const h = (k) => hash1(i * 13 + k * 101 + 7);
  const [x, y] = toWorld(80 + 1760 * h(1), 60 + 960 * h(2), S_MOTES);
  return { x, y, r: 7 + 15 * h(3), a: 0.07 + 0.09 * h(4), vy: 0.35 + 0.4 * h(5), seed: i * 31 + 5 };
});
function drawMotes(ctx, t) {
  const age = t - START;
  for (const m of MOTES) {
    const x = m.x + 14 * noise1(t * 0.03, m.seed);
    const y = m.y - m.vy * age + 8 * noise1(t * 0.025, m.seed + 50);
    const a = m.a * (0.75 + 0.25 * noise1(t * 0.05, m.seed + 99)) * clamp((t - 84) / 6);
    if (a <= 0.002) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, m.r);
    g.addColorStop(0, `rgba(253,233,211,${a})`);
    g.addColorStop(0.55, `rgba(253,233,211,${a * 0.55})`);
    g.addColorStop(1, "rgba(253,233,211,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── casillas y avatares ─────────────────────────────────────────────────────
// Recorrido de cada punto: de su lugar en la frase a la casilla, con un arco
// leve hacia arriba.
const PATHS = WORDS.map((ph, j) => {
  const P0 = [ph.period.cx, ph.period.cy];
  const P3 = BOX[j];
  const dx = P3[0] - P0[0];
  return { P0, P1: [P0[0] + dx * 0.35, P0[1] - 34], P2: [P3[0] - dx * 0.25, P3[1] - 30], P3 };
});

// Tilde en coordenadas de la casilla (centro 0,0), escalado para 84 px.
const CHECK_PTS = [
  [-21, 1],
  [-7.5, 14.5],
  [21, -14],
];
const CHECK_SEG = [Math.hypot(13.5, 13.5), Math.hypot(28.5, 28.5)];
const CHECK_LEN = CHECK_SEG[0] + CHECK_SEG[1];
// Traza el tilde hasta k (0..1) y devuelve la punta.
function checkPath(ctx, k) {
  const L = CHECK_LEN * clamp(k);
  ctx.beginPath();
  ctx.moveTo(CHECK_PTS[0][0], CHECK_PTS[0][1]);
  let tip;
  if (L <= CHECK_SEG[0]) {
    const f = L / CHECK_SEG[0];
    tip = [lerp(CHECK_PTS[0][0], CHECK_PTS[1][0], f), lerp(CHECK_PTS[0][1], CHECK_PTS[1][1], f)];
  } else {
    ctx.lineTo(CHECK_PTS[1][0], CHECK_PTS[1][1]);
    const f = (L - CHECK_SEG[0]) / CHECK_SEG[1];
    tip = [lerp(CHECK_PTS[1][0], CHECK_PTS[2][0], f), lerp(CHECK_PTS[1][1], CHECK_PTS[2][1], f)];
  }
  ctx.lineTo(tip[0], tip[1]);
  return tip;
}

// Estado de la casilla j en t (null si todavía es el punto de la frase).
function boxState(j, t) {
  const [t0, t1] = FLY[j];
  if (t < t0) return null;
  const d0 = WORDS[j].period.d;
  const st = {
    x: 0, y: 0, S: BOX_S, r: BOX_R, b: BOX_B,
    stroke: PAPER, flood: 0, check: 0, checkW: 9, checkA: 1,
    body: null, ink: 0, initialsA: 0, scale: 1, sx: 1, sy: 1, pivotY: 0, lift: 0, ringA: 0, landed: false,
  };
  // T4: el punto vuela (brake) y se abre en casilla (swell): vuela como punto
  // y se abre mientras frena.
  const u = clamp((t - t0) / (t1 - t0));
  const fl = flight(t, { t0, t1, ...PATHS[j], ease: EASE.brake });
  st.x = fl.x;
  st.y = fl.y;
  const mk = EASE.swell(u);
  st.S = lerp(d0, BOX_S, mk);
  st.r = lerp(d0 / 2, BOX_R, mk);
  st.b = lerp(d0 / 2, BOX_B, mk);
  st.stroke = mix(PERIOD, PAPER, mk);

  // Marcado: se hunde (toque), se inunda de papel, se escribe el tilde.
  const Fj = FILL[j];
  if (t >= Fj) {
    st.flood = EASE.brake(clamp((t - Fj) / FLOOD_DUR[j]));
    const press = t < Fj + 1.5 ? EASE.brake((t - Fj) / 1.5) : 1 - spr(t, Fj + 1.5, SPR.snap);
    st.scale *= 1 - 0.1 * press;
    const [c0, c1] = CHECK[j];
    const ck = clamp((t - c0) / (c1 - c0));
    st.check = EASE.pen(ck);
    st.checkW = 9 + 2 * Math.sin(Math.PI * ck);
  }

  // T5: casilla → avatar (84 redondeada → círculo 76). El #7c2d12 entra como
  // tinta desde el centro y se traga el tilde (mezclar papel con granate en
  // el lugar pasa por un malva lavado). Cascada de 0,75 f entre casillas.
  const M0 = MORPH[0] + 0.75 * j;
  if (t >= M0) {
    const m = EASE.glide(clamp((t - M0) / (MORPH[1] - MORPH[0])));
    st.S = lerp(BOX_S, AV_BIG, m);
    st.r = lerp(BOX_R, AV_BIG / 2, m);
    st.body = PAPER;
    st.ink = EASE.brake(clamp((t - M0) / 3));
    st.checkA = 1 - clamp((t - M0 - 1.5) / 1.5);
    st.initialsA = clamp((t - M0 - 1.5) / 2);
  }

  // Agachada de 2 f antes de salir, vuelo en arco (lunge, 9 f) con bulto de
  // profundidad (1 → 1,25 → 0,526) y aterrizaje con micro aplastamiento.
  const L = LAUNCH[j];
  if (t >= L - 2) {
    let crouch;
    if (t < L) crouch = 1 - 0.1 * EASE.swell((t - (L - 2)) / 2);
    else crouch = lerp(0.9, 1, EASE.brake(clamp((t - L) / 2)));
    st.scale *= crouch;
    if (t < L) st.y += 5 * EASE.swell((t - (L - 2)) / 2);
  }
  if (t >= L) {
    const a = arc(t, { t0: L, t1: L + FLIGHT_DUR, from: BOX[j], to: TARGETS[j], lift: 220, ease: EASE.lunge });
    st.x = a.x;
    st.y = a.y;
    const pk = a.u;
    const bulge = Math.sin(Math.PI * pk);
    st.scale *= lerp(1, (AV_D / AV_BIG), pk) + 0.487 * bulge;
    st.lift = bulge;
    const Cj = L + FLIGHT_DUR;
    if (t >= Cj) {
      st.landed = true;
      st.lift = 0;
      let kq;
      if (t < Cj + 2) kq = (t - Cj) / 2;
      else kq = 1 - spr(t, Cj + 2, SPR.snap);
      st.sx = lerp(1, 1.14, kq);
      st.sy = lerp(1, 0.86, kq);
      st.pivotY = AV_BIG / 2;
    }
    st.ringA = clamp((t - (Cj - 1)) / 2);
  }
  return st;
}

function drawBox(ctx, st, j) {
  const ds = devScale(ctx);
  ctx.save();
  ctx.translate(st.x, st.y);
  // Aplastamiento con pivote en la base; escala general con pivote al centro.
  ctx.translate(0, st.pivotY * st.scale);
  ctx.scale(st.sx, st.sy);
  ctx.translate(0, -st.pivotY * st.scale);
  ctx.scale(st.scale, st.scale);
  const { S, r } = st;
  const x = -S / 2;
  const y = -S / 2;
  // Aro del color de la fila al aterrizar (separa el avatar de la pila).
  if (st.ringA > 0) {
    ctx.save();
    ctx.globalAlpha *= st.ringA;
    ctx.beginPath();
    ctx.arc(0, 0, S / 2 + 2.5 / Math.max(0.3, st.scale), 0, Math.PI * 2);
    ctx.fillStyle = TINT;
    ctx.fill();
    ctx.restore();
  }
  if (st.body) {
    // Ya es un sólido (papel inundado) que vira a avatar.
    ctx.save();
    if (st.lift > 0) {
      ctx.shadowColor = `rgba(124,45,18,${0.4 * st.lift})`;
      ctx.shadowBlur = (8 + 26 * st.lift) * ds * st.scale;
      ctx.shadowOffsetY = (4 + 22 * st.lift) * ds * st.scale;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, S, S, Math.min(r, S / 2));
    ctx.fillStyle = st.ink >= 1 ? AV_FILL : st.body;
    ctx.fill();
    ctx.restore();
  } else {
    // Contorno (el punto que se abrió): exterior menos el hueco.
    const hole = Math.max(0, S - 2 * st.b);
    ctx.beginPath();
    ctx.roundRect(x, y, S, S, Math.min(r, S / 2));
    if (hole > 0.5) {
      const hr = Math.max(0, r - st.b);
      ctx.roundRect(-hole / 2, -hole / 2, hole, hole, Math.min(hr, hole / 2));
    }
    ctx.fillStyle = st.stroke;
    ctx.fill("evenodd");
    // Inundación de papel desde el centro.
    if (st.flood > 0 && hole > 0.5) {
      const fs = hole * st.flood + 0.5;
      ctx.beginPath();
      ctx.roundRect(-fs / 2, -fs / 2, fs, fs, Math.max(0, Math.min(r - st.b, fs / 2)));
      ctx.fillStyle = PAPER;
      ctx.fill();
    }
  }
  // Tilde de acento, 9 px con puntas redondas, que se escribe (pen).
  if (st.check > 0 && st.checkA > 0.002) {
    ctx.save();
    ctx.globalAlpha *= st.checkA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = st.checkW;
    ctx.strokeStyle = ACC;
    const k = S / BOX_S;
    ctx.scale(k, k);
    const tip = checkPath(ctx, st.check);
    ctx.stroke();
    // Punta de la lapicera (capa emisiva) mientras el tilde se escribe.
    if (st.check < 1) {
      const a = 0.9 * Math.sin(Math.PI * clamp(st.check));
      emit(ctx, (e) => {
        e.fillStyle = `rgba(251,146,60,${a})`;
        e.beginPath();
        e.arc(tip[0], tip[1], 9, 0, Math.PI * 2);
        e.fill();
      });
    }
    ctx.restore();
  }
  // Destello del marcado: la casilla brilla 5 f al inundarse de papel.
  if (st.flood > 0 && st.flood < 1 && !st.body) {
    const a = 0.7 * (1 - st.flood);
    emit(ctx, (e) => {
      e.fillStyle = `rgba(251,146,60,${a})`;
      e.beginPath();
      e.roundRect(-S / 2, -S / 2, S, S, r);
      e.fill();
    });
  }
  // Tinta granate desde el centro, recortada a la forma.
  if (st.ink > 0 && st.ink < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, S, S, Math.min(r, S / 2));
    ctx.clip();
    ctx.beginPath();
    ctx.arc(0, 0, S * 0.72 * st.ink, 0, Math.PI * 2);
    ctx.fillStyle = AV_FILL;
    ctx.fill();
    ctx.restore();
  }
  if (st.initialsA > 0.002) {
    ctx.save();
    ctx.globalAlpha *= st.initialsA;
    const style = { size: 30, weight: 800, tracking: 0 };
    const cap = glyphs(ctx, INITIALS[j], style).cap;
    drawText(ctx, INITIALS[j], 0, cap / 2, style, { align: "center", color: PAPER });
    ctx.restore();
  }
  ctx.restore();
}

// Anillo rectangular que sale de la casilla al marcarla (el "toque").
function boxRing(ctx, t, j) {
  const T0 = FILL[j];
  if (t < T0 || t > T0 + 10) return;
  const k = EASE.glide(clamp((t - T0) / 10));
  const S = lerp(BOX_S, BOX_S * 2.3, k);
  const r = lerp(BOX_R, BOX_R * 2.6, k);
  ctx.save();
  ctx.globalAlpha *= lerp(0.8, 0, k);
  ctx.lineWidth = lerp(4, 0.5, k);
  ctx.strokeStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(BOX[j][0] - S / 2, BOX[j][1] - S / 2, S, S, r);
  ctx.stroke();
  ctx.restore();
}

// Anillo fino de acento en cada aterrizaje de avatar.
function landRing(ctx, t, j) {
  const T0 = LAND[j];
  if (t < T0 || t > T0 + 9) return;
  const k = EASE.glide(clamp((t - T0) / 9));
  ctx.save();
  ctx.globalAlpha *= lerp(0.55, 0, k);
  ctx.lineWidth = lerp(3, 0.5, k);
  ctx.strokeStyle = ACC;
  ctx.beginPath();
  ctx.arc(TARGETS[j][0], TARGETS[j][1], lerp(AV_D / 2, AV_D * 1.6, k), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ─── "Guardar (3 seleccionados)" ─────────────────────────────────────────────
// El botón real del modal, como pastilla de papel: pop (K3) en f108,5, toque
// en f111 y se evapora hacia la izquierda en f112-115.
const GUARDAR = { x: 120, y: 776, w: 381, h: 56, r: 14 };
function drawGuardar(ctx, t) {
  const T0 = 108.5;
  if (t < T0) return;
  const pop = spr(t, T0, SPR.snap);
  let alpha = clamp((t - T0) / 2);
  const rot = (-8 * Math.PI) / 180 * (1 - pop);
  // Toque.
  let pk = 0;
  if (t >= 111) pk = t < 112 ? EASE.brake(t - 111) : 1;
  const ps = 1 - 0.06 * pk;
  // Evaporación: escala X hacia el borde izquierdo y desvanecido.
  const ev = EASE.accel(clamp((t - 112) / 3));
  if (ev >= 1) return;
  alpha *= 1 - ev;
  const { x, y, w, h, r } = GUARDAR;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // Evaporación con pivote en el borde izquierdo.
  ctx.translate(x, cy);
  ctx.scale(1 - ev, 1 - 0.25 * ev);
  ctx.translate(-x, -cy);
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(pop * ps, pop * ps);
  ctx.translate(-cx, -cy);
  const ds = devScale(ctx);
  ctx.save();
  ctx.shadowColor = "rgba(124,45,18,0.32)";
  ctx.shadowBlur = 24 * ds;
  ctx.shadowOffsetY = 10 * ds * (1 - pk);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();
  const style = { size: 26, weight: 700, tracking: 0 };
  const cap = glyphs(ctx, "G", style).cap;
  drawText(ctx, "Guardar (3 seleccionados)", cx, cy + cap / 2, style, { align: "center", color: ACC });
  ctx.restore();
  // Anillo del toque.
  if (t >= 111 && t < 120) {
    const k = EASE.glide(clamp((t - 111) / 9));
    ctx.save();
    ctx.globalAlpha *= lerp(0.6, 0, k);
    ctx.lineWidth = lerp(3.5, 0.5, k);
    ctx.strokeStyle = PAPER;
    const gw = lerp(w, w + 90, k);
    const gh = lerp(h, h + 90, k);
    ctx.beginPath();
    ctx.roundRect(cx - gw / 2, cy - gh / 2, gw, gh, lerp(r, 58, k));
    ctx.stroke();
    ctx.restore();
  }
}

// ─── tarjeta ─────────────────────────────────────────────────────────────────
// Entra desde la derecha (x +880 → 0) frenando, llega a f112 todavía con
// velocidad (contacto en la grilla), se pasa 1 % y asienta en f116,5. Mientras
// entra gira en Y (el borde que va adelante, más lejos) y se aplana al llegar.
// brake que llega a f112 a ~6 px/f (no a 0) y el tramo del overshoot sale a
// la misma velocidad: sin quiebre en el contacto.
const CARD_IN = cubicBezier(0.2, 0, 0.08, 0.95);
const CARD_OVER = cubicBezier(0.3, 0.41, 0.45, 1);
const cardDX = (t) =>
  kf(t, [
    [104, 880],
    [112, 0, CARD_IN],
    [114, -8.8, CARD_OVER],
    [116.5, 0, EASE.swell],
  ]);
const cardRY = (t) =>
  kf(t, [
    [104, 0.42],
    [112, 0, CARD_IN],
    [114, -0.006, CARD_OVER],
    [116.5, 0, EASE.swell],
  ]);

function drawCardWorld(ctx, t, cam) {
  if (t < 104) return;
  if (t < 116.5) {
    const img = cardTexture(Math.min(1, env.scale || 1));
    card3d(ctx, cam, img, { x: TEX.x0 + TEX.w / 2 + cardDX(t) + CARD_OFF[0], y: TEX.y0 + TEX.h / 2 + CARD_OFF[1], z: 0, w: TEX.w, h: TEX.h, ry: cardRY(t), n: 8, shade: 0 });
    return;
  }
  layer(ctx, cam, 0, (c) => {
    c.translate(CARD_OFF[0], CARD_OFF[1]);
    drawCard(c, t);
  });
}

// ─── frases (capa de pantalla) ───────────────────────────────────────────────
function drawWords(ctx, t) {
  WORDS.forEach((ph, j) => {
    drawPhrase(ctx, ph, t, PROG[j]);
    // El punto, mientras sigue siendo de la frase.
    if (t < FLY[j][0]) {
      const d = attachedDot(j, t);
      if (d.alpha > 0.002) {
        ctx.save();
        ctx.globalAlpha *= d.alpha;
        ctx.fillStyle = PERIOD;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.d / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  });
  // Anillo de toque de "Tocás." desde el centro de la palabra (H+1, 10 f).
  const T0 = H[0] + 1;
  if (t >= T0 && t < T0 + 10) {
    const ph = WORDS[0];
    const u = clamp((t - T0) / 10);
    const k = EASE.glide(u);
    ctx.save();
    // Opacidad y trazo caen lineales en el tiempo: con glide el anillo se
    // afinaba mientras crecía ~50 px/f y el obturador lo promediaba a nada.
    ctx.globalAlpha *= lerp(0.5, 0, u);
    ctx.lineWidth = lerp(8, 1, u);
    ctx.strokeStyle = PAPER;
    ctx.beginPath();
    ctx.arc(ph.words[0].cx, ph.baseline - ph.cap / 2, lerp(0, 210, k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ─── escena ──────────────────────────────────────────────────────────────────
function draw(ctx, t) {
  // L0: campo plano de acento (la cámara no lo toca).
  ctx.fillStyle = ACC;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  // Leak ámbar del preset Acento (~6 %), arriba a la derecha.
  lightLeak(ctx, t, { intensity: 0.11, x: 0.9, y: 0.08, seed: 2 });

  const cam = camAt(t);
  layer(ctx, cam, Z_GHOST, (c) => drawGhost(c, t));
  layer(ctx, cam, Z_GRID, (c) => drawGrid(c, t));

  // L4: UI.
  drawCardWorld(ctx, t, cam);
  layer(ctx, cam, 0, (c) => {
    drawGuardar(c, t);
    for (let j = 0; j < 3; j++) boxRing(c, t, j);
    for (let j = 0; j < 3; j++) landRing(c, t, j);
    // Pila como en la app (el primero arriba): los que todavía vuelan pasan
    // por debajo de los que ya aterrizaron y se meten detrás al tocar.
    const S = [0, 1, 2].map((j) => boxState(j, t));
    for (const j of [0, 1, 2]) if (S[j] && !S[j].landed) drawBox(c, S[j], j);
    for (const j of [2, 1, 0]) if (S[j] && S[j].landed) drawBox(c, S[j], j);
  });

  // L5: motas.
  layer(ctx, cam, Z_MOTES, (c) => drawMotes(c, t));

  // Desde f134 las frases van en el mundo de la escena (el barrido las tapa).
  if (t >= TOP_END) drawWords(ctx, t);
}

function drawTop(ctx, t) {
  if (t < TOP_END) drawWords(ctx, t);
}

// Motion blur: 270° en todo lo que vuela (palabras, puntos, tarjeta,
// avatares), 180° en la lectura quieta, 360° durante el barrido.
function motion(t) {
  if (t >= 134) return { shutter: 1, samples: 16 };
  if (t < 127) return { shutter: 0.75, samples: 12 };
  return { shutter: 0.5, samples: 8 };
}

const scene = {
  id: "s2",
  start: START,
  end: END,
  topEnd: TOP_END,
  draw,
  drawTop,
  motion,
  field: () => ({ acento: 1 }),
  // R: el del tratamiento (Corte + 3 f; medido, las mitades quedan a menos de
  // 1 px desde f101,4). L: medido contra swashX de S3, el talón toca la "S" de
  // "Seguís" en f138,46.
  phrases: [{ id: "Tocás. Marcás. Seguís.", words: 3, R: 105.67, L: 138.46 }],
  hits: [
    { f: 84, level: "H2", kind: "Tocás. (K1) + toque" },
    { f: H[1], level: "H3", kind: "hemiola: Marcás. (K1), casilla 1" },
    { f: H[2], level: "H3", kind: "hemiola: Seguís. (Corte), casilla 2" },
    { f: 108.5, level: "H3", kind: "casilla 3, Guardar (3 seleccionados)" },
    { f: 112, level: "H1", kind: "tarjeta aterriza, casillas a avatares, punch 1" },
    { f: 121, level: "H3", kind: "avatar AE aterriza, fila 2 se inunda" },
    { f: 123.5, level: "H3", kind: "avatar JE aterriza" },
    { f: 126, level: "H2", kind: "avatar CE aterriza, 12 / 12" },
    { f: 133, level: "H3", kind: "inhalación" },
  ],
};


export default scene;
