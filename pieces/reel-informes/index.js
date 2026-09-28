// Reel 3 · Informes (vertical nativo, ~19,5 s).
//
// "Generás los informes, los corregís de una vez, o uno a mano."
// Verificado contra la app (app/src):
//   - Generar informes: "Generar informes (6)", cada alumno queda "Listo".
//   - Edición en lote (/informes/editar): "Qué querés cambiar" Contenido o
//     Estilo, "Instrucción" con ejemplos ("Mencionar el proyecto de la
//     huerta"), "Previsualizar cambios", el cambio de cada informe resaltado
//     en verde, "Aplicar a 6 informes", "¿Aplicar los cambios a 6 informes?",
//     "Aplicar", cada uno "Aplicado".
//   - Edición a mano: "Editar" en el informe, "Guardar", queda "Editado".
// Datos ficticios.

import { C, E, p, lerp, clamp, RW, RH, U, BEAT, backdrop, stage, floatShadow, drawPlaca, placaStory, PLACA_DOT } from "../reel-comun/comun.js";
import { EndCard } from "../../shared/endcard.js";
import { makePhrase, drawPhrase, drawDot, golpe, tinta, evaporar, envio } from "../../shared/phrase.js";
import { SPR, spr } from "../../shared/system.js";
import { flightV } from "../../shared/punto.js";
import { gradeOf } from "../../shared/compose.js";
import { icon } from "../../shared/ui.js";
import { emit } from "../../engine/env.js";
import { hash1, TAU } from "../../engine/math.js";
import { txt, tw, fillRR, tag, avatarN } from "../tutorial/app-ui.js";
import { wrap } from "../tutorial/screens.js";

const F = 30;
const HOOK = BEAT;
const ACC = C.accent;
const NOMBRES = ["Alex", "Noa", "Sasha", "Dani", "Eli", "Juli"];
const BASE_TXT = (n) => `${n} participa con entusiasmo de las propuestas de la sala.`;
const INS = "En el proyecto de la huerta propone ideas.";

// ─── componentes (px CSS) ────────────────────────────────────────────────────
export const MW = 180;
export const MH = 124;
// Informe en miniatura. ins 0..1 muestra la frase agregada (en verde, como la
// vista previa); estado: "Listo" | "Aplicado" | "Editado".
export function mini(ctx, x, y, i, { ins = 0, estado = "Listo", tagK = 1 } = {}) {
  floatShadow(ctx, x, y, MW, MH, 12, 1);
  fillRR(ctx, x, y, MW, MH, 12, "#ffffff", C.border, 1);
  const n = NOMBRES[i];
  avatarN(ctx, x + 22, y + 22, 24, `${n} Ejemplo`);
  txt(ctx, `Ejemplo, ${n}`, x + 40, y + 26, 11.5, 700, C.ink);
  if (tagK > 0.01) {
    const tone = estado === "Aplicado" ? "success" : estado === "Editado" ? "info" : "success";
    ctx.save();
    ctx.translate(x + 12, y + 42);
    ctx.scale(tagK, tagK);
    tag(ctx, 0, 0, estado, tone, { h: 18, fs: 9.5 });
    ctx.restore();
  }
  const lines = wrap(BASE_TXT(n), 9.5, 400, MW - 24);
  let ly = y + 76;
  lines.slice(0, 2).forEach((l) => {
    txt(ctx, l, x + 12, ly, 9.5, 400, C.inkSoft);
    ly += 13;
  });
  if (ins > 0.01) {
    const k = E.outCubic(clamp(ins));
    const il = wrap(INS, 9.5, 600, MW - 30);
    ctx.save();
    ctx.globalAlpha *= k;
    fillRR(ctx, x + 9, ly - 10, (MW - 18) * k, il.length * 13 + 5, 4, C.successSoft);
    il.forEach((l, j) => txt(ctx, l, x + 12, ly + j * 13, 9.5, 600, C.success));
    ctx.restore();
  }
}
const gridPos = (i) => [-MW - 6 + (i % 2) * (MW + 12), -((MH + 12) * 3 - 12) / 2 + Math.floor(i / 2) * (MH + 12)];

function genCard(ctx, press) {
  const w = 372;
  const x = -w / 2;
  const h = 150;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 16, 1.3);
  fillRR(ctx, x, y, w, h, 16, "#ffffff", C.border, 1);
  fillRR(ctx, x + 16, y + 16, w - 32, 52, 12, C.accentSoft, ACC, 1);
  icon(ctx, "sparkles", x + 38, y + 42, 17, { color: C.accentInk, width: 2 });
  txt(ctx, "6 de 6 formularios completos", x + 58, y + 40, 12.5, 700, C.accentInk);
  txt(ctx, "1 informe = 1 crédito", x + 58, y + 56, 10.5, 400, C.accentInk);
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(0, y + 106);
  ctx.scale(s, s);
  fillRR(ctx, -(w - 32) / 2, -24, w - 32, 48, 12, ACC);
  const label = "Generar informes (6)";
  icon(ctx, "sparkles", -tw(label, 14.5, 600) / 2 - 8, 0, 15, { color: "#fff", width: 2 });
  txt(ctx, label, -tw(label, 14.5, 600) / 2 + 6, 5, 14.5, 600, "#ffffff");
  ctx.restore();
  return { btn: { x: x + 16, y: y + 82, w: w - 32, h: 48 } };
}

const EJ = ["Agregar que visitaron el museo", "Mencionar el proyecto de la huerta", "Sumar que participaron del acto del 25 de mayo"];
function compositor(ctx, { typed, chipOn, press }) {
  const w = 390;
  const x = -w / 2;
  const h = 430;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  const ix = x + 18;
  const iw = w - 36;
  txt(ctx, "Editar en lote", ix, y + 34, 17, 800, C.ink, "left", -0.02);
  txt(ctx, "Alumnos: 6 de 6", ix, y + 52, 11, 400, C.inkMute);
  txt(ctx, "QUÉ QUERÉS CAMBIAR", ix, y + 80, 10, 700, C.inkMute, "left", 0.08);
  const mw = (iw - 8) / 2;
  [["contenido", "Agrega lo que pidas donde", "corresponda, sin tocar el resto."], ["estilo", "Cambia solo la redacción:", "los mismos hechos, dicho distinto."]].forEach(([m, d1, d2], i) => {
    const on = i === 0;
    const bx = ix + i * (mw + 8);
    fillRR(ctx, bx, y + 90, mw, 70, 12, on ? C.accentSoft : "#ffffff", on ? ACC : C.border, 1);
    txt(ctx, m[0].toUpperCase() + m.slice(1), bx + 12, y + 110, 13, 700, C.ink);
    txt(ctx, d1, bx + 12, y + 128, 9.5, 400, C.inkSoft);
    txt(ctx, d2, bx + 12, y + 141, 9.5, 400, C.inkSoft);
  });
  txt(ctx, "INSTRUCCIÓN", ix, y + 184, 10, 700, C.inkMute, "left", 0.08);
  fillRR(ctx, ix, y + 194, iw, 64, 12, "#ffffff", typed ? ACC : C.border, 1);
  if (typed) txt(ctx, typed, ix + 12, y + 216, 12.5, 400, C.ink);
  else wrap("Por ejemplo: agregar que visitaron el museo de ciencias", 12.5, 400, iw - 24).forEach((l, j) => txt(ctx, l, ix + 12, y + 216 + j * 17, 12.5, 400, C.inkMute));
  let cx = ix;
  let cy = y + 270;
  const R = {};
  EJ.forEach((e, i) => {
    const cw = tw(e, 10.5, 600) + 20;
    if (cx + cw > ix + iw) {
      cx = ix;
      cy += 30;
    }
    const on = chipOn && i === 1;
    fillRR(ctx, cx, cy, cw, 24, 12, on ? C.accentSoft : C.surface, on ? ACC : C.border, 1);
    txt(ctx, e, cx + 10, cy + 16, 10.5, 600, on ? C.accentInk : C.inkSoft);
    R[`ej${i}`] = { x: cx, y: cy, w: cw, h: 24 };
    cx += cw + 6;
  });
  const by = y + h - 76;
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(0, by + 24);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -24, iw, 48, 12, typed ? ACC : "#e8b79c");
  txt(ctx, "Previsualizar cambios", 0, 5, 14, 600, "#ffffff", "center");
  ctx.restore();
  txt(ctx, "Se va a proponer un texto nuevo para 6 informes", 0, y + h - 14, 10.5, 400, C.inkMute, "center");
  R.btn = { x: ix, y: by, w: iw, h: 48 };
  return R;
}

function aplicarBtn(ctx, press, label = "Aplicar a 6 informes") {
  const w = 372;
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.scale(s, s);
  fillRR(ctx, -w / 2, -24, w, 48, 12, ACC);
  icon(ctx, "check", -tw(label, 14.5, 600) / 2 - 9, 0, 15, { color: "#fff", width: 2.6 });
  txt(ctx, label, -tw(label, 14.5, 600) / 2 + 6, 5, 14.5, 600, "#ffffff");
  ctx.restore();
  return { x: -w / 2, y: -24, w, h: 48 };
}

function confirmDlg(ctx, press) {
  const w = 340;
  const h = 170;
  const x = -w / 2;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 2);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  txt(ctx, "¿Aplicar los cambios a 6 informes?", x + 20, y + 36, 14.5, 800, C.ink);
  wrap("Se guarda una versión nueva de cada informe y se rehace el .docx. Podés deshacerlo desde el historial.", 11, 400, w - 40).forEach((l, j) => txt(ctx, l, x + 20, y + 60 + j * 16, 11, 400, C.inkSoft));
  const aw = tw("Aplicar", 13, 700) + 32;
  const s = 1 - 0.05 * press;
  ctx.save();
  ctx.translate(x + w - 20 - aw / 2, y + h - 34);
  ctx.scale(s, s);
  fillRR(ctx, -aw / 2, -17, aw, 34, 10, ACC);
  txt(ctx, "Aplicar", 0, 5, 13, 700, "#ffffff", "center");
  ctx.restore();
  const cw = tw("Cancelar", 13, 600) + 28;
  fillRR(ctx, x + w - 20 - aw - 8 - cw, y + h - 51, cw, 34, 10, "#ffffff", C.borderStrong, 1);
  txt(ctx, "Cancelar", x + w - 20 - aw - 8 - cw / 2, y + h - 29, 13, 600, C.ink, "center");
  return { x: x + w - 20 - aw, y: y + h - 51, w: aw, h: 34 };
}

// El informe abierto, con edición a mano.
const VIEW_P1 = "Alex participa con entusiasmo de las propuestas de la sala y respeta los acuerdos del grupo.";
const VIEW_P2 = "En el proyecto de la huerta propone ideas y ayuda a sus compañeros a organizarse.";
function viewer(ctx, { editing, pressEditar, pressGuardar, word, caret, editado }) {
  const w = 400;
  const x = -w / 2;
  const h = 420;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.5);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", editing ? ACC : C.border, editing ? 1.6 : 1);
  avatarN(ctx, x + 36, y + 38, 36, "Alex Ejemplo");
  txt(ctx, "Ejemplo, Alex", x + 62, y + 36, 16, 800, C.ink);
  txt(ctx, editado ? "Generado hace 5 min · editado hace un momento" : editing ? "Editando el informe" : "Generado hace 5 min", x + 62, y + 53, 11, editing ? 700 : 400, editing ? ACC : C.inkMute);
  const R = {};
  const bl = editing ? "Guardar" : "Editar";
  const bw = tw(bl, 12.5, 700) + 40;
  const s = 1 - 0.05 * (editing ? pressGuardar : pressEditar);
  ctx.save();
  ctx.translate(x + w - 18 - bw / 2, y + 36);
  ctx.scale(s, s);
  fillRR(ctx, -bw / 2, -17, bw, 34, 10, editing ? ACC : "#ffffff", editing ? ACC : C.borderStrong, 1);
  icon(ctx, editing ? "check" : "pencil", -bw / 2 + 16, 0, 13, { color: editing ? "#fff" : C.ink, width: 2.2 });
  txt(ctx, bl, -bw / 2 + 28, 4.5, 12.5, 700, editing ? "#ffffff" : C.ink);
  ctx.restore();
  R.btn = { x: x + w - 18 - bw, y: y + 19, w: bw, h: 34 };
  if (editado) tag(ctx, x + 62, y + 64, "Editado", "info", { h: 18, fs: 9.5 });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 90, w, 1);
  txt(ctx, "Formación Personal y Social", x + 22, y + 124, 14, 800, C.ink);
  // Primer renglón con la palabra que se corrige.
  const p1 = VIEW_P1.replace("entusiasmo", word);
  const lines = wrap(p1, 14, 400, w - 44);
  let ly = y + 152;
  lines.forEach((l) => {
    const i = l.indexOf(word);
    if (editing && i >= 0) {
      const pre = tw(l.slice(0, i), 14, 400);
      const ww = tw(word, 14, 400);
      fillRR(ctx, x + 22 + pre - 2, ly - 15, ww + 4, 21, 4, C.accentSoft);
      if (caret) {
        ctx.fillStyle = ACC;
        ctx.fillRect(x + 22 + pre + ww + 1, ly - 15, 2, 20);
      }
    }
    txt(ctx, l, x + 22, ly, 14, 400, C.ink);
    ly += 22;
  });
  ly += 8;
  wrap(VIEW_P2, 14, 400, w - 44).forEach((l) => {
    txt(ctx, l, x + 22, ly, 14, 400, C.ink);
    ly += 22;
  });
  ly += 18;
  txt(ctx, "Matemática", x + 22, ly, 14, 800, C.ink);
  ly += 28;
  wrap("Cuenta hasta diez y compara cantidades en los juegos de mesa.", 14, 400, w - 44).forEach((l) => {
    txt(ctx, l, x + 22, ly, 14, 400, C.ink);
    ly += 22;
  });
  return R;
}

// ─── titulares ───────────────────────────────────────────────────────────────
const Hd = (text, baseline, size = 124) => makePhrase({ text, size, wght: 800, tracking: -0.045, x: 72, baseline, color: C.ink, periodColor: C.accent });
const H1 = [Hd("Generás tus", 360), Hd("informes.", 480)];
const H2 = [Hd("Los corregís", 360, 118), Hd("de una vez.", 480)];
const H3 = [Hd("O uno", 360), Hd("a mano.", 480)];
const HK = [Hd("Seis informes,", 360, 118), Hd("un solo cambio.", 476, 108)];

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
  gen: 18, deal: 24, h2: 90, comp: 88, chip: 126, prev: 144, diff: 156,
  aplicar: 216, dlg: 222, confirma: 234, aplicado: 240, h3: 288, viewIn: 282,
  editar: 324, sel: 330, type0: 336, type1: 354, guardar: 378, exit: 432, placa: 450,
};
export const PLACA_DUR = 97.4;
const DUR = HOOK + T.placa + 118;
export const TAPS = [T.gen, T.chip, T.prev, T.aplicar, T.confirma, T.editar, T.guardar];

// ─── gancho: seis informes con el cambio aplicado, que se rebobinan ─────────
const GRID = { cx: 540, cy: 1040, s: 0.94 };
function hook(ctx, f) {
  backdrop(ctx, f - HOOK);
  HK.forEach((ph, i) => {
    drawPhrase(ctx, ph, f, [evaporar(5 + i * 2, { stagger: 0.2, dur: 5 })]);
    if (ph.period) drawDot(ctx, ph.period.cx, ph.period.cy, ph.period.d, C.accent, { alpha: 1 - p(f, 7 + i * 2, 11 + i * 2) });
  });
  // Los informes se juntan en la pila de la que salen después.
  for (let i = 5; i >= 0; i--) {
    const k = E.inCubic(p(f, 4 + i, 14 + i * 0.5));
    const [gx, gy] = gridPos(i);
    stage(ctx, { cx: lerp(GRID.cx + (gx + MW / 2) * U * GRID.s, 540, k), cy: lerp(GRID.cy + (gy + MH / 2) * U * GRID.s, 1330, k), s: GRID.s * lerp(1, 0.25, k), rot: (hash1(i) - 0.5) * 0.3 * k, alpha: 1 - p(f, 12 + i * 0.5, 17) }, (c) => mini(c, -MW / 2, -MH / 2, i, { ins: 1, estado: "Aplicado" }));
  }
}

// ─── cuadro ──────────────────────────────────────────────────────────────────
function draw(ctx, f) {
  if (f < HOOK) return hook(ctx, f);
  const t = f - HOOK;
  backdrop(ctx, t);
  if (t >= T.placa - 2) {
    drawPlaca(ctx, t, T.placa, PLACA_DUR);
    return;
  }
  headline(ctx, t, H1, 0, 72);
  headline(ctx, t, H2, T.h2, 270, "tinta");
  headline(ctx, t, H3, T.h3, T.exit, "envio");

  // ── A: generar y repartir los seis informes ───────────────────────────────
  if (t < T.deal + 12) {
    const k = E.outCubic(p(t, -12, 2));
    const out = E.inCubic(p(t, T.gen + 2, T.deal + 10));
    const gst = { cx: 540, cy: 1330 + 80 * (1 - k), alpha: k * (1 - out), s: 1 - 0.1 * out };
    stage(ctx, gst, (c) => {
      const R = genCard(c, press(t, T.gen));
      HIT.gen = center(gst, R.btn);
    });
    tapRing(ctx, HIT.gen, t, T.gen);
  }
  // La grilla: se reparte, se corre para el compositor, vuelve con los cambios.
  const compIn = E.inOutCubic(p(t, T.comp, T.comp + 14));
  const compOut = E.inOutCubic(p(t, T.prev + 2, T.diff));
  const gridAway = compIn * (1 - compOut);
  const toView = E.inOutCubic(p(t, T.viewIn, T.viewIn + 18));
  if (t >= T.deal - 2 && t < T.viewIn + 20) {
    for (let i = 0; i < 6; i++) {
      const t0 = T.deal + i * 4;
      const e = spr(t, t0, SPR.settle);
      if (t < t0 - 1) continue;
      const [gx, gy] = gridPos(i);
      const tx = GRID.cx + (gx + MW / 2) * U * GRID.s;
      const ty = GRID.cy + (gy + MH / 2) * U * GRID.s;
      const x0 = HIT.gen ? HIT.gen[0] : 540;
      const y0 = HIT.gen ? HIT.gen[1] : 1330;
      let x = lerp(x0, tx, e);
      let y = lerp(y0, ty, e) - 120 * Math.sin(Math.PI * clamp(e));
      let s = GRID.s * lerp(0.3, 1, e);
      let a = clamp((t - t0 + 1) / 4);
      // Se hunden al fondo mientras está el compositor.
      s *= 1 - 0.18 * gridAway;
      a *= 1 - 0.85 * gridAway;
      y += 60 * gridAway;
      // Alex pasa al frente para abrirse; los demás se van.
      if (t >= T.viewIn) {
        if (i === 0) continue;
        a *= 1 - toView;
        s *= 1 - 0.1 * toView;
      }
      const insK = p(t, T.diff + i * 5, T.diff + i * 5 + 10);
      const aplicado = t >= T.aplicado + i * 4;
      const tagK = aplicado ? spr(t, T.aplicado + i * 4, SPR.slam) : t >= T.aplicado - 8 ? 1 - p(t, T.aplicado - 8, T.aplicado - 2) : spr(t, t0 + 4, SPR.snap);
      stage(ctx, { cx: x, cy: y, s, rot: (hash1(i + 9) - 0.5) * 0.3 * (1 - clamp(e)), alpha: a }, (c) =>
        mini(c, -MW / 2, -MH / 2, i, { ins: insK, estado: aplicado ? "Aplicado" : "Listo", tagK }),
      );
    }
    // Chispa verde en cada informe cuando se aplica.
    if (t >= T.aplicado && t < T.aplicado + 40) {
      emit(ctx, (e) => {
        for (let i = 0; i < 6; i++) {
          const k = p(t, T.aplicado + i * 4, T.aplicado + i * 4 + 12);
          if (k <= 0 || k >= 1) continue;
          const [gx, gy] = gridPos(i);
          const x = GRID.cx + (gx + 18) * U * GRID.s;
          const y = GRID.cy + (gy + 51) * U * GRID.s;
          e.strokeStyle = `rgba(251,146,60,${0.9 * (1 - k)})`;
          e.lineWidth = 4;
          e.beginPath();
          e.arc(x, y, 10 + 50 * E.outCubic(k), 0, TAU);
          e.stroke();
        }
      });
    }
  }

  // ── B: el compositor de la edición en lote ────────────────────────────────
  if (t >= T.comp && t < T.diff + 4) {
    const cst = { cx: 540, cy: 1040 + 90 * (1 - compIn) - 40 * compOut, alpha: compIn * (1 - compOut), s: 0.92 * (1 - 0.1 * compOut) };
    const typed = t >= T.chip ? "Mencionar el proyecto de la huerta".slice(0, Math.round(34 * p(t, T.chip, T.chip + 10))) : "";
    stage(ctx, cst, (c) => {
      const R = compositor(c, { typed, chipOn: t >= T.chip, press: press(t, T.prev) });
      HIT.chip = center(cst, R.ej1);
      HIT.prev = center(cst, R.btn);
    });
    tapRing(ctx, HIT.chip, t, T.chip);
    tapRing(ctx, HIT.prev, t, T.prev);
  }
  // Etiqueta del lote y botón de aplicar debajo de la grilla.
  if (t >= T.diff + 20 && t < T.aplicado + 8) {
    const a = p(t, T.diff + 20, T.diff + 30) * (1 - p(t, T.dlg, T.dlg + 6));
    const bst = { cx: 540, cy: 1478, alpha: a, s: 0.94 };
    stage(ctx, bst, (c) => {
      const r = aplicarBtn(c, press(t, T.aplicar));
      HIT.aplicar = center(bst, r);
    });
    tapRing(ctx, HIT.aplicar, t, T.aplicar);
  }
  if (t >= T.dlg && t < T.confirma + 10) {
    const k = E.outBack ? E.outCubic(p(t, T.dlg, T.dlg + 8)) : 1;
    const out = E.inCubic(p(t, T.confirma + 2, T.confirma + 9));
    ctx.save();
    ctx.fillStyle = `rgba(28,25,23,${0.28 * k * (1 - out)})`;
    ctx.fillRect(-4000, -4000, 12000, 12000);
    ctx.restore();
    const dst = { cx: 540, cy: 1040 + 30 * (1 - k), alpha: k * (1 - out), s: 1.05 };
    stage(ctx, dst, (c) => {
      const r = confirmDlg(c, press(t, T.confirma));
      HIT.confirma = center(dst, r);
    });
    tapRing(ctx, HIT.confirma, t, T.confirma);
  }

  // ── C: uno a mano ─────────────────────────────────────────────────────────
  if (t >= T.viewIn && t < T.exit + 16) {
    const [gx, gy] = gridPos(0);
    const x0 = GRID.cx + (gx + MW / 2) * U * GRID.s;
    const y0 = GRID.cy + (gy + MH / 2) * U * GRID.s;
    const out = E.inCubic(p(t, T.exit, T.exit + 14));
    const vst = { cx: lerp(x0, 540, toView), cy: lerp(y0, 1060, toView), s: lerp(GRID.s * MW / 400, 0.94, toView) * (1 - 0.08 * out), alpha: 1 - out };
    const editing = t >= T.editar && t < T.guardar;
    let word = "entusiasmo";
    if (t >= T.type0) word = "curiosidad".slice(0, Math.round(10 * p(t, T.type0, T.type1)));
    stage(ctx, vst, (c) => {
      if (toView < 1) {
        // Cruce: la miniatura se agranda y cede al informe completo.
        c.save();
        c.globalAlpha *= 1 - p(t, T.viewIn + 2, T.viewIn + 10);
        c.scale(400 / MW, 400 / MW);
        mini(c, -MW / 2, -MH / 2, 0, { ins: 1, estado: "Aplicado" });
        c.restore();
      }
      c.save();
      c.globalAlpha *= p(t, T.viewIn + 6, T.viewIn + 16);
      const R = viewer(c, { editing, pressEditar: press(t, T.editar), pressGuardar: press(t, T.guardar), word: t >= T.sel && t < T.type0 ? "entusiasmo" : word || "", caret: editing && Math.floor(t / 7) % 2 === 0, editado: t >= T.guardar + 4 });
      c.restore();
      HIT.btn = center(vst, R.btn);
    });
    tapRing(ctx, HIT.btn, t, T.editar);
    tapRing(ctx, HIT.btn, t, T.guardar);
  }

  // ── salida: el punto de "a mano." vuela a la placa ────────────────────────
  const pd = H3[1].period;
  if (t >= T.exit + 4 && t < T.placa) {
    const f0 = T.exit + 4;
    const fl = flightV(t, { t0: f0, t1: T.placa, P0: [pd.cx, pd.cy], P1: [pd.cx + 60, pd.cy - 80], P2: [PLACA_DOT.x + 60, PLACA_DOT.y - 40], P3: [PLACA_DOT.x, PLACA_DOT.y], v0: 0, v1: 14 });
    drawDot(ctx, fl.x, fl.y, lerp(pd.d, PLACA_DOT.d, p(t, f0, T.placa)), C.accent);
  } else if (t >= T.exit && t < T.exit + 4) drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent);
}

const BUSY = [[T.gen, T.deal + 30], [T.comp, T.comp + 14], [T.prev, T.diff + 4], [T.dlg, T.dlg + 8], [T.confirma, T.confirma + 10], [T.viewIn, T.viewIn + 18], [T.exit, T.placa]];
function motion(f) {
  if (f < HOOK) return f >= 4 ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
  const t = f - HOOK;
  if (t >= T.placa) return EndCard.motion(placaStory(t, T.placa, PLACA_DUR));
  return BUSY.some(([a, b]) => t >= a && t < b) ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
}

export default {
  id: "reel-informes",
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
