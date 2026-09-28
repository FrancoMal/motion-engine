// S5: la columna del chat (tratamiento final 3.6) y T12 "Puntos a tarjetas".
//
//   f262        la burbuja de la docente llega de S4 (C-P1-15) y queda quieta
//   f258        avatar del asistente (K3) y "Pensando…" (tres puntos que saltan)
//   f262        chip "Generar planificaciones" (K3 desde el lado del avatar)
//   f266        tap: se hunde a 0,94 y una onda #fde9d3 lo inunda
//   f267-270    el rótulo se evapora y el chip se corta en tres tramos que se
//               cierran en tres puntos de acento (brake): la píldora se vuelve
//               puntos, el gesto inverso del trazo
//   f268+2,5k   cada punto se agacha, sale en arco (lunge, 7 f), se estira en la
//               dirección del vuelo, crece hacia cámara a mitad de camino y vira
//               en OKLab al color de su tile; aterriza en f275 / 277,5 / 280
//   f268-280    mientras tanto los puntos de "Pensando…" vuelven a saltar: está
//               generando
//   f286-292    burbuja, avatar y puntos caen (y +20, accel)

import { EASE, SPR, spr, p as prog } from "../../shared/system.js";
import { icon, rr } from "../../shared/ui.js";
import { drawText, kinetic, textWidth } from "../../engine/text.js";
import { createCanvas } from "@napi-rs/canvas";
import { clamp, lerp, deg, mix, rgba } from "../../engine/math.js";
import { flight, lerpRect, dotRect, col } from "../../shared/punto.js";
import { COL, T, BUBBLE, BUBBLE_TEXT, AVATAR, THINK, CHIP, SPLIT, CARDS, INPUT, tileCenter, dotForCard } from "./s5-layout.js";

// ─── salida común (286-292) ──────────────────────────────────────────────────
function dropOut(t, i) {
  const s = T.dropOut + 0.7 * i;
  const k = EASE.accel(clamp((t - s) / (T.chatEnd - s)));
  return { dy: 20 * k, alpha: 1 - k };
}

// ─── burbuja ─────────────────────────────────────────────────────────────────
const TEXT_ST = { size: 34, weight: 500, tracking: 0 };
const TEXT_W = textWidth(createCanvas(8, 8).getContext("2d"), BUBBLE_TEXT, TEXT_ST);

function bubble(ctx, t) {
  if (t < T.bubble) return; // hasta f262 la dibuja S4 en pantalla
  const d = dropOut(t, 0);
  if (d.alpha <= 0.001) return;
  const B = BUBBLE;
  ctx.save();
  ctx.globalAlpha *= d.alpha;
  ctx.translate(0, d.dy);
  // S4 entrega la burbuja sin sombra (la apaga 256-261,5); acá se enciende una
  // sombra de acento de 8 f cuando la burbuja pasa a ser del mundo.
  const sh = prog(t, T.bubble, T.bubble + 8, EASE.swell);
  if (sh > 0) {
    ctx.save();
    ctx.shadowColor = rgba(COL.accent, 0.3 * sh);
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 14;
    ctx.beginPath();
    ctx.roundRect(B.x + 10, B.y + 8, B.w - 20, B.h - 12, B.r);
    ctx.fillStyle = COL.accent;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.roundRect(B.x, B.y, B.w, B.h, B.r);
  ctx.fillStyle = COL.accent;
  ctx.fill();
  // Mismo fundido y cierre de tracking que S4 (259-263, centrado): en f262 S4
  // lo entrega con alfa 0,75 y acá termina.
  const k = clamp((t - 259) / 4);
  const st = { ...TEXT_ST, tracking: Math.round(0.08 * (1 - EASE.ink(k)) * 1000) / 1000 };
  const tw = st.tracking === 0 ? TEXT_W : textWidth(ctx, BUBBLE_TEXT, st);
  ctx.save();
  ctx.globalAlpha *= k;
  drawText(ctx, BUBBLE_TEXT, B.x + B.w / 2 - tw / 2, B.y + B.h / 2 + 12.5, st, { color: "#ffffff" });
  ctx.restore();
  ctx.restore();
}

// ─── avatar del asistente ────────────────────────────────────────────────────
function assistant(ctx, t) {
  if (t < T.avatar) return;
  const d = dropOut(t, 1);
  if (d.alpha <= 0.001) return;
  const s = spr(t, T.avatar, SPR.snap);
  const a = clamp((t - T.avatar) / 2) * d.alpha;
  const { cx, cy } = AVATAR;
  const r = AVATAR.d / 2;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy + d.dy);
  ctx.rotate(deg(-8) * (1 - s));
  ctx.scale(s, s);
  ctx.save();
  ctx.shadowColor = "rgba(124,45,18,0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = COL.card;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.75, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COL.border;
  ctx.stroke();
  icon(ctx, "sparkles", 0, 0, 32, { color: COL.accent, width: 2.2, progress: prog(t, T.avatar + 1, T.avatar + 6, EASE.pen) });
  ctx.restore();
}

// ─── "Pensando…" ─────────────────────────────────────────────────────────────
// y = -14·max(0, sin(2π(t - t_i)/7)), t_i = t0 + 2,33·i. Dos ventanas: piensa
// la respuesta (258-266) y genera las planificaciones (268-280). Un salto que
// arrancó adentro de la ventana termina entero.
const THINK_WINDOWS = [
  [T.avatar, T.chipTap],
  [T.launch[0], T.handoff + 0.5],
];
function thinkLift(t, i) {
  let v = 0;
  for (const [w0, w1] of THINK_WINDOWS) {
    const ti = w0 + 2.33 * i;
    for (let s = ti; s < w1; s += 7) {
      if (t >= s && t < s + 3.5) v = Math.max(v, Math.sin((Math.PI * (t - s)) / 3.5));
    }
  }
  return v;
}

function thinking(ctx, t) {
  if (t < T.avatar) return;
  for (let i = 0; i < 3; i++) {
    const d = dropOut(t, 2 + 0.4 * i);
    const a = clamp((t - T.avatar - 0.6 * i) / 2) * d.alpha;
    if (a <= 0.001) continue;
    const lift = thinkLift(t, i);
    const x = THINK.xs[i];
    const y = THINK.y - 14 * lift + d.dy;
    // Sube, se estira un poco y se enciende hacia el acento.
    const sy = 1 + 0.12 * lift;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(1 / Math.sqrt(sy), sy);
    ctx.beginPath();
    ctx.arc(0, 0, THINK.d / 2, 0, Math.PI * 2);
    ctx.fillStyle = mix("#c4b3a0", COL.accent, 0.85 * lift);
    ctx.fill();
    ctx.restore();
  }
}

// ─── chip y su corte en tres puntos ──────────────────────────────────────────
const CHIP_C = [CHIP.x + CHIP.w / 2, CHIP.y + CHIP.h / 2]; // (403, 680)
const CHIP_L = [CHIP.x, CHIP_C[1]]; // pivote del pop: el lado del avatar
const TAP = [CHIP.x + 232, CHIP.y + CHIP.h / 2]; // donde toca el dedo

// K3 al doble de velocidad: el chip tiene 4 f entre el pop (262) y el tap
// (266), así que el overshoot (pico 1,115) tiene que haberse ido antes del tap.
const chipPop = (t) => (t <= T.chipPop ? 0 : spr(T.chipPop + (t - T.chipPop) * 2.2, T.chipPop, SPR.snap));

// Hundido del tap: 1 → 0,94 en 1,5 f y vuelta con snap (pivote en el centro).
function pressScale(t) {
  if (t < T.chipTap) return 1;
  if (t < T.chipTap + 1.5) return lerp(1, 0.94, EASE.brake((t - T.chipTap) / 1.5));
  return lerp(0.94, 1, spr(t, T.chipTap + 1.5, SPR.snap));
}

// Pop (pivote izquierdo) y después hundido (pivote central), como transformación
// del ctx o aplicada a un rect.
function chipXform(ctx, t) {
  const s = chipPop(t);
  ctx.translate(CHIP_L[0], CHIP_L[1]);
  ctx.scale(s, s);
  ctx.translate(-CHIP_L[0], -CHIP_L[1]);
  const ps = pressScale(t);
  ctx.translate(CHIP_C[0], CHIP_C[1]);
  ctx.scale(ps, ps);
  ctx.translate(-CHIP_C[0], -CHIP_C[1]);
}
function chipMapRect(R, t) {
  const map = (x, y) => {
    const s = chipPop(t);
    let X = CHIP_L[0] + (x - CHIP_L[0]) * s;
    let Y = CHIP_L[1] + (y - CHIP_L[1]) * s;
    const ps = pressScale(t);
    X = CHIP_C[0] + (X - CHIP_C[0]) * ps;
    Y = CHIP_C[1] + (Y - CHIP_C[1]) * ps;
    return [X, Y];
  };
  const [x0, y0] = map(R.x, R.y);
  const [x1, y1] = map(R.x + R.w, R.y + R.h);
  const k = (x1 - x0) / R.w;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, r: R.r.map((v) => v * k) };
}

// Tramo j del chip (0 izquierda, 2 derecha) en t: rect redondeado que se cierra
// en el punto j. Se interpola desde el tramo hundido hasta el punto absoluto,
// así en k = 1 el punto está exacto aunque el hundido no haya vuelto.
function segRect(j, t) {
  const w3 = CHIP.w / 3;
  const R0 = {
    x: CHIP.x + j * w3 - (j > 0 ? 0.6 : 0),
    y: CHIP.y,
    w: w3 + (j > 0 && j < 2 ? 1.2 : 0.6),
    h: CHIP.h,
    r: [j === 0 ? 32 : 0, j === 2 ? 32 : 0, j === 2 ? 32 : 0, j === 0 ? 32 : 0],
  };
  // Los tres tramos se cierran juntos: la píldora entera se contrae en tres
  // puntos (el de la derecha ya sale volando mientras termina de cerrarse).
  const k = EASE.brake(clamp((t - T.collapse) / 2.2));
  return lerpRect(chipMapRect(R0, t), dotRect(SPLIT.xs[j], SPLIT.y, SPLIT.d), k);
}

// ¿El punto de la tarjeta k ya es de la capa de vuelos? Desde la anticipación
// (1,5 f antes de salir) si ya terminó de cerrarse, y siempre desde que sale.
function inFlight(k, t) {
  if (t >= T.launch[k]) return true;
  if (t < T.launch[k] - 1.5) return false;
  return segRect(dotForCard(k), t).w <= SPLIT.d + 0.5;
}

function chip(ctx, t) {
  if (t < T.chipPop) return;
  const a = clamp((t - T.chipPop) / 1.5);
  ctx.save();
  ctx.globalAlpha *= a;

  if (t < T.collapse) {
    ctx.save();
    chipXform(ctx, t);
    // Sombra suave de botón.
    ctx.save();
    ctx.shadowColor = "rgba(124,45,18,0.14)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    rr(ctx, CHIP.x, CHIP.y, CHIP.w, CHIP.h, CHIP.h / 2);
    ctx.fillStyle = COL.card;
    ctx.fill();
    ctx.restore();
    // Onda del tap.
    if (t >= T.chipTap) {
      ctx.save();
      rr(ctx, CHIP.x, CHIP.y, CHIP.w, CHIP.h, CHIP.h / 2);
      ctx.clip();
      const rk = EASE.glide(clamp((t - T.chipTap) / 6));
      ctx.beginPath();
      ctx.arc(TAP[0], TAP[1], 20 + 280 * rk, 0, Math.PI * 2);
      ctx.fillStyle = COL.accentSoft;
      ctx.fill();
      ctx.restore();
    }
    rr(ctx, CHIP.x + 1, CHIP.y + 1, CHIP.w - 2, CHIP.h - 2, CHIP.h / 2 - 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = COL.accent;
    ctx.stroke();
    ctx.restore();
  } else {
    // Tramos que se cierran en puntos; el relleno vira al acento.
    const fk = EASE.brake(clamp((t - T.collapse) / 2));
    ctx.beginPath();
    let any = false;
    for (let j = 0; j < 3; j++) {
      const k = 2 - j; // tarjeta de este punto
      if (inFlight(k, t)) continue; // lo dibuja drawFlights
      const R = segRect(j, t);
      ctx.roundRect(R.x, R.y, R.w, R.h, R.r.map((v) => Math.max(0, Math.min(v, R.w / 2, R.h / 2))));
      any = true;
    }
    if (any) {
      ctx.fillStyle = col(COL.accentSoft, COL.accent, fk);
      ctx.fill();
    }
    // El contorno del chip se apaga en 1 f.
    const oa = 1 - clamp((t - T.collapse) / 1);
    if (oa > 0) {
      ctx.save();
      ctx.globalAlpha *= oa;
      chipXform(ctx, t);
      rr(ctx, CHIP.x + 1, CHIP.y + 1, CHIP.w - 2, CHIP.h - 2, CHIP.h / 2 - 1);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.accent;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Ícono y rótulo: se trazan al entrar y se evaporan en el tap.
  if (t < T.collapse + 0.5) {
    ctx.save();
    chipXform(ctx, t);
    const ev = (s, dur = 0.8) => EASE.accel(clamp((t - s) / dur));
    const ik = ev(T.chipTap + 0.2);
    icon(ctx, "sparkles", CHIP.x + 37, CHIP_C[1], 26, {
      color: COL.accent,
      width: 2.4,
      progress: prog(t, T.chipPop + 0.5, T.chipPop + 4.5, EASE.pen),
      alpha: 1 - ik,
    });
    const style = { size: 28, weight: 700, tracking: 0 };
    kinetic(
      ctx,
      CHIP.label,
      CHIP.x + 60,
      CHIP_C[1] + 10.5,
      style,
      (i) => {
        const k = ev(T.chipTap + 0.2 + i * 0.02);
        return { alpha: 1 - k, dx: 18 * k, dy: -6 * k, weight: lerp(700, 300, k) };
      },
      { color: COL.accent },
    );
    ctx.restore();
  }
  ctx.restore();
}

// ─── T12: vuelos ─────────────────────────────────────────────────────────────

// Abanico que pasa por debajo de la burbuja (y > 540 mientras x < 1190): un
// punto que cruzara la burbuja de acento a mitad del viraje desaparecería
// contra ella. El primero sube al final para entrar en el tile de arriba.
const PATHS = [
  { P1: [760, 612], P2: [1176, 606] },
  { P1: [720, 590], P2: [1120, 612] },
  { P1: [680, 624], P2: [1080, 764] },
];
function path(k) {
  const j = dotForCard(k);
  return { j, P0: [SPLIT.xs[j], SPLIT.y], P1: PATHS[k].P1, P2: PATHS[k].P2, P3: tileCenter(k) };
}

// Posición del punto k en t (incluye el resto del cierre del chip, que se
// desvanece a medida que avanza el vuelo).
function flyPos(k, t) {
  const P = path(k);
  const f = flight(t, { t0: T.launch[k], t1: T.land[k], P0: P.P0, P1: P.P1, P2: P.P2, P3: P.P3, ease: EASE.lunge });
  const R = segRect(P.j, t);
  const rc = [R.x + R.w / 2, R.y + R.h / 2];
  const res = 1 - f.k;
  return { x: f.x + (rc[0] - P.P0[0]) * res, y: f.y + (rc[1] - P.P0[1]) * res, k: f.k, R };
}

export function drawFlights(ctx, t) {
  for (let k = 0; k < 3; k++) {
    const L0 = T.launch[k];
    const L1 = T.land[k];
    if (t < L0 - 1.5 || t >= L1) continue;
    const P = path(k);
    if (t < L0) {
      // Anticipación: el punto ya cerrado se agacha antes de saltar. El
      // primero todavía se está cerrando (lo dibuja el chip).
      if (!inFlight(k, t)) continue;
      const q = EASE.swell(clamp((t - (L0 - 1.5)) / 1.5));
      drawBlob(ctx, SPLIT.xs[P.j], SPLIT.y + 2.5 * q, SPLIT.d, SPLIT.d, 1 + 0.16 * q, 1 - 0.2 * q, 0, COL.accent);
      continue;
    }
    const p = flyPos(k, t);
    const pb = flyPos(k, t - 0.25);
    const vx = (p.x - pb.x) / 0.25;
    const vy = (p.y - pb.y) / 0.25;
    const speed = Math.hypot(vx, vy);
    const ang = Math.atan2(vy, vx);
    // Estirado en la dirección del vuelo: a velocidad pico el punto mide lo
    // que recorre en un sub-frame, así la estela del obturador es continua.
    const stretch = 1 + Math.min(2.2, speed / 95);
    const bulge = 1 + 0.4 * Math.sin(Math.PI * p.k); // sube hacia cámara (z -300)
    const color = col(COL.accent, CARDS[k].tile, EASE.swell(p.k));
    // Sombra de contacto: más lejos y más blanda cuanto más alto vuela.
    const h = bulge - 1;
    const sr = 14 + 26 * h;
    const g = ctx.createRadialGradient(p.x + 4, p.y + 16 + 70 * h, 0, p.x + 4, p.y + 16 + 70 * h, sr);
    g.addColorStop(0, `rgba(124,45,18,${0.16 * (1 - 0.6 * h / 0.4)})`);
    g.addColorStop(1, "rgba(124,45,18,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x + 4 - sr, p.y + 16 + 70 * h - sr, sr * 2, sr * 2);
    const w = Math.max(SPLIT.d, p.R.w);
    const hh = Math.max(SPLIT.d, p.R.h);
    // La punta queda donde está el punto; lo estirado queda detrás.
    const back = ((stretch - 1) * bulge * Math.max(w, hh)) / 2;
    drawBlob(ctx, p.x - Math.cos(ang) * back, p.y - Math.sin(ang) * back, w, hh, stretch * bulge, bulge / Math.sqrt(stretch), ang, color);
  }
}

// Punto (o tramo todavía rectangular) estirado en la dirección `ang`.
function drawBlob(ctx, x, y, w, h, sAlong, sAcross, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(sAlong, sAcross);
  ctx.rotate(-ang);
  rr(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ─── barra de entrada ────────────────────────────────────────────────────────
// Es parte de la página: llega con el mundo en el latigazo y se va con el chat.
function inputBar(ctx, t) {
  if (INPUT.hidden) return;
  const d = dropOut(t, 0.4);
  if (d.alpha <= 0.001) return;
  const I = INPUT;
  ctx.save();
  ctx.globalAlpha *= d.alpha;
  ctx.translate(0, d.dy);
  ctx.save();
  ctx.shadowColor = "rgba(124,45,18,0.10)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  rr(ctx, I.x, I.y, I.w, I.h, I.r);
  ctx.fillStyle = COL.card;
  ctx.fill();
  ctx.restore();
  rr(ctx, I.x + 0.75, I.y + 0.75, I.w - 1.5, I.h - 1.5, I.r - 0.75);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COL.border;
  ctx.stroke();
  const cy = I.y + I.h / 2;
  icon(ctx, "paperclip", I.x + 50, cy, 28, { color: COL.mute, width: 2.2 });
  drawText(ctx, I.placeholder, I.x + 88, cy + 10, { size: 28, weight: 500, tracking: 0 }, { color: COL.mute });
  // Botón de enviar (apagado, como con el campo vacío).
  rr(ctx, I.x + I.w - 76, cy - 30, 60, 60, 18);
  ctx.fillStyle = "#f1ece3";
  ctx.fill();
  icon(ctx, "send", I.x + I.w - 46, cy, 26, { color: COL.mute, width: 2.2 });
  ctx.restore();
}

// ─── columna completa ────────────────────────────────────────────────────────
export function drawChat(ctx, t) {
  inputBar(ctx, t);
  bubble(ctx, t);
  assistant(ctx, t);
  thinking(ctx, t);
  chip(ctx, t);
}
