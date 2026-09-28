// Pieza 1, S4 "Una instrucción." (f191-262), Papel. Tratamiento final 3.5.
//
// El informe de Alex aparece terminado adentro del párpado (T8), la cámara se
// abre y muestra la edición en lote: el chip de ejemplo se vuelve el campo
// "Instrucción" (TC), "Previsualizar cambios" dispara seis propuestas verdes
// que vuelan a los informes (TP), el punto de la frase aprieta "Aplicar a 12
// informes" y todos los subrayados punteados se vuelven línea (KD). El botón se
// vuelve el aviso "Aplicado a 12 informes." en pantalla mientras el mundo se va
// con un latigazo, y el aviso se vuelve la burbuja del chat de S5 (T11').
//
// Capas: L0 papel, L1 renglones (z +700), L2 grilla de 12 columnas (z +300),
// L4 UI (z 0, las propuestas se abomban a z -300), L5 motas (z -400). La frase
// y el actor aviso→burbuja van en drawTop (pantalla).
//
// Contratos: C-P1-11 (cámara adentro del párpado), C-P1-12 (identidad en
// f209), C-P1-13 (botón en f245), C-P1-14 (latigazo), C-P1-15 (burbuja f262).

import { EASE, SPR, spr, p, ring, punch } from "../../shared/system.js";
import { makePhrase, drawPhrase, tinta, evaporar, bumps } from "../../shared/phrase.js";
import { arc, flightV, lerpRect, drawRect } from "../../shared/punto.js";
import { C, icon, checkbox } from "../../shared/ui.js";
import { drawText, textWidth } from "../../engine/text.js";
import { kf, cubicBezier } from "../../engine/ease.js";
import { clamp, lerp, mix, mixHex, rgba, noise1, hash1, smoothstep } from "../../engine/math.js";
import { G, rrPath, shadowFill, dottedRow, flashAmt, lineWithBold, buttonLabel, ripple, pressCurve, miniCard } from "./s4-ui.js";
import { createCanvas } from "@napi-rs/canvas";
import { IS_V } from "../../engine/format.js";
import { BUBBLE as BUBBLE_S5 } from "./s5-layout.js";

// Canvas propio para medir en la carga del módulo (textWidth necesita un ctx).
const measureCtx = createCanvas(8, 8).getContext("2d");

const START = 191;
const END = 262;
const F = 1400; // focal del tratamiento (2.6)

// ─── layout (mundo; con la cámara en identidad coincide con la pantalla) ─────
// Vertical (IS_V): todo apilado en una columna de x 120-1180. La frase va en dos
// renglones; debajo, la fila de la instrucción, el botón, el informe de Alex y
// las cinco mini tarjetas en fila. El campo, el informe y las minis se corren
// como grupo (OFF); el botón y el aviso se definen ya corridos porque los usan
// los actores de pantalla.
const OFF = IS_V ? { field: [0, 128], hero: [0, 200], minis: [-680, 600] } : { field: [0, 0], hero: [0, 0], minis: [0, 0] };
const FIELD = { x: 120, y: 372, w: 1060, h: 96, r: 18 };
const BTN = IS_V ? { x: 120, y: 620, w: 380, h: 80, r: 18 } : { x: 1220, y: 380, w: 380, h: 80, r: 18 };
const BTN_C = [BTN.x + BTN.w / 2, BTN.y + BTN.h / 2]; // (1410, 420)
const HERO = { x: 120, y: 540, w: 640, h: 420, r: 24 };
const BANNER = { ...BTN, w: 583 };
// La burbuja cae exactamente donde S5 la toma (C-P1-15), en cualquier formato.
const BUBBLE = { ...BUBBLE_S5 };
const CHIP = { x: 140, y: 396, w: 452, h: 48, r: 24 };

const PROSE = [
  "Alex participa con entusiasmo de las",
  "propuestas de la sala y respeta los",
  "acuerdos del grupo. Propone ideas y",
  "ayuda a sus compañeros a organizarse.",
];
const INSERT = ["Disfrutó la visita al museo y contó", "lo que descubrió al grupo."];
const PROSE_ST = { size: 30, weight: 450, tracking: 0 };
const INS_ST = { size: 30, weight: 500, tracking: 0 };
const PROSE_Y = [690, 735, 780, 825];
const INS_Y = [870, 915];
const EXAMPLE = "Agregar que visitaron el museo";
const BUBBLE_TEXT = "Quiero armar una unidad sobre la huerta";

// Mini tarjetas: cada una recibe su inserto "donde corresponda" (renglones
// 2-3, 4-5, 1-2, 5-6, 3-4) con anchos propios.
const BARS = [150, 140, 158, 120, 146, 100];
const MINIS = [
  { name: "Ejemplo, Noa", ins: 1, insW: [128, 92] },
  { name: "Ejemplo, Sasha", ins: 3, insW: [150, 104] },
  { name: "Ejemplo, Dani", ins: 0, insW: [138, 116] },
  { name: "Ejemplo, Eli", ins: 4, insW: [120, 86] },
  { name: "Ejemplo, Juli", ins: 2, insW: [146, 98] },
].map((m, i) => ({
  ...m,
  x: 800 + 204 * i,
  bars: BARS.map((_, k) => BARS[(k + i * 2) % BARS.length]),
  bandW: Math.max(...m.insW) + 12,
}));

// ─── tiempos (en la grilla de 14 f; contactos en el frame del golpe) ─────────
const T = {
  bold: 196, // H2: "Alex" pasa a negrita
  pull: 201, // el informe terminado se sostiene 197-201 (párpado abierto)
  una: 205, // H3 (entra recién cuando la cámara se aleja: durante la pausa del informe no asoma nada)
  check: 206.5, // H3: la casilla del informe se tilda
  row: 207,
  instr: 210, // H2: "instrucción." y el punto
  chip: 213.5, // H3
  tap: 217, // H3: TC
  focus: 224, // H1: foco, "Previsualizar cambios", punch 2
  prevTap: 227.5, // H3
  fly: 228, // TP
  roll: 238, // H2: la etiqueta rueda a "Aplicar a 12 informes"
  dotGo: 241.5, // el punto sale hacia el botón
  apply: 245, // H3: el punto aprieta "Aplicar"; KD; CA 3 (compositor)
  evap: 243, // K5 de izquierda a derecha: libre antes de que S5 suba "Contale" (f249)
  whip: 249,
  bub: 256,
};

// Propuestas: 0 = informe de Alex, 1..5 = mini tarjetas.
const HERO_BAND = [
  { x: 146, cy: 862.5, w: 152 + textWidthFixed(INSERT[0]) + 6 - 146, h: 43 },
  { x: 146, cy: 907.5, w: 152 + textWidthFixed(INSERT[1]) + 6 - 146, h: 43 },
];
function textWidthFixed(s) {
  // El ancho no depende del ctx (la medición se cachea por estilo), pero la
  // función de engine/text necesita uno: se usa un canvas chico propio.
  return textWidth(measureCtx, s, INS_ST);
}
const PULSE = { w: 60, h: 20 };
const flyT0 = (i) => T.fly + 1.2 * i;
const contact = (i) => flyT0(i) + 6.5; // 234.5, 235.7, 236.9, 238.1, 239.3, 240.5
const miniRowTop = (m, k) => 600 + 60 + 22 * k;
const TARGET = [
  [HERO_BAND[0].x + PULSE.w / 2 + OFF.hero[0], HERO_BAND[0].cy + OFF.hero[1]],
  ...MINIS.map((m) => [m.x + 10 + PULSE.w / 2 + OFF.minis[0], miniRowTop(m, m.ins) - 5 + 21.5 + OFF.minis[1]]),
];
const solidAt = (i) => (i === 0 ? T.apply : T.apply + 0.5 * i); // KD escalonado 0,5 f

// ─── frase ───────────────────────────────────────────────────────────────────
// En vertical la frase va en dos renglones ("Una" / "instrucción."), cada uno con
// su programa; la evaporación sigue siendo una sola pasada de izquierda a
// derecha y de arriba abajo.
const PHRASES = IS_V
  ? [
      [makePhrase({ text: "Una", size: 190, wght: 760, tracking: -0.045, x: 120, baseline: 250, color: C.ink, periodColor: C.accent }), [tinta(T.una, { word: 0 }), bumps([238], 60), evaporar(T.evap, { stagger: 0.35, dur: 4.5 })]],
      [makePhrase({ text: "instrucción.", size: 190, wght: 760, tracking: -0.045, x: 120, baseline: 440, color: C.ink, periodColor: C.accent }), [tinta(T.instr, { word: 0, stagger: 0.45 }), bumps([238], 60), evaporar(T.evap + 1.05, { stagger: 0.35, dur: 4.5 })]],
    ]
  : [[makePhrase({ text: "Una instrucción.", size: 190, wght: 760, tracking: -0.045, x: 120, baseline: 300, color: C.ink, periodColor: C.accent }), [tinta(T.una, { word: 0 }), tinta(T.instr, { word: 1, stagger: 0.45 }), bumps([238], 60), evaporar(T.evap, { stagger: 0.35, dur: 4.5 })]]];
const PH = PHRASES[PHRASES.length - 1][0]; // el renglón que lleva el punto
const PROG = PHRASES[PHRASES.length - 1][1];

// ─── cámara del mundo ────────────────────────────────────────────────────────
// {cx, cy} = punto del mundo que cae en el centro de la pantalla, z = zoom, ox
// = paneo del latigazo (C-P1-14). Una capa a profundidad d se ve con escala
// s = F / (F + d) sobre ese mismo centro, y el paneo la corre s·ox.
const LN_Z0 = Math.log(1.56);
// Pull-back: arranca desde velocidad cero (la anticipación terminó quieta),
// pico de velocidad en el primer cuarto y frenada larga. glide puro saltaba
// 1.56 → 1.2 en un frame y se comía el informe.
const PULL = cubicBezier(0.3, 0, 0.12, 1);
// Vuelo del aviso a la burbuja: sale quieto, viaja rápido y frena en el overshoot.
const BUB_FLY = cubicBezier(0.4, 0, 0.2, 1);
const LN_ZA = Math.log(1.585);
export function camAt(t) {
  let cx = 440 + OFF.hero[0];
  let cy = 750 + OFF.hero[1];
  let lz = LN_Z0;
  // Anticipación: medio empuje hacia adentro mientras "Alex" se entinta.
  if (t >= 197 && t < T.pull) lz = lerp(LN_Z0, LN_ZA, EASE.swell((t - 197) / (T.pull - 197)));
  if (t >= T.pull) {
    // Pull-back en log (1.585 → 1.00); se pasa apenas (0.993) y vuelve: identidad en f209.
    const q = PULL(clamp((t - T.pull) / 7));
    cx = lerp(440 + OFF.hero[0], 960, q);
    cy = lerp(750 + OFF.hero[1], 540, q);
    lz = kf(t, [[T.pull, LN_ZA], [207, Math.log(0.993), PULL], [209, 0, EASE.swell]]);
  }
  let z = Math.exp(lz);
  // Dolly de lectura 209-249 (+1,2 %) centrado en el botón: el mundo respira
  // detrás de la frase quieta y el botón no se corre de su lugar.
  if (t > 209) {
    const k = lerp(1, 1.012, EASE.swell(clamp((t - 209) / 40)));
    cx = BTN_C[0] - (BTN_C[0] - cx) / k;
    cy = BTN_C[1] - (BTN_C[1] - cy) / k;
    z *= k;
  }
  z *= punch(t, T.focus); // punch 2 (solo mundo)
  const ox = -1920 * EASE.whip(clamp((t - T.whip) / 6));
  return { cx, cy, z, ox };
}
const toScreen = (cam, x, y) => [960 + cam.ox + cam.z * (x - cam.cx), 540 + cam.z * (y - cam.cy)];

function withLayer(ctx, cam, depth, fn) {
  const s = F / (F + depth);
  ctx.save();
  ctx.translate(960 + s * cam.ox, 540);
  ctx.scale(s * cam.z, s * cam.z);
  ctx.translate(-cam.cx, -cam.cy);
  fn(ctx, s * cam.z);
  ctx.restore();
}

// Borde del campo durante el latigazo (C-P1-14): ox + 1920.
export function panBoundary(t) {
  return 1920 - 1920 * EASE.whip(clamp((t - T.whip) / 6));
}

// ─── L1, L2, L5 ──────────────────────────────────────────────────────────────
function drawRuled(ctx, t) {
  // Renglones del papel donde se escribió el informe (siguen la deriva de S3).
  const drift = 0.4 * (t - 134);
  const y0 = -900 - (drift % 64);
  ctx.strokeStyle = "rgba(170,140,100,0.11)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = y0; y < 2000; y += 64) {
    ctx.moveTo(-3200, y);
    ctx.lineTo(5200, y);
  }
  ctx.stroke();
}

const GRID_S = F / (F + 300);
function drawGrid(ctx) {
  // 12 columnas (márgenes 120, calle 24, columna 118) alineadas en reposo.
  ctx.strokeStyle = rgba(C.border, 0.55);
  ctx.lineWidth = 1 / GRID_S;
  ctx.beginPath();
  for (let k = 0; k < 12; k++) {
    for (const xs of [120 + 142 * k, 120 + 142 * k + 118]) {
      const xw = 960 + (xs - 960) / GRID_S;
      ctx.moveTo(xw, -1400);
      ctx.lineTo(xw, 2600);
    }
  }
  ctx.stroke();
}

// Polvo del papel en primer plano: motas chicas y blandas. Casi no se ven
// quietas; en el pull-back y en el latigazo se mueven 1,4x (paralaje).
const MOTES = Array.from({ length: 16 }, (_, i) => {
  const h = (k) => hash1(i * 7 + k * 131 + 5);
  // Lejos del centro de la acción: bordes y franja de abajo.
  const edge = h(1) < 0.5;
  const xs = edge ? (h(2) < 0.5 ? 20 + 160 * h(3) : 1740 + 170 * h(3)) : 80 + 1760 * h(3);
  const ys = edge ? 60 + 960 * h(4) : h(5) < 0.5 ? 20 + 90 * h(4) : 980 + 90 * h(4);
  return [xs, ys, 3 + 6 * h(6), 0.1 + 0.1 * h(7)];
});
const MOTE_S = F / (F - 400);
function drawMotes(ctx, t) {
  MOTES.forEach(([xs, ys, r, a], i) => {
    const x = 960 + (xs - 960) / MOTE_S + 10 * noise1(t * 0.03, 11 + i);
    const y = 540 + (ys - 540) / MOTE_S + 8 * noise1(t * 0.025, 31 + i) - 0.3 * (t - 191);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,112,72,${a})`);
    g.addColorStop(0.5, `rgba(150,112,72,${a * 0.6})`);
    g.addColorStop(1, "rgba(150,112,72,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── L4: el informe de Alex ─────────────────────────────────────────────────
function drawHero(ctx, t, scr) {
  shadowFill(ctx, HERO.x, HERO.y, HERO.w, HERO.h, HERO.r, C.card, { k: 1, scr });
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  rrPath(ctx, HERO.x + 0.75, HERO.y + 0.75, HERO.w - 1.5, HERO.h - 1.5, HERO.r - 0.75);
  ctx.stroke();

  // Casilla: vacía hasta f206.5; ahí se hunde y se tilda (K3 sobre snap).
  const kc = spr(t, T.check, SPR.snap);
  let sc = 1;
  if (t > T.check - 1.5 && t < T.check) sc = lerp(1, 0.86, EASE.accel((t - T.check + 1.5) / 1.5));
  else if (t >= T.check) sc = lerp(0.86, 1, kc);
  ctx.save();
  ctx.translate(164, 582);
  ctx.scale(sc, sc);
  checkbox(ctx, -16, -16, 32, t >= T.check ? clamp(kc) : 0);
  ctx.restore();

  drawText(ctx, "Ejemplo, Alex", 196, 596, { size: 36, weight: 800 }, { color: C.ink });
  drawText(ctx, "FORMACIÓN PERSONAL Y SOCIAL", 152, 640, { size: 20, weight: 800, tracking: 0.06 }, { color: C.inkMute });

  // Negrita de solo lectura (f196): "Alex" 450 → 700 en snap, con un brillo
  // #fde9d3 detrás durante un beat.
  const kb = spr(t, T.bold, SPR.snap);
  const glow = t < T.bold ? 0 : clamp((t - T.bold) / 2) * (1 - p(t, 206, 210, EASE.swell));
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha *= glow;
    ctx.fillStyle = C.accentSoft;
    const gw = textWidth(ctx, "Alex", { ...PROSE_ST, weight: 700 });
    rrPath(ctx, 152 - 6 - 3 * (1 - glow), 690 - 29, gw + 12 + 6 * (1 - glow), 39, 8);
    ctx.fill();
    ctx.restore();
  }
  lineWithBold(ctx, PROSE[0], "Alex", 152, PROSE_Y[0], PROSE_ST, C.ink, t < T.bold ? 0 : kb);
  for (let i = 1; i < 4; i++) drawText(ctx, PROSE[i], 152, PROSE_Y[i], PROSE_ST, { color: C.ink });

  // Inserto (TP): la propuesta aterriza en f234.5 y se vuelve dos bandas.
  const c = contact(0);
  if (t >= c) {
    const flash = flashAmt(t, T.apply);
    const bandCol = mix(G.band, G.flash, flash);
    for (let j = 0; j < 2; j++) {
      const B = HERO_BAND[j];
      const kw = spr(t, c + 1.5 * j, SPR.snap);
      if (t < c + 1.5 * j) continue;
      const kh = spr(t, c + j, SPR.snap);
      const w = lerp(PULSE.w, B.w, kw);
      const h = lerp(PULSE.h, B.h, kh);
      const cy = j === 0 ? B.cy : lerp(HERO_BAND[0].cy, B.cy, kh);
      ctx.save();
      rrPath(ctx, B.x, cy - h / 2, w, h, 6);
      ctx.fillStyle = bandCol;
      ctx.fill();
      ctx.clip();
      // El renglón entero sube adentro de la banda (nunca se tipea).
      const tr = c + 1 + 1.5 * j;
      const a = clamp((t - tr) / 2);
      if (a > 0) {
        ctx.globalAlpha *= a;
        const dy = 18 * (1 - EASE.glide(clamp((t - tr) / 4)));
        drawText(ctx, INSERT[j], 152, INS_Y[j] + dy, INS_ST, { color: G.ink });
      }
      ctx.restore();
      const tw = B.w - 12;
      dottedRow(ctx, {
        x0: 155,
        x1: 152 + tw - 3,
        y: INS_Y[j] + 9,
        d: 6,
        pitch: 14,
        color: G.ink,
        show: EASE.pen(clamp((t - (c + 2 + 1.5 * j)) / 5)),
        t,
        solidAt: T.apply + 0.5 * j,
        dur: 3.5,
        spread: 2.5,
      });
    }
  }
}

function drawMinis(ctx, t, scr) {
  MINIS.forEach((m, i) => {
    const c = contact(i + 1);
    const kw = t >= c ? spr(t, c, SPR.snap) : 0;
    miniCard(ctx, {
      x: m.x,
      y: 600,
      t,
      scr,
      rise: 20 * (1 - spr(t, 201 + 1.5 * i, SPR.snap)),
      name: m.name,
      bars: m.bars,
      insRow: m.ins,
      insW: m.insW,
      open: spr(t, c - 1.5, SPR.snap),
      band: t >= c ? { w: lerp(PULSE.w, m.bandW, kw), h: lerp(PULSE.h, 43, kw) } : null,
      bandColor: mix(G.band, G.flash, flashAmt(t, solidAt(i + 1))),
      rowsShow: clamp((t - c - 0.5) / 3),
      dots: {
        show: [EASE.pen(clamp((t - c - 1.5) / 4)), EASE.pen(clamp((t - c - 2.5) / 4))],
        solidAt: [solidAt(i + 1), solidAt(i + 1) + 0.3],
      },
    });
  });
}

// ─── L4: la instrucción ──────────────────────────────────────────────────────
function drawFieldRow(ctx, t) {
  if (t < T.row) return;
  // Entrada: sube 12 px y aparece, 1,5 f entre la etiqueta y el campo.
  const enter = (t0) => ({ a: clamp((t - t0) / 3), dy: 12 * (1 - EASE.glide(clamp((t - t0) / 6))) });
  const L = enter(T.row);
  ctx.save();
  ctx.globalAlpha *= L.a;
  drawText(ctx, "Instrucción", 120, 358 + L.dy, { size: 24, weight: 700 }, { color: C.inkSoft });
  ctx.restore();

  const E = enter(T.row + 1.5);
  if (E.a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= E.a;
  ctx.translate(0, E.dy);
  // Foco (f224): borde de acento y aro #fde9d3 de 6 px que florece con snap;
  // se va cuando el toque de "Previsualizar" se lleva el foco.
  const off = 1 - p(t, 228.5, 232, EASE.swell);
  const focus = p(t, T.focus, T.focus + 3, EASE.glide) * off;
  const ringW = 6 * spr(t, T.focus, SPR.snap) * off;
  if (ringW > 0.05) {
    ctx.strokeStyle = C.accentSoft;
    ctx.lineWidth = ringW;
    rrPath(ctx, FIELD.x - ringW / 2, FIELD.y - ringW / 2, FIELD.w + ringW, FIELD.h + ringW, FIELD.r + ringW / 2);
    ctx.stroke();
  }
  rrPath(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = mix(C.borderStrong, C.accent, focus);
  ctx.lineWidth = 2;
  rrPath(ctx, FIELD.x + 1, FIELD.y + 1, FIELD.w - 2, FIELD.h - 2, FIELD.r - 1);
  ctx.stroke();

  // TC "Chip a campo": el chip real de ejemplo aparece (K3), se toca y su
  // texto se vuelve el texto del campo mientras el relleno se disuelve.
  if (t >= T.chip) {
    const pop = spr(t, T.chip, SPR.snap);
    const pr = pressCurve(t, T.tap, (tt, H) => spr(tt, H, SPR.snap));
    const k = EASE.glide(clamp((t - (T.tap + 0.5)) / 6));
    const fillA = clamp(1 - k * 1.6);
    const ccx = CHIP.x + CHIP.w / 2;
    const ccy = CHIP.y + CHIP.h / 2;
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.chip) / 2);
    ctx.translate(ccx, ccy);
    const s = pop * (1 - 0.06 * pr);
    ctx.scale(s, s);
    ctx.translate(-ccx, -ccy);
    if (fillA > 0) {
      ctx.save();
      ctx.globalAlpha *= fillA;
      rrPath(ctx, CHIP.x, CHIP.y, CHIP.w, CHIP.h, CHIP.r);
      ctx.fillStyle = C.accentSoft;
      ctx.fill();
      ctx.restore();
    }
    // Onda del toque (alrededor del chip, sobre el blanco del campo).
    if (t >= T.tap && t < T.tap + 10) {
      const kr = EASE.glide(clamp((t - T.tap) / 10));
      ctx.save();
      rrPath(ctx, FIELD.x + 2, FIELD.y + 2, FIELD.w - 4, FIELD.h - 4, FIELD.r - 2);
      ctx.clip();
      ctx.globalAlpha *= 0.7 * (1 - kr);
      ctx.fillStyle = C.accentSoft;
      ctx.beginPath();
      ctx.arc(ccx, ccy, 40 + 420 * kr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const size = lerp(28, 44, k);
    const st = { size, weight: lerp(600, 500, k), tracking: 0 };
    drawText(ctx, EXAMPLE, lerp(CHIP.x + 20, 150, k), lerp(430.5, 440, k), st, { color: mix(C.accentInk, C.ink, k) });
    ctx.restore();
  }
  // Cursor: 3 x 48 en x 790, titila en corcheas.
  if (t >= 223.5) {
    const on = Math.floor((t - 223.5) / 7) % 2 === 0 ? 1 : 0;
    const a = on * off;
    if (a > 0) {
      ctx.fillStyle = C.accent;
      ctx.globalAlpha *= a;
      ctx.fillRect(790, 396, 3, 48);
    }
  }
  ctx.restore();
}

// ─── L4: el botón (hasta f245; desde ahí es el actor de pantalla) ────────────
function drawButton(ctx, t) {
  if (t < T.focus || t >= T.apply) return;
  const pop = spr(t, T.focus, SPR.snap);
  const pr = pressCurve(t, T.prevTap, (tt, H) => spr(tt, H, SPR.snap));
  const s = pop * (1 - 0.06 * pr);
  ctx.save();
  ctx.globalAlpha *= clamp((t - T.focus) / 2);
  ctx.translate(BTN_C[0], BTN_C[1]);
  ctx.scale(s, s);
  ctx.translate(-BTN_C[0], -BTN_C[1]);
  ctx.save();
  ctx.shadowColor = rgba(C.accent, 0.3 * (1 - 0.7 * pr));
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12 * (1 - pr);
  rrPath(ctx, BTN.x, BTN.y, BTN.w, BTN.h, BTN.r);
  ctx.fillStyle = C.accent;
  ctx.fill();
  ctx.restore();
  ripple(ctx, BTN, BTN.r, BTN_C[0], BTN_C[1], t, T.prevTap, { maxR: 260, dur: 9, a0: 0.45 });
  // Rodillo de la etiqueta (f238, 4 f): "Previsualizar cambios" → "Aplicar a 12 informes".
  ctx.save();
  rrPath(ctx, BTN.x, BTN.y, BTN.w, BTN.h, BTN.r);
  ctx.clip();
  const kr = EASE.lunge(clamp((t - T.roll) / 4));
  if (kr < 1) buttonLabel(ctx, "Previsualizar cambios", "sparkles", BTN_C[0], BTN_C[1], { dy: -50 * kr, alpha: 1 - kr });
  if (kr > 0) buttonLabel(ctx, "Aplicar a 12 informes", "check", BTN_C[0], BTN_C[1], { dy: 50 * (1 - kr) });
  ctx.restore();
  ctx.restore();
}

// ─── L4: las propuestas en vuelo (TP) ────────────────────────────────────────
function drawPulses(ctx, t) {
  for (let i = 0; i < 6; i++) {
    const t0 = flyT0(i);
    const t1 = contact(i);
    if (t < t0 || t >= t1) continue;
    const opt = { t0, t1, from: BTN_C, to: TARGET[i], lift: 200, ease: EASE.lunge };
    const a = arc(t, opt);
    const b = arc(t + 0.25, opt);
    const u = clamp((t - t0) / 6.5);
    // Orientación según la velocidad, que se endereza para aterrizar plana.
    let ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    ang *= 1 - smoothstep(0.72, 1, u);
    const bulge = 1 + 0.27 * Math.sin(Math.PI * u); // z 0 → -300 → 0
    const born = EASE.brake(clamp((t - t0) / 1.5));
    const st = Math.sin(Math.PI * u);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.scale(bulge * lerp(0.4, 1, born) * (1 + 0.3 * st), bulge * lerp(0.4, 1, born) * (1 - 0.12 * st));
    rrPath(ctx, -PULSE.w / 2, -PULSE.h / 2, PULSE.w, PULSE.h, PULSE.h / 2);
    ctx.fillStyle = mix("#bef264", G.band, smoothstep(0.55, 1, u)); // lima en vuelo, banda al tocar
    ctx.fill();
    ctx.strokeStyle = rgba(G.ink, lerp(0.85, 0.5, smoothstep(0.55, 1, u)));
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ─── el mundo ────────────────────────────────────────────────────────────────
function draw(ctx, t) {
  // Después de f255 el latigazo terminó: S5 cubre todo el cuadro.
  if (t >= 255.5) return;
  ctx.fillStyle = C.surface;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  const cam = camAt(t);
  withLayer(ctx, cam, 700, (c) => drawRuled(c, t));
  withLayer(ctx, cam, 300, (c) => drawGrid(c));
  const grp = (c, off, fn) => {
    c.save();
    c.translate(off[0], off[1]);
    fn();
    c.restore();
  };
  withLayer(ctx, cam, 0, (c, scr) => {
    grp(c, OFF.minis, () => drawMinis(c, t, scr));
    grp(c, OFF.hero, () => drawHero(c, t, scr));
    grp(c, OFF.field, () => drawFieldRow(c, t));
    drawButton(c, t);
    drawPulses(c, t);
  });
  withLayer(ctx, cam, -400, (c) => drawMotes(c, t));
}

// ─── pantalla: la frase, su punto y el actor aviso → burbuja ────────────────
const P0 = PH.period;
function dotState(t) {
  if (t < 206) return null;
  let x = P0.cx;
  let y = P0.cy;
  let sx = 1;
  let sy = 1;
  let a = clamp((t - 206) / 1.5);
  if (t < T.instr) {
    // K4 sobre el punto: cae desde 90 px y se estira.
    const k = EASE.accel((t - 206) / 4);
    y = P0.cy - 90 * (1 - k);
    sx = lerp(1, 0.86, k);
    sy = lerp(1, 1.28, k);
  } else if (t < T.instr + 2) {
    const k = (t - T.instr) / 2;
    sx = lerp(0.86, 1.26, k);
    sy = lerp(1.28, 0.78, k);
  } else if (t < 240) {
    const k = spr(t, T.instr + 2, SPR.slam);
    sx = lerp(1.26, 1, k);
    sy = lerp(0.78, 1, k);
  } else if (t < T.dotGo) {
    // Anticipación del salto: se agacha.
    const k = EASE.swell((t - 240) / 1.5);
    sx = lerp(1, 1.18, k);
    sy = lerp(1, 0.8, k);
    y = P0.cy + 3 * k;
  } else if (t < T.apply) {
    const f = flightV(t, {
      t0: T.dotGo,
      t1: T.apply,
      P0: [P0.cx, P0.cy + 3],
      P1: [P0.cx - 4, P0.cy - 70],
      P2: [BTN_C[0] + 30, BTN_C[1] - 110],
      P3: BTN_C,
      v0: 0,
      v1: 48,
    });
    x = f.x;
    y = f.y;
    const u = (t - T.dotGo) / (T.apply - T.dotGo);
    sx = lerp(1.18, 0.9, clamp(u * 3));
    sy = lerp(0.8, 1.2, clamp(u * 3));
  } else {
    // Contacto: el punto aprieta el botón y se absorbe en él.
    x = BTN_C[0];
    y = BTN_C[1];
    const k = EASE.accel(clamp((t - T.apply) / 1.5));
    sx = lerp(1.25, 0, k);
    sy = lerp(0.75, 0, k);
    if (k >= 1) return null;
  }
  return { x, y, sx, sy, a };
}

function drawDotNow(ctx, t) {
  const s = dotState(t);
  if (!s || s.a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= s.a;
  ctx.fillStyle = C.accent;
  ctx.translate(s.x, s.y);
  ctx.scale(s.sx, s.sy);
  ctx.beginPath();
  ctx.arc(0, 0, P0.d / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// El actor T11': botón apretado (f245) → aviso verde (246-250, nítido en
// pantalla durante el latigazo) → burbuja de la docente (256-262).
function actorRect(t, R0) {
  if (t < 246) return { ...R0 };
  const kb = kf(t, [[246, 0], [248.8, 1.02, EASE.glide], [250.5, 1, EASE.swell]]);
  const RB = lerpRect(R0, { ...BANNER }, kb);
  if (t < T.bub) return RB;
  // Forma en glide. Posición: arranca quieta, vuela en una curva que sube
  // apenas (la burbuja "se envía"), se pasa 2 % y asienta con velocidad cero
  // en f262, donde S5 la toma quieta (C-P1-15).
  const u = clamp((t - T.bub) / 6);
  const ks = EASE.glide(u);
  const kp = kf(t, [[T.bub, 0], [259.6, 1.02, BUB_FLY], [END, 1, EASE.swell]]);
  const shape = lerpRect(RB, BUBBLE, ks);
  const x0 = BANNER.x + BANNER.w / 2;
  const y0 = BANNER.y + BANNER.h / 2;
  const x1 = BUBBLE.x + BUBBLE.w / 2;
  const y1 = BUBBLE.y + BUBBLE.h / 2;
  const qx = (x0 + x1) / 2;
  const qy = Math.min(y0, y1) - 70;
  const m = 1 - kp;
  const cx = m * m * x0 + 2 * m * kp * qx + kp * kp * x1;
  const cy = m * m * y0 + 2 * m * kp * qy + kp * kp * y1;
  return { ...shape, x: cx - shape.w / 2, y: cy - shape.h / 2 };
}

function drawActor(ctx, t) {
  if (t < T.apply || t >= END) return;
  const cam = camAt(T.apply);
  const [x0, y0] = toScreen(cam, BTN.x, BTN.y);
  const R0 = { x: x0, y: y0, w: BTN.w * cam.z, h: BTN.h * cam.z, r: BTN.r * cam.z };
  const R = actorRect(t, R0);
  const kG = p(t, 246, 249, EASE.glide); // acento → verde
  const kA = p(t, T.bub, 261.5, EASE.glide); // verde → acento
  const fill = mix(mixHex(C.accent, G.band, kG), C.accent, kA);
  // Toque de "Aplicar": se hunde en 1,5 f y rebota con snap al crecer.
  const pr = pressCurve(t, T.apply, (tt, H) => spr(tt, H, SPR.snap));
  const s = 1 - 0.06 * pr;
  const cx = R.x + R.w / 2;
  const cy = R.y + R.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  // Sombra: la del botón (acento) → una suave de tinta → la de la burbuja.
  const shA = lerp(0.3, 0.12, kG);
  ctx.save();
  // Tinte de la sombra: acento (botón) → tinta (aviso) → acento (burbuja).
  const kInk = kG * (1 - kA);
  const shR = Math.round(lerp(194, 28, kInk));
  const shG = Math.round(lerp(65, 25, kInk));
  const shB = Math.round(lerp(12, 23, kInk));
  ctx.shadowColor = `rgba(${shR},${shG},${shB},${lerp(shA, 0, kA)})`; // S5 la vuelve a encender desde f262
  ctx.shadowBlur = lerp(26, 30, kG);
  ctx.shadowOffsetY = lerp(12, 12, kG) * (1 - pr);
  drawRect(ctx, R, { fill });
  ctx.restore();
  drawRect(ctx, R, { fill });
  // Borde verde del aviso.
  const bA = kG * (1 - kA);
  if (bA > 0.01) drawRect(ctx, R, { stroke: rgba(G.ink, 0.28 * bA), lineWidth: 1.5 });
  // Onda del contacto del punto.
  ripple(ctx, R, R.r, BTN_C[0], BTN_C[1], t, T.apply, { maxR: 420, dur: 9, a0: 0.5 });

  // Contenido del botón (se va 246-247.5).
  const aBtn = 1 - clamp((t - 246) / 1.5);
  if (aBtn > 0) {
    ctx.save();
    rrPath(ctx, R.x, R.y, R.w, R.h, R.r);
    ctx.clip();
    buttonLabel(ctx, "Aplicar a 12 informes", "check", R0.x + R0.w / 2, R0.y + R0.h / 2, { alpha: aBtn, size: 28 * cam.z });
    ctx.restore();
  }
  // Contenido del aviso, anclado a los bordes del rect (viaja con él).
  const aOut = 1 - clamp((t - T.bub) / 2);
  if (t >= 247 && aOut > 0) {
    ctx.save();
    rrPath(ctx, R.x, R.y, R.w, R.h, R.r);
    ctx.clip();
    const midY = R.y + R.h / 2;
    icon(ctx, "check", R.x + 24 + 14, midY, 28, { color: G.ink, width: 3, progress: EASE.pen(clamp((t - 247) / 3.5)), alpha: aOut });
    const a1 = clamp((t - 247.5) / 2.5) * aOut;
    const d1 = 8 * (1 - EASE.glide(clamp((t - 247.5) / 4)));
    ctx.globalAlpha *= 1;
    if (a1 > 0) {
      ctx.save();
      ctx.globalAlpha *= a1;
      drawText(ctx, "Aplicado a 12 informes.", R.x + 64, midY + 10.5 + d1, { size: 28, weight: 700 }, { color: G.ink });
      ctx.restore();
    }
    const a2 = clamp((t - 248.5) / 2.5) * aOut;
    if (a2 > 0) {
      const lw = 161.1;
      const lx = R.x + R.w - 24 - lw;
      const d2 = 8 * (1 - EASE.glide(clamp((t - 248.5) / 4)));
      ctx.save();
      ctx.globalAlpha *= a2;
      drawText(ctx, "Deshacer lote", lx, midY + 8.5 + d2, { size: 24, weight: 700 }, { color: G.ink });
      const ku = EASE.pen(clamp((t - 249) / 3));
      ctx.fillStyle = G.ink;
      ctx.fillRect(lx, midY + 13 + d2, lw * ku, 2);
      ctx.restore();
    }
    ctx.restore();
  }
  // Texto de la burbuja: aparece 259-262 mientras el tracking se cierra.
  if (t >= 259) {
    // Mismo fundido que S5 (259-263): S5 sigue desde f262 con alfa 0,75.
    const k = clamp((t - 259) / 4);
    const tr = 0.08 * (1 - EASE.ink(k));
    const st = { size: 34, weight: 500, tracking: Math.round(tr * 1000) / 1000 };
    const tw = textWidth(ctx, BUBBLE_TEXT, st);
    ctx.save();
    ctx.globalAlpha *= k;
    drawText(ctx, BUBBLE_TEXT, R.x + R.w / 2 - tw / 2, R.y + R.h / 2 + 12.5, st, { color: "#ffffff" });
    ctx.restore();
  }
  ctx.restore();
}

function drawTop(ctx, t) {
  if (t < 199) return;
  for (const [ph, prog] of PHRASES) drawPhrase(ctx, ph, t, prog);
  // Pulso del punto en la frase: anillo al aterrizar (210) y en el downbeat (224).
  if (dotState(t) && t < T.dotGo) {
    ring(ctx, t, T.instr, P0.cx, P0.cy, P0.d, C.accent);
    ring(ctx, t, T.focus, P0.cx, P0.cy, P0.d, C.accent);
  }
  drawActor(ctx, t);
  drawDotNow(ctx, t);
}

// ─── lectura, golpes, blur, grade ────────────────────────────────────────────
function motion(t) {
  if (t < 206) return { shutter: 1, samples: 16 }; // párpado + pico del pull-back
  if (t < T.whip) return { shutter: 0.75, samples: 12 };
  if (t < T.bub) return { shutter: 1, samples: 16 }; // latigazo
  return { shutter: 0.75, samples: 12 };
}

// Durante el párpado (191-199) el grade lo pesa S3 por el área abierta (es la
// escena que produce el cambio de campo, tratamiento 2.7): S4 devuelve null y
// gana el peso de S3. S4 es dueña del campo desde f199.
function field(t) {
  return t < 199 ? null : { papel: 1 };
}

export default {
  id: "s4",
  start: START,
  end: END,
  draw,
  drawTop,
  topEnd: END,
  motion,
  field,
  panBoundary,
  // Para el banco de prueba (medir R/L con glyphsStill).
  __probe: { PH, PROG, actorRect, camAt, BTN, BUBBLE, dotState },
  phrases: [{ id: "Una instrucción.", words: 2, R: 214, L: 243 }],
  hits: [
    { f: 196, level: "H2", kind: "Alex en negrita (lectura)" },
    { f: 205, level: "H3", kind: "Una (KT)" },
    { f: 206.5, level: "H3", kind: "casilla del informe" },
    { f: 210, level: "H2", kind: "instrucción. (KT) + punto" },
    { f: 213.5, level: "H3", kind: "chip de ejemplo" },
    { f: 217, level: "H3", kind: "toque del chip (TC)" },
    { f: 224, level: "H1", kind: "foco + Previsualizar cambios + punch 2" },
    { f: 227.5, level: "H3", kind: "toque de Previsualizar" },
    { f: 234.5, level: "H3", kind: "primera propuesta aterriza" },
    { f: 238, level: "H2", kind: "Aplicar a 12 informes" },
    { f: 245, level: "H3", kind: "Aplicar: punteado a continuo; CA 3" },
    { f: 255, level: "H3", kind: "el latigazo aterriza" },
  ],
};
