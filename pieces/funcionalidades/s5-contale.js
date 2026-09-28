// Pieza 1, S5 "Contale tu idea." (tratamiento final 3.6), f246-303, Crema.
//
// El mundo Crema entra desde la derecha en el mismo latigazo que se lleva a S4
// (C-P1-14: ox(t) = -1920·whip((t-249)/6), mundo de S5 en ox + 1920). La
// burbuja de la docente llega de S4 en f262 (C-P1-15). Chat a la izquierda:
// avatar, "Pensando…", chip "Generar planificaciones" que al tocarlo se corta
// en tres puntos; los puntos vuelan y se abren como las tres tarjetas del panel
// "Planificaciones · 3" (T12). En f280 S6 se lleva el panel (C-P1-16) y la
// noche derrama desde el teléfono: la frase se invierte adentro del derrame
// (K7) leyendo env.shared.spill = {cx, cy, r} que S6 fija en cada sub-frame.
//
// Frase: "Contale" sube como un mensaje enviado (K1r) sobre la cola del
// latigazo, "tu" pegada 2,5 f después, "idea." en f257 y el punto en f259.
// R = 261, L = 285, evaporación f285-291.

import { env, emit } from "../../engine/env.js";
import { EASE, SPR, spr, ring, punch, minHold } from "../../shared/system.js";
import { makePhrase, drawPhrase, drawDot, envio, bumps, evaporar } from "../../shared/phrase.js";
import { IS_V } from "../../engine/format.js";
import { clipCircle, clipOutsideCircle } from "../../shared/masks.js";
import { clamp } from "../../engine/math.js";
import { COL, T, PANEL } from "./s5-layout.js";
import { drawBack, drawFront } from "./s5-fondo.js";
import { drawPanel, drawPanelLocal } from "./s5-panel.js";
import { drawChat, drawFlights } from "./s5-chat.js";

// ─── tiempo del paneo ────────────────────────────────────────────────────────
// Corrimiento del mundo de S5 (= x del borde del campo, C-P1-14).
export const worldX = (t) => 1920 - 1920 * EASE.whip(clamp((t - T.panStart) / (T.panEnd - T.panStart)));

// ─── frase ───────────────────────────────────────────────────────────────────
const PH_ST = { size: 190, wght: 760, tracking: -0.045, x: 120, color: COL.ink, periodColor: COL.accent };
// En vertical la frase va en dos renglones: "Contale" / "tu idea.".
const LINES = IS_V ? [makePhrase({ ...PH_ST, text: "Contale", baseline: 290 }), makePhrase({ ...PH_ST, text: "tu idea.", baseline: 480 })] : [makePhrase({ ...PH_ST, text: "Contale tu idea.", baseline: 290 })];
export const PHRASE = LINES[LINES.length - 1]; // el renglón con el punto
const N_GLYPHS = LINES.reduce((a, l) => a + l.n, 0);

// La frase se va en f285, antes de que caiga el aviso de S6 (f286,5): si se
// quedara, se leería junto con el aviso como una sola oración.
const H = { contale: 252, tu: 254.5, idea: 257, period: 259, rings: [266, 280], out: 285 };
// K5 comprimido: la capa de pantalla termina en f303, así que 13 glifos y el
// punto se evaporan en 5,45 f (el último termina en f302,45).
const OUT = { stagger: 0.25, dur: 2.2 };

const PROGRAMS = IS_V
  ? [
      [envio(H.contale, 0), bumps([280], 60), evaporar(H.out, OUT)],
      [envio(H.tu, 0), envio(H.idea, 1), bumps([280], 60), evaporar(H.out + LINES[0].n * OUT.stagger, OUT)],
    ]
  : [
      [
        envio(H.contale, 0),
        envio(H.tu, 1),
        envio(H.idea, 2),
        bumps([280], 60), // downbeat de compás en el hold: golpe de peso en el lugar
        evaporar(H.out, OUT),
      ],
    ];
export const PROGRAM = PROGRAMS[PROGRAMS.length - 1];

// Escala del punto: K3 (snap desde 0) en f259 y salida con el último glifo.
function periodState(t) {
  if (t < H.period) return null;
  let s = spr(t, H.period, SPR.snap);
  let a = clamp((t - H.period) / 2);
  let dx = 0;
  let dy = 0;
  const s0 = H.out + N_GLYPHS * OUT.stagger;
  if (t > s0) {
    const k = EASE.accel(clamp((t - s0) / OUT.dur));
    s *= 1 - k;
    a *= 1 - k;
    dx = 0.3 * PHRASE.size * k;
    dy = -14 * k;
  }
  return { s, a, dx, dy };
}

const DAY = { ink: COL.ink, period: COL.accent, emissive: false };
const NIGHT = { ink: COL.nocheInk, period: COL.nochePeriod, emissive: true };

function phraseLayer(ctx, t, pal, spill) {
  LINES.forEach((ph, i) => drawPhrase(ctx, ph, t, PROGRAMS[i], { colorOverride: pal.ink }));
  const P = PHRASE.period;
  const ps = periodState(t);
  if (ps && ps.s > 0.001) {
    const x = P.cx + ps.dx;
    const y = P.cy + ps.dy;
    drawDot(ctx, x, y, P.d, pal.period, { scale: ps.s, alpha: ps.a });
    // En la noche los puntos brillan (capa emisiva, recortada al derrame).
    if (pal.emissive) {
      emit(ctx, (e) => {
        if (spill) clipCircle(e, spill.cx, spill.cy, spill.r);
        e.globalAlpha *= ps.a;
        e.fillStyle = pal.period;
        e.beginPath();
        e.arc(x, y, (P.d / 2) * ps.s, 0, Math.PI * 2);
        e.fill();
      });
    }
  }
  // Un anillo por beat durante el hold.
  for (const R of H.rings) ring(ctx, t, R, P.cx, P.cy, P.d, pal.period);
}

// Caja de la frase con margen para los anillos (5x el punto).
const BOX = { x0: 100, y0: 130, x1: Math.max(...LINES.map((l) => l.x + l.width)) + 72, y1: PHRASE.baseline + 70 };
function circleCovers(sp, b) {
  const far = Math.max(Math.hypot(b.x0 - sp.cx, b.y0 - sp.cy), Math.hypot(b.x1 - sp.cx, b.y0 - sp.cy), Math.hypot(b.x0 - sp.cx, b.y1 - sp.cy), Math.hypot(b.x1 - sp.cx, b.y1 - sp.cy));
  return far <= sp.r;
}
function circleMisses(sp, b) {
  const nx = clamp(sp.cx, b.x0, b.x1);
  const ny = clamp(sp.cy, b.y0, b.y1);
  return Math.hypot(nx - sp.cx, ny - sp.cy) >= sp.r;
}

// Capa de pantalla: la frase, quieta de R a L, con la inversión K7.
function drawTop(ctx, t) {
  if (t < H.contale - 3 || t >= 303) return;
  // Durante el latigazo la frase nueva vive del lado del mundo Crema: el borde
  // del paneo la descubre (la de S4 se evapora del otro lado sin cruzarse).
  const bx = worldX(t);
  if (bx > 0.5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, -4000, 12000, 12000);
    ctx.clip();
    phraseLayer(ctx, t, DAY, null);
    ctx.restore();
    return;
  }
  const sp = env.shared && env.shared.spill;
  if (!sp || !(sp.r > 0) || circleMisses(sp, BOX)) {
    phraseLayer(ctx, t, DAY, null);
    return;
  }
  if (circleCovers(sp, BOX)) {
    phraseLayer(ctx, t, NIGHT, sp);
    return;
  }
  ctx.save();
  clipOutsideCircle(ctx, sp.cx, sp.cy, sp.r);
  phraseLayer(ctx, t, DAY, null);
  ctx.restore();
  ctx.save();
  clipCircle(ctx, sp.cx, sp.cy, sp.r);
  phraseLayer(ctx, t, NIGHT, sp);
  ctx.restore();
}

// ─── mundo ───────────────────────────────────────────────────────────────────
function draw(ctx, t) {
  // Antes del paneo no hay nada; desde f292 el derrame de S6 cubre todo.
  if (t < T.panStart - 1 || t >= T.chatEnd) return;
  const ox = worldX(t);
  const zoom = punch(t, T.handoff);
  drawBack(ctx, t, ox, zoom);
  ctx.save();
  ctx.translate(960, 540);
  ctx.scale(zoom, zoom);
  ctx.translate(-960 + ox, -540);
  if (t < T.handoff) drawPanel(ctx, t);
  drawChat(ctx, t);
  drawFlights(ctx, t);
  ctx.restore();
  drawFront(ctx, t, ox, zoom);
}

// ─── motion blur, grade, lectura, golpes ─────────────────────────────────────
function motion(t) {
  if (t >= T.panStart && t <= T.panEnd) return { shutter: 1, samples: 16 }; // latigazo, 360°
  if (t >= T.launch[0] && t <= T.handoff + 1) return { shutter: 0.75, samples: 16 }; // vuelos T12, 270°
  if (t >= T.avatar && t <= T.handoff + 1) return { shutter: 0.75, samples: 12 }; // panel, pops, tap, 270°
  if (t >= H.out && t <= 303) return { shutter: 0.75, samples: 12 }; // evaporación
  return { shutter: 0.5, samples: 8 };
}

// Papel → Crema por cobertura del paneo; después Crema. S6 devuelve la mezcla
// Crema → Noche del derrame y gana por estar después en la lista.
function field(t) {
  if (t < T.panStart) return null;
  if (t < T.panEnd) {
    const c = (1920 - worldX(t)) / 1920;
    return { papel: 1 - c, crema: c };
  }
  return { crema: 1 };
}

export const phrases = [{ id: "contale", words: 3, R: 261, L: 285, min: minHold(3) }];

export const hits = [
  { f: 252, level: "H2", kind: "word Contale (K1r)" },
  { f: 254.5, level: "H3", kind: "glued word tu (+2.5)" },
  { f: 259, level: "H3", kind: "period pop" },
  { f: 266, level: "H2", kind: "chip tap + period ring" },
  { f: 269.5, level: "H3", kind: "third tile launch" },
  { f: 274, level: "H3", kind: "third card lands" },
  { f: 280, level: "H1", kind: "handoff to S6; punch 3; ring + weight bump" },
];

const sc = {
  id: "s5",
  start: 246,
  end: 303,
  draw,
  drawTop,
  topEnd: 303,
  motion,
  field,
  phrases,
  hits,
  // Para S6 (T13'): el panel vivo en coordenadas de mundo y su rect.
  drawPanel,
  drawPanelLocal,
  panelRect: PANEL,
  worldX,
};

export { drawPanel, drawPanelLocal, PANEL };
export default sc;
