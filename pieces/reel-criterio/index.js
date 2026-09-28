// Reel 4 · El criterio es tuyo (vertical nativo, ~23 s).
//
// La objeción de fondo: "¿el informe sigue siendo mío?". No se discute: se
// muestra resuelta. La docente manda al principio (marca lo que observa), en
// el medio (revisa cada cambio antes de aplicarlo y elige a cuáles) y al
// final (corrige a mano y descarga cuando está listo).
//
// Lo que NO se dice: que el texto no se toca solo. Después de generar hay una
// pasada automática de redacción (services/informe_cleanup). Lo que es suyo es
// qué se dice de cada chico; cómo está escrito lo resuelve la herramienta.
//
// Verificado contra la app (app/src):
//   - Formulario del período: sugerencias por indicador, "listo" al elegir.
//   - Edición en lote, vista previa (components/informes/edicion/preview-lote):
//     tag del modo ("Contenido") y la instrucción; una tarjeta por alumno con
//     checkbox, lo agregado en verde; las propuestas llegan todas marcadas y
//     la docente desmarca; "Aplicar a N informes" y "Descartar"; después,
//     "Aplicado" o "Sin aplicar". Con menos de 5 no hay diálogo.
//   - Informe: "Editar" / "Guardar", "Descargar .docx", subtítulo "Generado
//     hace 5 min · editado hace un momento", tag "Editado"; el archivo se
//     llama "Informe Periodo Medio 2026 <Apellido> <Nombre>.docx".
// Datos ficticios.

import { C, E, p, lerp, clamp, RW, RH, U, BEAT, backdrop, stage, floatShadow, drawPlaca, placaStory, PLACA_DOT } from "../reel-comun/comun.js";
import { EndCard } from "../../shared/endcard.js";
import { makePhrase, drawPhrase, drawDot, golpe, tinta, evaporar, envio } from "../../shared/phrase.js";
import { SPR, spr } from "../../shared/system.js";
import { flightV } from "../../shared/punto.js";
import { gradeOf } from "../../shared/compose.js";
import { icon } from "../../shared/ui.js";
import { emit } from "../../engine/env.js";
import { TAU } from "../../engine/math.js";
import { txt, tw, fillRR, tag, avatarN, checkbox } from "../tutorial/app-ui.js";
import { wrap } from "../tutorial/screens.js";
import { formCard } from "../reel-formularios/index.js";

const F = 30;
const HOOK = BEAT;
const ACC = C.accent;

// Lo que marcó la docente (reel 2: indicadores 1 y 2, primera sugerencia) y
// cómo queda redactado: sin agregar nada que ella no haya marcado.
const OBS = ["Cumple espontáneamente las normas acordadas", "Participa con entusiasmo y propone ideas"];
const S1 = "Alex cumple espontáneamente las normas acordadas en la sala.";
const S2 = (w) => `Participa con ${w} de las propuestas grupales y propone ideas.`;
const INS = "También participó del proyecto de la huerta.";
const INSTR = "Mencionar el proyecto de la huerta";

// ─── texto con tramos (base, agregado en verde, nombre en negrita) ───────────
// segs: [{ t, k: "n" | "ins" | "b" | "sel" }]. Corta por palabras.
function runs(ctx, segs, x, y, fs, maxW, lh, { color = C.ink, insA = 1 } = {}) {
  const words = [];
  for (const s of segs) s.t.split(/(\s+)/).filter((w) => w.length).forEach((w) => words.push({ w, k: s.k }));
  let cx = x;
  let cy = y;
  const R = {};
  for (const { w, k } of words) {
    const wt = k === "b" ? 700 : k === "ins" ? 600 : 400;
    const ww = tw(w, fs, wt);
    if (/^\s+$/.test(w)) {
      if (cx > x) cx += ww;
      continue;
    }
    if (cx + ww > x + maxW && cx > x) {
      cx = x;
      cy += lh;
    }
    if (k === "ins") {
      if (insA > 0.01) {
        ctx.save();
        ctx.globalAlpha *= insA;
        fillRR(ctx, cx - 2, cy - fs, ww + 4, fs + 5, 3, C.successSoft);
        txt(ctx, w, cx, cy, fs, wt, C.success);
        ctx.fillStyle = C.success;
        for (let d = 0; d < ww; d += 3) ctx.fillRect(cx + d, cy + 2.5, 1.4, 1);
        ctx.restore();
      }
    } else {
      if (k === "sel") {
        R.sel = { x: cx, y: cy, w: ww };
        fillRR(ctx, cx - 2, cy - fs, ww + 4, fs + 6, 4, C.accentSoft);
      }
      txt(ctx, w, cx, cy, fs, wt, color);
      if (k === "sel") R.sel.w = ww;
    }
    cx += ww;
  }
  R.end = cy;
  return R;
}

// ─── el informe recién redactado ─────────────────────────────────────────────
// reveal[i] 0..1 muestra cada oración; glow[i] 0..1 la resalta en naranja
// (el vínculo con lo que se marcó, que después se apaga).
function draftCard(ctx, { reveal, glow }) {
  const w = 400;
  const x = -w / 2;
  const h = 330;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.4);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  avatarN(ctx, x + 36, y + 38, 36, "Alex Ejemplo");
  txt(ctx, "Ejemplo, Alex", x + 62, y + 36, 16, 800, C.ink);
  txt(ctx, "Informe · Período Medio 2026", x + 62, y + 53, 11, 400, C.inkMute);
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 76, w, 1);
  txt(ctx, "Formación Personal y Social", x + 22, y + 110, 14, 800, C.ink);
  const R = {};
  let ly = y + 140;
  [S1, S2("entusiasmo")].forEach((s, i) => {
    const lines = wrap(s, 14, 400, w - 44);
    const k = E.outCubic(clamp(reveal[i]));
    R[`s${i}`] = { x: x + 22, y: ly - 16, w: w - 44, h: lines.length * 22 };
    if (glow[i] > 0.01) {
      ctx.save();
      ctx.globalAlpha *= glow[i];
      fillRR(ctx, x + 16, ly - 18, w - 32, lines.length * 22 + 6, 6, C.accentSoft);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha *= k;
    lines.forEach((l, j) => txt(ctx, l, x + 22 + 8 * (1 - k), ly + j * 22, 14, 400, C.ink));
    ctx.restore();
    ly += lines.length * 22 + 6;
  });
  // El resto del informe, en renglones suaves.
  ly += 14;
  txt(ctx, "Prácticas del Lenguaje", x + 22, ly, 14, 800, C.ink);
  ly += 16;
  [0.92, 0.84, 0.6].forEach((f) => {
    fillRR(ctx, x + 22, ly, (w - 44) * f, 7, 3.5, C.border);
    ly += 16;
  });
  return R;
}

// ─── vista previa de la edición en lote ─────────────────────────────────────
const PREV = ["Alex", "Noa", "Sasha"];
const PW = 400;
function prevItem(ctx, x, y, n, { marcado, estado, base }) {
  const segs = [{ t: n, k: "b" }, { t: " " + base, k: "n" }, { t: " " + INS, k: "ins" }];
  // Alto: cabecera 44 + rótulo + texto.
  const lines = wrapLen(segs, 12.5, PW - 36);
  const h = 44 + 30 + lines * 18 + 12;
  fillRR(ctx, x, y, PW, h, 16, "#ffffff", marcado ? ACC : C.border, marcado ? 1.5 : 1);
  checkbox(ctx, x + 16, y + 14, 16, marcado ? 1 : 0);
  txt(ctx, `Ejemplo, ${n}`, x + 42, y + 27, 13.5, 700, C.ink);
  if (estado === "Aplicado") tag(ctx, x + PW - 16 - tw("Aplicado", 11, 600) - 16, y + 11, "Aplicado", "success");
  if (estado === "Sin aplicar") tag(ctx, x + PW - 16 - tw("Sin aplicar", 11, 600) - 16, y + 11, "Sin aplicar", "neutral");
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 44, PW, 1);
  txt(ctx, "FORMACIÓN PERSONAL Y SOCIAL", x + 18, y + 66, 10, 700, C.inkMute, "left", 0.06);
  runs(ctx, segs, x + 18, y + 88, 12.5, PW - 36, 18);
  return { card: { x, y, w: PW, h }, box: { x: x + 10, y: y + 8, w: 28, h: 28 } };
}
function wrapLen(segs, fs, maxW) {
  const words = [];
  for (const s of segs) s.t.split(/\s+/).filter(Boolean).forEach((w) => words.push({ w, k: s.k }));
  let cx = 0;
  let n = 1;
  const sp = tw(" ", fs, 400);
  for (const { w, k } of words) {
    const ww = tw(w, fs, k === "b" ? 700 : k === "ins" ? 600 : 400);
    if (cx + ww > maxW && cx > 0) {
      n++;
      cx = 0;
    }
    cx += ww + sp;
  }
  return n;
}
const BASES = {
  Alex: "participa con entusiasmo de las propuestas grupales y propone ideas.",
  Noa: "comparte sus juegos y ayuda a ordenar la sala.",
  Sasha: "resuelve los conflictos dialogando con sus compañeros.",
};
function previewPanel(ctx, { marc, estados, pressAplicar, n }) {
  const x = -PW / 2;
  let y = -250;
  const R = {};
  tag(ctx, x, y, "Contenido", "accent");
  txt(ctx, INSTR, x + tw("Contenido", 11, 600) + 28, y + 15.5, 13, 400, C.ink);
  y += 36;
  PREV.forEach((nm, i) => {
    const r = prevItem(ctx, x, y, nm, { marcado: marc[i], estado: estados[i], base: BASES[nm] });
    R[`c${i}`] = r.card;
    R[`b${i}`] = r.box;
    y += r.card.h + 10;
  });
  // Botones (como la barra fija de abajo).
  y += 4;
  const label = `Aplicar a ${n} ${n === 1 ? "informe" : "informes"}`;
  const aw = tw(label, 13.5, 600) + 56;
  const s = 1 - 0.05 * pressAplicar;
  const done = estados[0] === "Aplicado";
  ctx.save();
  ctx.globalAlpha *= done ? 0 : 1;
  ctx.translate(x + aw / 2, y + 21);
  ctx.scale(s, s);
  fillRR(ctx, -aw / 2, -21, aw, 42, 12, ACC);
  icon(ctx, "check", -aw / 2 + 22, 0, 15, { color: "#fff", width: 2.6 });
  txt(ctx, label, -aw / 2 + 36, 5, 13.5, 600, "#ffffff");
  ctx.restore();
  const dl = "Descartar";
  const dw = tw(dl, 13.5, 600) + 52;
  ctx.save();
  ctx.globalAlpha *= done ? 0 : 1;
  fillRR(ctx, x + aw + 8, y, dw, 42, 12, "#ffffff", C.borderStrong, 1);
  icon(ctx, "x", x + aw + 8 + 20, y + 21, 15, { color: C.ink, width: 2.2 });
  txt(ctx, dl, x + aw + 8 + 34, y + 26, 13.5, 600, C.ink);
  ctx.restore();
  R.aplicar = { x, y, w: aw, h: 42 };
  R.bottom = y + 42;
  return R;
}

// ─── el informe abierto: edición a mano y descarga ───────────────────────────
function viewer(ctx, { editing, pressEditar, pressGuardar, pressDesc, word, caret, editado }) {
  const w = 400;
  const x = -w / 2;
  const h = 330;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.5);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", editing ? ACC : C.border, editing ? 1.6 : 1);
  avatarN(ctx, x + 36, y + 38, 36, "Alex Ejemplo");
  txt(ctx, "Ejemplo, Alex", x + 62, y + 36, 16, 800, C.ink);
  txt(ctx, editing ? "Editando el informe" : "Generado hace 5 min" + (editado ? " ·" : ""), x + 62, y + 53, 10.5, editing ? 700 : 400, editing ? ACC : C.inkMute);
  if (editado) txt(ctx, "editado hace un momento", x + 62, y + 67, 10.5, 400, C.inkMute);
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
  // Descargar .docx (el botón de ícono del celular).
  const dx = x + w - 18 - bw - 8 - 34;
  const ds = 1 - 0.08 * pressDesc;
  ctx.save();
  ctx.globalAlpha *= editing ? 0.35 : 1;
  ctx.translate(dx + 17, y + 36);
  ctx.scale(ds, ds);
  fillRR(ctx, -17, -17, 34, 34, 10, "#ffffff", C.borderStrong, 1);
  icon(ctx, "download", 0, 0, 15, { color: C.ink, width: 2.2 });
  ctx.restore();
  R.desc = { x: dx, y: y + 19, w: 34, h: 34 };
  if (editado) tag(ctx, x + 62 + tw("Ejemplo, Alex", 16, 800) + 8, y + 22, "Editado", "info", { h: 18, fs: 9.5 });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 88, w, 1);
  txt(ctx, "Formación Personal y Social", x + 22, y + 122, 14, 800, C.ink);
  let ly = y + 150;
  wrap(S1, 14, 400, w - 44).forEach((l) => {
    txt(ctx, l, x + 22, ly, 14, 400, C.ink);
    ly += 22;
  });
  ly += 6;
  const segs = [
    { t: "Participa con", k: "n" },
    { t: " " + word, k: editing ? "sel" : "n" },
    { t: " de las propuestas grupales y propone ideas. " + INS, k: "n" },
  ];
  const r = runs(ctx, segs, x + 22, ly, 14, w - 44, 22);
  if (editing && caret && r.sel) {
    ctx.fillStyle = ACC;
    ctx.fillRect(r.sel.x + r.sel.w + 1, r.sel.y - 15, 2, 20);
  }
  ly = r.end + 30;
  txt(ctx, "Prácticas del Lenguaje", x + 22, ly, 14, 800, C.ink);
  ly += 16;
  [0.9, 0.7].forEach((f) => {
    fillRR(ctx, x + 22, ly, (w - 44) * f, 7, 3.5, C.border);
    ly += 16;
  });
  return R;
}
function fileChip(ctx) {
  const name = "Informe Periodo Medio 2026 Ejemplo Alex.docx";
  const w = tw(name, 12, 600) + 64;
  floatShadow(ctx, -w / 2, -22, w, 44, 12, 1.2);
  fillRR(ctx, -w / 2, -22, w, 44, 12, "#ffffff", C.border, 1);
  fillRR(ctx, -w / 2 + 10, -13, 26, 26, 7, C.infoSoft);
  icon(ctx, "file-down", -w / 2 + 23, 0, 14, { color: C.info, width: 2.2 });
  txt(ctx, name, -w / 2 + 46, 4.5, 12, 600, C.ink);
}

// ─── titulares ───────────────────────────────────────────────────────────────
const Hd = (text, baseline, size = 124) => makePhrase({ text, size, wght: 800, tracking: -0.045, x: 72, baseline, color: C.ink, periodColor: C.accent });
const HK = [Hd("El criterio", 360), Hd("es tuyo.", 480)];
const H1 = [Hd("Lo que vos", 360), Hd("observás.", 480)];
const H2 = [Hd("De ahí sale", 360, 118), Hd("el informe.", 480)];
const H3 = [Hd("Revisás", 360), Hd("y elegís.", 480)];
const H4 = [Hd("La última", 360), Hd("palabra es tuya.", 470, 100)];

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
  chip: 36, fold: 90, draft: 100, h2: 108, land0: 122, land1: 131,
  prevIn: 216, h3: 234, uncheck: 288, aplicar: 324, aplicado: 330,
  viewIn: 378, h4: 396, editar: 414, sel: 420, type0: 426, type1: 440,
  guardar: 462, desc: 486, file: 492, exit: 540, placa: 558,
};
export const PLACA_DUR = 97.4;
const DUR = HOOK + T.placa + 118;
export const TAPS = [T.chip, T.uncheck, T.aplicar, T.editar, T.guardar, T.desc];

// Escenarios.
const CY = 1040;
const FST = { cx: 540, cy: 1060, s: 0.84 };
const DST = { cx: 540, cy: CY, s: 0.92 };
const PST = { cx: 540, cy: 1070, s: 0.8 };
const VST = { cx: 540, cy: 990, s: 0.9 };

const formState = (t) => ({
  sel: [0, t >= T.chip ? 0 : null, null],
  stripDone: { active: 0, ok: (i) => i > 0 && i < 4 },
  activeInd: t < T.chip + 9 ? 1 : -1,
});
const viewState = (t) => {
  const editing = t >= T.editar && t < T.guardar;
  let word = "entusiasmo";
  if (t >= T.type0) word = "interés".slice(0, Math.round(7 * p(t, T.type0, T.type1)));
  return {
    editing,
    pressEditar: press(t, T.editar),
    pressGuardar: press(t, T.guardar),
    pressDesc: press(t, T.desc),
    word: t >= T.sel && t < T.type0 ? "entusiasmo" : word || "",
    caret: editing && Math.floor(t / 7) % 2 === 0,
    editado: t >= T.guardar + 4,
  };
};

// ─── gancho: el informe ya corregido y descargado se rebobina ────────────────
function hook(ctx, f) {
  backdrop(ctx, f - HOOK);
  HK.forEach((ph, i) => {
    drawPhrase(ctx, ph, f, [evaporar(5 + i * 2, { stagger: 0.2, dur: 5 })]);
    if (ph.period) drawDot(ctx, ph.period.cx, ph.period.cy, ph.period.d, C.accent, { alpha: 1 - p(f, 7 + i * 2, 11 + i * 2) });
  });
  const k = E.inCubic(p(f, 3, 13));
  stage(ctx, { ...VST, cy: VST.cy + 60 * k, s: VST.s * (1 - 0.12 * k), alpha: 1 - k }, (c) => viewer(c, { ...viewState(T.desc + 20), pressDesc: 0 }));
  stage(ctx, { cx: 540, cy: 1450 + 40 * k, s: 0.9, alpha: 1 - k }, fileChip);
  const fk = E.outCubic(p(f, 9, 18));
  stage(ctx, { ...FST, cy: FST.cy + 80 * (1 - fk), alpha: fk }, (c) => formCard(c, formState(0)));
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
  headline(ctx, t, H1, 0, 96);
  headline(ctx, t, H2, T.h2, 222, "tinta");
  headline(ctx, t, H3, T.h3, 366);
  headline(ctx, t, H4, T.h4, T.exit, "envio");

  // ── A: ella marca lo que observa ──────────────────────────────────────────
  if (t < T.fold + 20) {
    const out = E.inCubic(p(t, T.fold + 4, T.fold + 18));
    const fst = { ...FST, s: FST.s * (1 - 0.08 * out), alpha: 1 - out };
    stage(ctx, fst, (c) => {
      const R = formCard(c, formState(t));
      if (R.chip1_0) HIT.chip = center(fst, R.chip1_0);
      if (R.row0) HIT.row0 = sp(fst, R.row0.x + 14 + 130, R.row0.y + 38);
      if (R.row1) HIT.row1 = sp(fst, R.row1.x + 14 + 130, R.row1.y + 38);
    });
    tapRing(ctx, HIT.chip, t, T.chip);
  }

  // ── B: de lo marcado sale el informe ──────────────────────────────────────
  let D = null;
  if (t >= T.draft && t < T.prevIn + 16) {
    const k = E.outCubic(p(t, T.draft, T.draft + 16));
    const out = E.inCubic(p(t, T.prevIn - 8, T.prevIn + 8));
    const dst = { ...DST, cy: DST.cy + 60 * (1 - k) - 40 * out, s: DST.s * lerp(0.94, 1, k) * (1 - 0.1 * out), alpha: k * (1 - out) };
    const lands = [T.land0, T.land1];
    stage(ctx, dst, (c) => {
      D = draftCard(c, {
        reveal: lands.map((l) => p(t, l - 2, l + 10)),
        glow: lands.map((l) => p(t, l - 2, l + 4) * (1 - p(t, 176, 204))),
      });
    });
    HIT.s0 = D && center(dst, D.s0);
    HIT.s1 = D && center(dst, D.s1);
  }
  // Las dos observaciones despegan del formulario y aterrizan en su oración.
  if (t >= T.fold && t < T.land1 + 6) {
    [0, 1].forEach((i) => {
      const t0 = T.fold + i * 9;
      const t1 = [T.land0, T.land1][i];
      const from = HIT[`row${i}`] ?? [540, 1000];
      const to = HIT[`s${i}`] ?? [540, 1000];
      const u = E.inOutCubic(p(t, t0 + 2, t1));
      if (t < t0) return;
      const a = clamp((t - t0) / 4) * (1 - p(t, t1 - 1, t1 + 4));
      stage(ctx, { cx: lerp(from[0], to[0], u), cy: lerp(from[1], to[1], u) - 160 * Math.sin(Math.PI * u), s: lerp(0.84, 0.7, u), alpha: a, rot: 0.06 * Math.sin(Math.PI * u) * (i ? -1 : 1) }, (c) => {
        const cw = 280;
        const lines = wrap(OBS[i], 12, 500, cw - 34);
        const h = 14 + lines.length * 16;
        floatShadow(c, -cw / 2, -h / 2, cw, h, 16, 1.4);
        fillRR(c, -cw / 2, -h / 2, cw, h, 16, ACC);
        icon(c, "check", -cw / 2 + 17, -h / 2 + 15, 12, { color: "#fff", width: 3 });
        lines.forEach((l, j) => txt(c, l, -cw / 2 + 29, -h / 2 + 19 + j * 16, 12, 500, "#ffffff"));
      });
    });
  }

  // ── C: revisa el cambio y elige a cuáles ──────────────────────────────────
  if (t >= T.prevIn && t < T.viewIn + 20) {
    const k = E.outCubic(p(t, T.prevIn, T.prevIn + 16));
    const toView = E.inOutCubic(p(t, T.viewIn, T.viewIn + 16));
    const pst = { ...PST, cy: PST.cy + 70 * (1 - k), alpha: k * (1 - toView), s: PST.s * (1 - 0.06 * toView) };
    const marc = [true, true, t < T.uncheck];
    const ap = t >= T.aplicado;
    const estados = ap ? ["Aplicado", "Aplicado", "Sin aplicar"] : [null, null, null];
    stage(ctx, pst, (c) => {
      const R = previewPanel(c, { marc, estados, pressAplicar: press(t, T.aplicar), n: marc.filter(Boolean).length });
      HIT.uncheck = center(pst, R.b2);
      HIT.aplicar = center(pst, R.aplicar);
      HIT.c0 = center(pst, R.c0);
    });
    tapRing(ctx, HIT.uncheck, t, T.uncheck);
    tapRing(ctx, HIT.aplicar, t, T.aplicar);
    if (ap && t < T.aplicado + 24) {
      emit(ctx, (e) => {
        for (let i = 0; i < 2; i++) {
          const kk = p(t, T.aplicado + i * 5, T.aplicado + i * 5 + 14);
          if (kk <= 0 || kk >= 1) continue;
          e.strokeStyle = `rgba(63,98,18,${0.7 * (1 - kk)})`;
          e.lineWidth = 4;
          e.beginPath();
          e.arc(900, (HIT.c0?.[1] ?? 700) - 180 + i * 330, 12 + 50 * E.outCubic(kk), 0, TAU);
          e.stroke();
        }
      });
    }
  }

  // ── D: la última palabra ──────────────────────────────────────────────────
  if (t >= T.viewIn && t < T.exit + 16) {
    const k = E.outCubic(p(t, T.viewIn + 2, T.viewIn + 18));
    const out = E.inCubic(p(t, T.exit, T.exit + 14));
    const from = HIT.c0 ?? [540, 700];
    const vst = { cx: lerp(from[0], VST.cx, k), cy: lerp(from[1], VST.cy, k), s: VST.s * lerp(0.8, 1, k) * (1 - 0.08 * out), alpha: k * (1 - out) };
    stage(ctx, vst, (c) => {
      const R = viewer(c, viewState(t));
      HIT.btn = center(vst, R.btn);
      HIT.desc = center(vst, R.desc);
    });
    tapRing(ctx, HIT.btn, t, T.editar);
    tapRing(ctx, HIT.btn, t, T.guardar);
    tapRing(ctx, HIT.desc, t, T.desc);
    if (t >= T.file) {
      const fk = spr(t, T.file, SPR.settle);
      stage(ctx, { cx: 540, cy: lerp(1300, 1450, clamp(fk)), s: 0.9 * lerp(0.6, 1, clamp(fk)), alpha: clamp((t - T.file) / 5) * (1 - out) }, fileChip);
    }
  }

  // ── salida: el punto de "tuya." vuela a la placa ──────────────────────────
  const pd = H4[1].period;
  if (t >= T.exit + 4 && t < T.placa) {
    const f0 = T.exit + 4;
    const fl = flightV(t, { t0: f0, t1: T.placa, P0: [pd.cx, pd.cy], P1: [pd.cx + 60, pd.cy - 80], P2: [PLACA_DOT.x + 60, PLACA_DOT.y - 40], P3: [PLACA_DOT.x, PLACA_DOT.y], v0: 0, v1: 14 });
    drawDot(ctx, fl.x, fl.y, lerp(pd.d, PLACA_DOT.d, p(t, f0, T.placa)), C.accent);
  } else if (t >= T.exit && t < T.exit + 4) drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent);
}

const BUSY = [[T.fold, T.land1 + 6], [T.prevIn - 8, T.prevIn + 16], [T.viewIn, T.viewIn + 18], [T.file, T.file + 12], [T.exit, T.placa]];
function motion(f) {
  if (f < HOOK) return f >= 3 ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
  const t = f - HOOK;
  if (t >= T.placa) return EndCard.motion(placaStory(t, T.placa, PLACA_DUR));
  return BUSY.some(([a, b]) => t >= a && t < b) ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
}

export default {
  id: "reel-criterio",
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
