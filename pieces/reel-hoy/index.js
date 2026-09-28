// Reel 5 · Probalo con tu sala (vertical nativo, ~21 s).
//
// La pieza de cierre del embudo: la única con llamado a la acción directo.
// La promesa no es velocidad (al primer informe se llega en cinco pasos:
// sala, alumnos, período con el documento, formulario y generar) sino prueba
// sin riesgo, y el argumento contra "configurar esto es un trabajo" es que no
// se arma nada desde cero: se sube el documento que el jardín ya usa.
//
// Verificado contra la app y el backend:
//   - 3 informes gratis: SIGNUP_BONUS_BASE = 3 (backend/routers/creditos.py),
//     acreditados por trigger SQL al crear la cuenta.
//   - Sin tarjeta: el alta pide email y contraseña o Google; para generar se
//     exige email confirmado y saldo; el pago aparece recién al comprar
//     créditos (MercadoPago).
//   - "Crear nueva sala": "Datos del grupo", "Nombre de la sala", "Sección",
//     "Turno", botón "Crear sala".
//   - "Alumnos de <sala>": "N en total · <sección> · Turno <turno>", botón
//     "Agregar alumno"; se cargan de a uno.
//   - Nuevo período: el documento pedagógico (reel 2).
//   - Generar: "6 de 6 formularios completos", "1 informe = 1 crédito",
//     "Seleccionar todos", "3 seleccionados", casilla por alumno con "listo",
//     "Generar informes (3)", "Vas a usar 3 créditos de tu balance (tenés 3
//     disponibles)."
// Datos ficticios.

import { C, E, p, lerp, clamp, RW, RH, U, BEAT, backdrop, stage, floatShadow, drawPlaca, placaStory, PLACA_DOT } from "../reel-comun/comun.js";
import { EndCard } from "../../shared/endcard.js";
import { makePhrase, drawPhrase, drawDot, golpe, tinta, evaporar, envio } from "../../shared/phrase.js";
import { SPR, spr } from "../../shared/system.js";
import { flightV } from "../../shared/punto.js";
import { gradeOf } from "../../shared/compose.js";
import { icon } from "../../shared/ui.js";
import { TAU } from "../../engine/math.js";
import { txt, tw, fillRR, tag, avatarN, checkbox } from "../tutorial/app-ui.js";
import { formCard, pdfSheet, uploadCard } from "../reel-formularios/index.js";
import { mini, MW, MH } from "../reel-informes/index.js";

const F = 30;
const HOOK = BEAT;
const ACC = C.accent;
const SALA = "Sala Girasol";
const NOMBRES = ["Alex", "Noa", "Sasha", "Dani", "Eli", "Juli"];

// ─── componentes (px CSS) ────────────────────────────────────────────────────
function field(ctx, x, y, w, label, value, { focus = false, caret = false, select = false } = {}) {
  txt(ctx, label, x, y, 11.5, 600, C.inkSoft);
  fillRR(ctx, x, y + 8, w, 40, 10, "#ffffff", focus ? ACC : C.borderStrong, focus ? 1.6 : 1);
  if (value) txt(ctx, value, x + 12, y + 33, 13.5, 500, C.ink);
  if (caret) {
    ctx.fillStyle = ACC;
    ctx.fillRect(x + 13 + (value ? tw(value, 13.5, 500) : 0), y + 18, 2, 20);
  }
  if (select) icon(ctx, "chevron-down", x + w - 18, y + 28, 13, { color: C.inkMute, width: 2 });
}

// "Crear nueva sala".
function salaCard(ctx, { typed, caret, press }) {
  const w = 390;
  const x = -w / 2;
  const h = 340;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  const ix = x + 20;
  const iw = w - 40;
  txt(ctx, "Crear nueva sala", ix, y + 36, 19, 800, C.ink, "left", -0.02);
  txt(ctx, "Datos básicos, personalización y jardín", ix, y + 55, 11.5, 400, C.inkMute);
  txt(ctx, "Datos del grupo", ix, y + 90, 14, 800, C.ink);
  field(ctx, ix, y + 114, iw, "Nombre de la sala", typed, { focus: caret !== null, caret });
  const hw = (iw - 12) / 2;
  field(ctx, ix, y + 180, hw, "Sección", typed.length >= SALA.length ? "Sala de 5" : "");
  field(ctx, ix + hw + 12, y + 180, hw, "Turno", "Mañana", { select: true });
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(0, y + h - 44);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -24, iw, 48, 12, typed.length >= SALA.length ? ACC : "#e8b79c");
  const label = "Crear sala";
  icon(ctx, "plus", -tw(label, 14.5, 600) / 2 - 9, 0, 15, { color: "#fff", width: 2.5 });
  txt(ctx, label, -tw(label, 14.5, 600) / 2 + 6, 5, 14.5, 600, "#ffffff");
  ctx.restore();
  return { btn: { x: ix, y: y + h - 68, w: iw, h: 48 } };
}

// "Alumnos de Sala Girasol": se cargan de a uno.
function alumnosCard(ctx, { rowK, press }) {
  const w = 390;
  const x = -w / 2;
  const h = 470;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, C.surface, C.border, 1);
  const ix = x + 18;
  const iw = w - 36;
  const n = NOMBRES.filter((_, i) => rowK(i) > 0.5).length;
  txt(ctx, `Alumnos de ${SALA}`, ix, y + 38, 19, 800, C.ink, "left", -0.02);
  txt(ctx, `${n} en total · Sala de 5 · Turno Mañana`, ix, y + 57, 11, 400, C.inkMute);
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(0, y + 92);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -21, iw, 42, 12, ACC);
  const label = "Agregar alumno";
  icon(ctx, "user-plus", -tw(label, 13.5, 600) / 2 - 10, 0, 15, { color: "#fff", width: 2.2 });
  txt(ctx, label, -tw(label, 13.5, 600) / 2 + 6, 5, 13.5, 600, "#ffffff");
  ctx.restore();
  const R = { btn: { x: ix, y: y + 71, w: iw, h: 42 } };
  const ly = y + 128;
  fillRR(ctx, ix, ly, iw, 6 * 54, 14, "#ffffff", C.border, 1);
  NOMBRES.forEach((nm, i) => {
    const k = clamp(rowK(i));
    if (k <= 0.001) return;
    const ry = ly + i * 54;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, -10 * (1 - E.outCubic(k)));
    avatarN(ctx, ix + 34, ry + 27, 40, `${nm} Ejemplo`);
    txt(ctx, `Ejemplo, ${nm}`, ix + 64, ry + 32, 14, 700, C.ink);
    icon(ctx, "pencil", ix + iw - 22, ry + 27, 14, { color: C.inkMute, width: 2 });
    if (i < 5) {
      ctx.fillStyle = C.border;
      ctx.fillRect(ix, ry + 54, iw, 1);
    }
    ctx.restore();
  });
  return R;
}

// Generar: la docente elige tres, lo que cubren sus créditos gratis.
function generarCard(ctx, { sel, press }) {
  const w = 390;
  const x = -w / 2;
  const h = 560;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, C.surface, C.border, 1);
  const ix = x + 16;
  const iw = w - 32;
  txt(ctx, "Generar informes", ix, y + 36, 19, 800, C.ink, "left", -0.02);
  fillRR(ctx, ix, y + 52, iw, 56, 14, C.accentSoft, ACC, 1);
  fillRR(ctx, ix + 12, y + 60, 40, 40, 12, ACC);
  icon(ctx, "sparkles", ix + 32, y + 80, 18, { color: "#fff", width: 2 });
  txt(ctx, "6 de 6 formularios completos", ix + 62, y + 77, 13, 700, C.accentInk);
  txt(ctx, "1 informe = 1 crédito", ix + 62, y + 94, 11, 400, C.accentInk);
  const n = sel.filter(Boolean).length;
  txt(ctx, "Seleccionar todos", ix, y + 134, 13, 600, ACC);
  txt(ctx, `${n} seleccionado${n !== 1 ? "s" : ""}`, ix + iw, y + 134, 12, 400, C.inkMute, "right");
  const ly = y + 148;
  const rh = 50;
  fillRR(ctx, ix, ly, iw, 6 * rh, 14, "#ffffff", C.border, 1);
  const R = {};
  NOMBRES.forEach((nm, i) => {
    const ry = ly + i * rh;
    checkbox(ctx, ix + 16, ry + 15, 20, sel[i] ? 1 : 0);
    avatarN(ctx, ix + 66, ry + 25, 32, `${nm} Ejemplo`);
    txt(ctx, `Ejemplo, ${nm}`, ix + 90, ry + 22, 13, 700, C.ink);
    tag(ctx, ix + 90, ry + 28, "listo", "success", { h: 16, fs: 9.5 });
    if (i < 5) {
      ctx.fillStyle = C.border;
      ctx.fillRect(ix, ry + rh, iw, 1);
    }
    R[`row${i}`] = { x: ix, y: ry, w: iw, h: rh };
  });
  const by = ly + 6 * rh + 16;
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(0, by + 26);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -26, iw, 52, 12, n ? ACC : "#e8b79c");
  const label = `Generar informes (${n})`;
  icon(ctx, "sparkles", -tw(label, 15, 600) / 2 - 8, 0, 16, { color: "#fff", width: 2 });
  txt(ctx, label, -tw(label, 15, 600) / 2 + 6, 5, 15, 600, "#ffffff");
  ctx.restore();
  R.btn = { x: ix, y: by, w: iw, h: 52 };
  const note = `Vas a usar ${n} crédito${n !== 1 ? "s" : ""} de tu balance (tenés 3 disponibles).`;
  txt(ctx, note, 0, by + 76, 11, 400, C.inkMute, "center");
  return R;
}

// ─── titulares ───────────────────────────────────────────────────────────────
const Hd = (text, baseline, size = 124) => makePhrase({ text, size, wght: 800, tracking: -0.045, x: 72, baseline, color: C.ink, periodColor: C.accent });
const HK = [Hd("Probalo", 360), Hd("con tu sala.", 480)];
const H1 = [Hd("Tu sala,", 360), Hd("tus alumnos.", 480, 118)];
const H2 = [Hd("Subís lo que", 360, 118), Hd("ya tenés.", 480)];
const H3 = [Hd("Marcás", 360), Hd("y generás.", 480)];
const H4 = [Hd("3 informes,", 360), Hd("gratis.", 480)];

function headline(ctx, t, lines, tin, tout, preset = "golpe") {
  if (t < tin - 2 || t > tout + 14) return;
  lines.forEach((ph, i) => {
    const h = tin + i * 5;
    const enter = preset === "tinta" ? tinta(h, { stagger: 0.6 }) : preset === "envio" ? envio(h) : golpe(h);
    drawPhrase(ctx, ph, t, [enter, evaporar(tout + i * 2, { stagger: 0.35, dur: 5 })]);
    if (ph.period && t < tout + 2) drawDot(ctx, ph.period.cx, ph.period.cy, ph.period.d, C.accent, { scale: spr(t, h + 2, SPR.slam), alpha: 1 - p(t, tout, tout + 4) });
  });
}
function tapRing(ctx, pt, t, tc) {
  const k = p(t, tc, tc + 12);
  if (!pt || k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha *= 0.6 * (1 - k);
  ctx.beginPath();
  ctx.arc(pt[0], pt[1], lerp(10, 70, E.outCubic(k)), 0, TAU);
  ctx.strokeStyle = ACC;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}
const HIT = {};
const sp = (st, x, y) => [st.cx + x * U * (st.s ?? 1), st.cy + y * U * (st.s ?? 1)];
const center = (st, r) => sp(st, r.x + r.w / 2, r.y + r.h / 2);
const press = (t, tc) => (t >= tc - 3 && t < tc + 5 ? 1 - Math.abs(t - tc) / 5 : 0);

// ─── tiempo (frames desde el fin del gancho, grilla de 18/9) ─────────────────
const T = {
  type0: 6, type1: 30, crear: 45, alumnos: 54, add: 63, rows: 66,
  h2: 108, up: 108, drop: 144, genForm: 171, form: 189,
  h3: 216, chip: 234, genIn: 261, sel0: 279, sel1: 288, sel2: 297, generar: 315,
  deal: 321, h4: 342, exit: 441, placa: 459,
};
export const PLACA_DUR = 97.4;
// La placa se sostiene más: suma la línea de los informes gratis.
const DUR = HOOK + T.placa + 150;
export const TAPS = [T.crear, T.add, T.genForm, T.chip, T.sel0, T.sel1, T.sel2, T.generar];

const CY = 1060;
const SHEET_START = { cx: 830, cy: 820, s: 0.62, rot: 0.16 };
// Los tres informes, en abanico.
const fanPos = (i) => ({ cx: 540 + (i - 1) * 290, cy: 1000 + Math.abs(i - 1) * 40, rot: (i - 1) * 0.09 });

// ─── gancho: los tres informes listos se rebobinan hasta la sala vacía ──────
function hook(ctx, f) {
  backdrop(ctx, f - HOOK);
  HK.forEach((ph, i) => {
    drawPhrase(ctx, ph, f, [evaporar(5 + i * 2, { stagger: 0.2, dur: 5 })]);
    if (ph.period) drawDot(ctx, ph.period.cx, ph.period.cy, ph.period.d, C.accent, { alpha: 1 - p(f, 7 + i * 2, 11 + i * 2) });
  });
  for (let i = 2; i >= 0; i--) {
    const k = E.inCubic(p(f, 3 + i, 13 + i * 0.5));
    const fp = fanPos(i);
    stage(ctx, { cx: lerp(fp.cx, 540, k), cy: lerp(fp.cy, 1250, k), s: lerp(1.05, 0.3, k), rot: fp.rot * (1 - k), alpha: 1 - p(f, 11 + i * 0.5, 16) }, (c) => mini(c, -MW / 2, -MH / 2, i));
  }
  const fk = E.outCubic(p(f, 9, 18));
  stage(ctx, { cx: 540, cy: CY + 80 * (1 - fk), s: 0.9, alpha: fk }, (c) => salaCard(c, { typed: "", caret: null, press: 0 }));
}

// ─── cuadro ──────────────────────────────────────────────────────────────────
function draw(ctx, f) {
  if (f < HOOK) return hook(ctx, f);
  const t = f - HOOK;
  backdrop(ctx, t);
  if (t >= T.placa - 2) {
    drawPlaca(ctx, t, T.placa, PLACA_DUR, { cta: "3 informes gratis · sin tarjeta" });
    return;
  }
  headline(ctx, t, H1, 0, 102);
  headline(ctx, t, H2, T.h2, 210, "tinta");
  headline(ctx, t, H3, T.h3, 336);
  headline(ctx, t, H4, T.h4, T.exit, "envio");

  // ── A: la sala y los alumnos ──────────────────────────────────────────────
  if (t < T.alumnos + 14) {
    const out = E.inCubic(p(t, T.alumnos - 4, T.alumnos + 8));
    const typed = SALA.slice(0, Math.round(SALA.length * p(t, T.type0, T.type1)));
    const sst = { cx: 540, cy: CY, s: 0.9 * (1 - 0.06 * out), alpha: 1 - out };
    stage(ctx, sst, (c) => {
      const R = salaCard(c, { typed, caret: t < T.crear && Math.floor(t / 7) % 2 === 0, press: press(t, T.crear) });
      HIT.crear = center(sst, R.btn);
    });
    tapRing(ctx, HIT.crear, t, T.crear);
  }
  if (t >= T.alumnos - 2 && t < T.up + 16) {
    const k = E.outCubic(p(t, T.alumnos, T.alumnos + 14));
    const out = E.inCubic(p(t, T.up - 6, T.up + 10));
    const ast = { cx: 540, cy: CY + 70 * (1 - k), s: 0.84 * lerp(0.94, 1, k) * (1 - 0.06 * out), alpha: k * (1 - out) };
    stage(ctx, ast, (c) => {
      const R = alumnosCard(c, { rowK: (i) => p(t, T.rows + i * 5, T.rows + i * 5 + 6), press: press(t, T.add) });
      HIT.add = center(ast, R.btn);
    });
    tapRing(ctx, HIT.add, t, T.add);
  }

  // ── B: el documento que el jardín ya usa ──────────────────────────────────
  if (t >= T.up && t < T.form + 16) {
    const inK = E.outCubic(p(t, T.up + 4, T.up + 18));
    const out = E.inCubic(p(t, T.form - 4, T.form + 10));
    const ust = { cx: 540, cy: CY + 90 * (1 - inK), s: 0.9, alpha: inK * (1 - out) };
    stage(ctx, ust, (c) => {
      const R = uploadCard(c, { tipo: 1, fileK: p(t, T.drop, T.drop + 8), press: press(t, T.genForm), generating: t >= T.genForm, spin: t * 0.25 });
      HIT.genForm = center(ust, R.btn);
      HIT.drop = center(ust, R.drop);
    });
    if (t < T.drop + 4) {
      const u = E.inOutCubic(p(t, T.up + 10, T.drop));
      const to = HIT.drop ?? [540, 1100];
      stage(ctx, {
        cx: lerp(SHEET_START.cx, to[0], u),
        cy: lerp(SHEET_START.cy, to[1], u) - 140 * Math.sin(Math.PI * u),
        s: lerp(SHEET_START.s, 0.14, u),
        rot: lerp(SHEET_START.rot, 0, u),
        alpha: p(t, T.up + 2, T.up + 10) * (1 - p(t, T.drop - 2, T.drop + 2)),
      }, (c) => pdfSheet(c, 1.4));
    }
    tapRing(ctx, HIT.genForm, t, T.genForm);
  }

  // ── C: marca y genera ─────────────────────────────────────────────────────
  if (t >= T.form && t < T.genIn + 16) {
    const fk = E.outCubic(p(t, T.form + 4, T.form + 20));
    const out = E.inCubic(p(t, T.genIn - 6, T.genIn + 10));
    const fst = { cx: 540, cy: CY + 70 * (1 - fk), s: 0.84 * lerp(0.9, 1, fk) * (1 - 0.06 * out), alpha: fk * (1 - out) };
    stage(ctx, fst, (c) => {
      const R = formCard(c, { sel: [0, t >= T.chip ? 0 : null, null], stripDone: { active: 0, ok: (i) => i > 0 && i < 4 }, activeInd: t < T.chip + 9 ? 1 : -1 });
      if (R.chip1_0) HIT.chip = center(fst, R.chip1_0);
    });
    tapRing(ctx, HIT.chip, t, T.chip);
  }
  const gOut = E.inCubic(p(t, T.deal + 6, T.deal + 22));
  if (t >= T.genIn && t < T.deal + 24) {
    const gk = E.outCubic(p(t, T.genIn + 4, T.genIn + 18));
    const gst = { cx: 540, cy: 1030 + 70 * (1 - gk), s: 0.8 * (1 - 0.08 * gOut), alpha: gk * (1 - gOut) };
    const sel = [t >= T.sel0, t >= T.sel1, t >= T.sel2, false, false, false];
    stage(ctx, gst, (c) => {
      const R = generarCard(c, { sel, press: press(t, T.generar) });
      HIT.sel0 = center(gst, { ...R.row0, w: 40 });
      HIT.sel1 = center(gst, { ...R.row1, w: 40 });
      HIT.sel2 = center(gst, { ...R.row2, w: 40 });
      HIT.generar = center(gst, R.btn);
    });
    tapRing(ctx, HIT.sel0, t, T.sel0);
    tapRing(ctx, HIT.sel1, t, T.sel1);
    tapRing(ctx, HIT.sel2, t, T.sel2);
    tapRing(ctx, HIT.generar, t, T.generar);
  }
  // Los tres informes salen del botón y quedan en abanico.
  if (t >= T.deal - 1 && t < T.exit + 16) {
    const out = E.inCubic(p(t, T.exit, T.exit + 14));
    for (let i = 0; i < 3; i++) {
      const t0 = T.deal + i * 5;
      if (t < t0 - 1) continue;
      const e = spr(t, t0, SPR.settle);
      const fp = fanPos(i);
      const from = HIT.generar ?? [540, 1400];
      stage(ctx, {
        cx: lerp(from[0], fp.cx, e),
        cy: lerp(from[1], fp.cy, e) - 160 * Math.sin(Math.PI * clamp(e)) + 40 * out,
        s: lerp(0.3, 1.05, e) * (1 - 0.1 * out),
        rot: fp.rot * clamp(e),
        alpha: clamp((t - t0 + 1) / 4) * (1 - out),
      }, (c) => mini(c, -MW / 2, -MH / 2, i, { tagK: spr(t, t0 + 6, SPR.snap) }));
    }
  }

  // ── salida: el punto de "gratis." vuela a la placa ────────────────────────
  const pd = H4[1].period;
  if (t >= T.exit + 4 && t < T.placa) {
    const f0 = T.exit + 4;
    const fl = flightV(t, { t0: f0, t1: T.placa, P0: [pd.cx, pd.cy], P1: [pd.cx + 60, pd.cy - 80], P2: [PLACA_DOT.x + 60, PLACA_DOT.y - 40], P3: [PLACA_DOT.x, PLACA_DOT.y], v0: 0, v1: 14 });
    drawDot(ctx, fl.x, fl.y, lerp(pd.d, PLACA_DOT.d, p(t, f0, T.placa)), C.accent);
  } else if (t >= T.exit && t < T.exit + 4) drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent);
}

const BUSY = [[T.alumnos - 4, T.alumnos + 14], [T.up - 6, T.drop + 4], [T.form - 4, T.form + 20], [T.genIn - 6, T.genIn + 18], [T.deal - 1, T.deal + 30], [T.exit, T.placa]];
function motion(f) {
  if (f < HOOK) return f >= 3 ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
  const t = f - HOOK;
  if (t >= T.placa) return EndCard.motion(placaStory(t, T.placa, PLACA_DUR));
  return BUSY.some(([a, b]) => t >= a && t < b) ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
}

export default {
  id: "reel-hoy",
  width: RW,
  height: RH,
  fps: F,
  duration: DUR,
  scenes: [],
  draw,
  motion,
  grade: (f) => gradeOf([], f, { bar: 1e9 }),
};
export { T, HOOK };
