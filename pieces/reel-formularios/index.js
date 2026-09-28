// Reel 2 · Formularios (vertical nativo, ~21 s).
//
// "Tu documento pedagógico, hecho formulario, listo para usar."
// Verificado contra la app (app/src):
//   - Nuevo período, paso "Cargar documentos": Período (Inicial / Medio /
//     Final), Opciones por indicador (2 a 5, 3 por defecto), Documento
//     pedagógico evaluativo (resumen) .pdf o .docx, "Generar Formulario".
//   - Paso "Revisá las áreas": "4 áreas · 12 indicadores · 36 sugerencias",
//     cada área con su checkbox y sus indicadores, sugerencias graduadas,
//     "Confirmar y crear formularios".
//   - Formulario del período en el celular: tira de alumnos (General y un
//     círculo por alumno), pestañas de áreas, tarjeta del indicador con sus
//     sugerencias; al elegir una queda "listo".
//   - Generar informes: "1 informe = 1 crédito", "Generar informes (6)",
//     progreso hasta 6/6.
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
import { txt, tw, fillRR, checkbox, tag } from "../tutorial/app-ui.js";
import { wrap } from "../tutorial/screens.js";

const F = 30;
const HOOK = BEAT;

// ─── datos ───────────────────────────────────────────────────────────────────
const AREAS = ["Formación Personal y Social", "Prácticas del Lenguaje", "Matemática", "Educación Física"];
const IND = [
  ["Aceptación de normas grupales", ["Cumple espontáneamente las normas acordadas", "Cumple las normas con recordatorios mínimos", "Cumple las normas con indicaciones frecuentes"]],
  ["Participación en propuestas grupales", ["Participa con entusiasmo y propone ideas", "Participa cuando se lo invita", "Participa con acompañamiento del adulto"]],
  ["Resolución de conflictos con pares", ["Resuelve los conflictos dialogando", "Busca al adulto para resolverlos", "Necesita mediación para resolverlos"]],
];
const INIT = ["AE", "NE", "SE", "DE", "EE", "JE"];
const ACC = C.accent;

// ─── componentes (px CSS) ────────────────────────────────────────────────────

// El documento pedagógico (la hoja PDF que sube la docente).
const DOC_LINES = [
  ["h", "Formación Personal y Social"],
  ["b", "Aceptación de normas grupales"],
  ["b", "Participación en propuestas grupales"],
  ["b", "Resolución de conflictos con pares"],
  ["h", "Prácticas del Lenguaje"],
  ["b", "Escucha y comprensión de relatos"],
  ["b", "Expresión oral de ideas"],
  ["h", "Matemática"],
  ["b", "Conteo y comparación de cantidades"],
  ["b", "Reconocimiento de formas"],
];
export function pdfSheet(ctx, lift = 1, linesA = 1) {
  const w = 300;
  const h = 400;
  floatShadow(ctx, -w / 2, -h / 2, w, h, 6, lift);
  fillRR(ctx, -w / 2, -h / 2, w, h, 6, "#ffffff", C.border, 1);
  const x = -w / 2 + 24;
  let y = -h / 2 + 36;
  fillRR(ctx, x, y - 14, 34, 18, 4, C.accentSoft);
  txt(ctx, "PDF", x + 17, y, 9, 800, C.accentInk, "center");
  txt(ctx, "Resumen evaluativo · Período Medio", x + 42, y, 10.5, 700, C.inkSoft);
  y += 30;
  ctx.save();
  ctx.globalAlpha *= linesA;
  for (const [k, s] of DOC_LINES) {
    if (k === "h") {
      y += 6;
      txt(ctx, s, x, y, 12.5, 800, C.ink);
      y += 20;
    } else {
      ctx.beginPath();
      ctx.arc(x + 4, y - 4, 1.8, 0, TAU);
      ctx.fillStyle = C.inkSoft;
      ctx.fill();
      txt(ctx, s, x + 12, y, 11, 400, C.inkSoft);
      y += 18;
    }
  }
  ctx.restore();
}

function pills(ctx, x, y, w, labels, active, fs = 13) {
  const n = labels.length;
  const pw = (w - 8 * (n - 1)) / n;
  const R = [];
  labels.forEach((l, i) => {
    const on = i === active;
    fillRR(ctx, x + i * (pw + 8), y, pw, 40, 12, on ? ACC : "#ffffff", on ? ACC : C.border, 1);
    txt(ctx, l, x + i * (pw + 8) + pw / 2, y + 25, fs, 600, on ? "#ffffff" : C.ink, "center");
    R.push({ x: x + i * (pw + 8), y, w: pw, h: 40 });
  });
  return R;
}
const lbl = (ctx, s, x, y) => txt(ctx, s.toUpperCase(), x, y, 10.5, 700, C.inkMute, "left", 0.08);

// Paso "Cargar documentos": período, opciones, documento, botón.
export function uploadCard(ctx, { tipo, fileK, press, generating, spin }) {
  const w = 390;
  const x = -w / 2;
  const h = 420;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  const ix = x + 20;
  const iw = w - 40;
  txt(ctx, "Nuevo período", ix, y + 34, 17, 800, C.ink, "left", -0.02);
  txt(ctx, "Cargá tus documentos", ix, y + 52, 11.5, 400, C.inkMute);
  lbl(ctx, "Período", ix, y + 84);
  const R = {};
  R.tipos = pills(ctx, ix, y + 94, iw, ["Inicial", "Medio", "Final"], tipo);
  lbl(ctx, "Opciones por indicador", ix, y + 158);
  R.ops = pills(ctx, ix, y + 168, iw, ["2", "3", "4", "5"], 1);
  lbl(ctx, "Documento pedagógico evaluativo (resumen)", ix, y + 232);
  const dy = y + 242;
  if (fileK < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - fileK;
    fillRR(ctx, ix, dy, iw, 60, 12, "#ffffff");
    ctx.beginPath();
    ctx.roundRect(ix + 0.75, dy + 0.75, iw - 1.5, 58.5, 12);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.borderStrong;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    icon(ctx, "upload", ix + iw / 2, dy + 20, 15, { color: C.inkSoft, width: 2 });
    txt(ctx, ".pdf o .docx · resumen evaluativo", ix + iw / 2, dy + 46, 11, 400, C.inkMute, "center");
    ctx.restore();
  }
  if (fileK > 0) {
    const k = E.outCubic(clamp(fileK));
    ctx.save();
    ctx.globalAlpha *= k;
    fillRR(ctx, ix, dy + 4 * (1 - k), iw, 56, 12, "#ffffff", C.borderStrong, 1.5);
    fillRR(ctx, ix + 12, dy + 11, 34, 34, 8, C.accentSoft);
    txt(ctx, "PDF", ix + 29, dy + 32, 9.5, 800, C.accentInk, "center");
    txt(ctx, "Resumen evaluativo Medio.pdf", ix + 56, dy + 25, 12.5, 600, C.ink);
    txt(ctx, "412 KB", ix + 56, dy + 41, 10.5, 400, C.inkMute);
    ctx.restore();
  }
  R.drop = { x: ix, y: dy, w: iw, h: 60 };
  const by = y + h - 78;
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(ix + iw / 2, by + 27);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -27, iw, 54, 12, fileK >= 1 ? ACC : mixDis());
  const label = generating ? "Generando…" : "Generar Formulario";
  const lw = tw(label, 15, 600);
  txt(ctx, label, -lw / 2 - 11, 5, 15, 600, "#ffffff");
  ctx.translate(lw / 2 + 5, 0);
  if (generating) ctx.rotate(spin);
  icon(ctx, generating ? "loader-circle" : "arrow-right", 0, 0, 16, { color: "#ffffff", width: 2.2 });
  ctx.restore();
  R.btn = { x: ix, y: by, w: iw, h: 54 };
  return R;
}
const mixDis = () => "#e8b79c";

// Paso "Revisá las áreas".
function areasCard(ctx, { expandK, press, rowsK }) {
  const w = 390;
  const x = -w / 2;
  const h = 470;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  const ix = x + 18;
  const iw = w - 36;
  txt(ctx, "Revisá las áreas.", ix, y + 36, 18, 800, C.ink, "left", -0.02);
  fillRR(ctx, ix, y + 52, iw, 46, 12, C.successSoft, C.success, 1);
  icon(ctx, "circle-check", ix + 22, y + 75, 17, { color: C.success, width: 2 });
  txt(ctx, "4 áreas · 12 indicadores · 36 sugerencias", ix + 40, y + 80, 12.5, 700, C.success);
  let ry = y + 112;
  const R = {};
  AREAS.forEach((a, i) => {
    const k = clamp(rowsK(i));
    if (k <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, 10 * (1 - E.outCubic(k)));
    const open = i === 0 ? E.outCubic(clamp(expandK)) : 0;
    const hh = 40 + open * 96;
    fillRR(ctx, ix, ry, iw, hh, 12, "#ffffff", C.border, 1);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ix, ry, iw, hh, 12);
    ctx.clip();
    ctx.fillStyle = C.surface;
    ctx.fillRect(ix, ry, iw, 40);
    ctx.restore();
    checkbox(ctx, ix + 12, ry + 12, 16, 1);
    icon(ctx, "layers", ix + 44, ry + 20, 14, { color: ACC, width: 2 });
    txt(ctx, a, ix + 58, ry + 25, 12.5, 700, C.ink);
    const bl = "3 indicadores";
    fillRR(ctx, ix + iw - 14 - tw(bl, 9.5, 600) - 14, ry + 12, tw(bl, 9.5, 600) + 14, 17, 8.5, C.accentSoft);
    txt(ctx, bl, ix + iw - 14 - tw(bl, 9.5, 600) - 7, ry + 24, 9.5, 600, C.accentInk);
    if (open > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, ry + 40, iw, hh - 40);
      ctx.clip();
      let iy = ry + 62;
      icon(ctx, "chevron-down", ix + 16, iy - 4, 12, { color: C.inkMute, width: 2 });
      txt(ctx, "1.", ix + 28, iy, 11.5, 700, ACC);
      txt(ctx, IND[0][0], ix + 44, iy, 12, 600, C.ink);
      iy += 22;
      IND[0][1].forEach((s, si) => {
        const sk = E.outCubic(p(expandK, 0.3 + si * 0.2, 0.7 + si * 0.2));
        ctx.save();
        ctx.globalAlpha *= sk;
        txt(ctx, `${si + 1}.`, ix + 44, iy, 10.5, 700, C.inkMute);
        txt(ctx, s, ix + 60, iy, 10.5, 400, C.inkSoft);
        ctx.restore();
        iy += 18;
      });
      ctx.restore();
    }
    ctx.restore();
    R[`area${i}`] = { x: ix, y: ry, w: iw, h: hh };
    ry += hh + 8;
  });
  const by = y + h - 70;
  const s = 1 - 0.03 * press;
  ctx.save();
  ctx.translate(ix + iw / 2, by + 26);
  ctx.scale(s, s);
  fillRR(ctx, -iw / 2, -26, iw, 52, 12, ACC);
  const label = "Confirmar y crear formularios";
  txt(ctx, label, -tw(label, 14, 600) / 2 - 10, 5, 14, 600, "#ffffff");
  icon(ctx, "check", tw(label, 14, 600) / 2 + 6, 0, 15, { color: "#ffffff", width: 2.4 });
  ctx.restore();
  R.btn = { x: ix, y: by, w: iw, h: 52 };
  return R;
}

// Formulario del período (celular): tira de alumnos, pestañas e indicadores.
function strip(ctx, x, y, done) {
  fillRR(ctx, x, y, 78, 40, 12, "#ffffff", C.borderStrong, 1.5);
  icon(ctx, "layout-grid", x + 18, y + 20, 13, { color: ACC, width: 2.2 });
  txt(ctx, "General", x + 30, y + 24, 11, 700, C.ink);
  ctx.fillStyle = C.border;
  ctx.fillRect(x + 86, y + 4, 1, 32);
  INIT.forEach((ini, i) => {
    const cx = x + 114 + i * 46;
    const on = i === done.active;
    const ok = done.ok(i);
    ctx.beginPath();
    ctx.arc(cx, y + 20, 20, 0, TAU);
    ctx.fillStyle = on ? C.ink : ok ? C.successSoft : "#ffffff";
    ctx.fill();
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeStyle = on ? ACC : C.border;
    ctx.stroke();
    txt(ctx, ini, cx, y + 24.5, 12, 600, on ? "#ffffff" : ok ? C.success : C.inkSoft, "center");
  });
}
function chip(ctx, x, y, w, s, on) {
  const lines = wrap(s, 12, 500, w - 34);
  const h = 14 + lines.length * 16;
  fillRR(ctx, x, y, w, h, 16, on ? ACC : C.surface, on ? ACC : C.border, 1);
  if (on) icon(ctx, "check", x + 17, y + 15, 12, { color: "#ffffff", width: 3 });
  lines.forEach((l, i) => txt(ctx, l, x + (on ? 29 : 12), y + 19 + i * 16, 12, 500, on ? "#ffffff" : C.inkSoft));
  return { x, y, w, h };
}
export function formCard(ctx, { sel, stripDone, activeInd }) {
  const w = 410;
  const x = -w / 2;
  const h = 470;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, C.surface, C.border, 1);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  const ix = x + 16;
  const iw = w - 32;
  strip(ctx, ix, y + 16, stripDone);
  txt(ctx, "Ejemplo, Alex", ix, y + 90, 19, 800, C.ink, "left", -0.02);
  txt(ctx, "Sala Ejemplo · Período Medio 2026", ix, y + 108, 11, 400, C.inkMute);
  let tx = ix;
  AREAS.slice(0, 3).forEach((a, i) => {
    const tw2 = tw(a, 11, 600) + 20;
    fillRR(ctx, tx, y + 122, tw2, 26, 7, i === 0 ? ACC : null, i === 0 ? ACC : C.border, 1);
    txt(ctx, a, tx + 10, y + 139, 11, 600, i === 0 ? "#ffffff" : C.inkMute);
    tx += tw2 + 6;
  });
  let cy = y + 162;
  const R = {};
  IND.slice(0, 2).forEach(([nombre, sugs], ii) => {
    const active = ii === activeInd;
    const chosen = sel[ii];
    if (active) {
      const cw = (iw - 28 - 6) / 2;
      const chipH = (s) => 14 + wrap(s, 12, 500, cw - 34).length * 16;
      const row1 = Math.max(chipH(sugs[0]), chipH(sugs[1]));
      const hh = 56 + row1 + 6 + chipH(sugs[2]) + 34;
      fillRR(ctx, ix - 3, cy - 3, iw + 6, hh + 6, 17, C.accentSoft);
      fillRR(ctx, ix, cy, iw, hh, 14, "#ffffff", ACC, 1);
      txt(ctx, nombre, ix + 14, cy + 24, 12.5, 700, C.ink);
      txt(ctx, "SUGERENCIAS", ix + 14, cy + 46, 9.5, 700, C.inkMute, "left", 0.08);
      const a = chip(ctx, ix + 14, cy + 56, cw, sugs[0], chosen === 0);
      const b = chip(ctx, ix + 14 + cw + 6, cy + 56, cw, sugs[1], chosen === 1);
      const c = chip(ctx, ix + 14, cy + 56 + row1 + 6, cw, sugs[2], chosen === 2);
      R[`chip${ii}_0`] = a;
      R[`chip${ii}_1`] = b;
      R[`chip${ii}_2`] = c;
      icon(ctx, "plus", ix + 22, cy + hh - 20, 11, { color: ACC, width: 2.4 });
      txt(ctx, "Escribir la mía", ix + 32, cy + hh - 16, 11, 500, ACC);
      cy += hh + 10;
    } else if (chosen !== null && chosen !== undefined) {
      fillRR(ctx, ix, cy, iw, 58, 14, "#ffffff", C.border, 1);
      txt(ctx, nombre, ix + 14, cy + 23, 12.5, 700, C.ink);
      tag(ctx, ix + iw - 14 - tw("listo", 11, 600) - 16, cy + 10, "listo", "success");
      R[`row${ii}`] = { x: ix, y: cy, w: iw, h: 58 };
      txt(ctx, sugs[chosen], ix + 14, cy + 43, 11, 400, C.inkSoft);
      cy += 68;
    } else {
      fillRR(ctx, ix, cy, iw, 70, 14, "#ffffff", C.border, 1);
      txt(ctx, nombre, ix + 14, cy + 23, 12.5, 700, C.ink);
      let px = ix + 14;
      sugs.slice(0, 2).forEach((s) => {
        const sw = Math.min(170, tw(s, 10.5, 500)) + 18;
        fillRR(ctx, px, cy + 36, sw, 22, 11, C.surface, C.border, 1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, cy + 36, sw - 6, 22);
        ctx.clip();
        txt(ctx, s, px + 9, cy + 51, 10.5, 500, C.inkSoft);
        ctx.restore();
        px += sw + 6;
      });
      cy += 80;
    }
  });
  ctx.restore();
  return R;
}

// Generar informes: resumen, botón y progreso.
function generaCard(ctx, { press, prog, done }) {
  const w = 390;
  const x = -w / 2;
  const h = 330;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.3);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  const ix = x + 20;
  const iw = w - 40;
  txt(ctx, "Generar informes", ix, y + 38, 19, 800, C.ink, "left", -0.02);
  fillRR(ctx, ix, y + 56, iw, 58, 12, C.accentSoft, ACC, 1);
  fillRR(ctx, ix + 12, y + 67, 36, 36, 10, ACC);
  icon(ctx, "sparkles", ix + 30, y + 85, 17, { color: "#fff", width: 2 });
  txt(ctx, "6 de 6 formularios completos", ix + 58, y + 82, 12.5, 700, C.accentInk);
  txt(ctx, "1 informe = 1 crédito", ix + 58, y + 99, 10.5, 400, C.accentInk);
  const R = {};
  if (prog <= 0) {
    const s = 1 - 0.03 * press;
    ctx.save();
    ctx.translate(ix + iw / 2, y + 162);
    ctx.scale(s, s);
    fillRR(ctx, -iw / 2, -27, iw, 54, 12, ACC);
    const label = "Generar informes (6)";
    icon(ctx, "sparkles", -tw(label, 15, 600) / 2 - 8, 0, 16, { color: "#fff", width: 2 });
    txt(ctx, label, -tw(label, 15, 600) / 2 + 6, 5, 15, 600, "#ffffff");
    ctx.restore();
    R.btn = { x: ix, y: y + 135, w: iw, h: 54 };
  } else {
    const n = Math.min(6, Math.floor(prog * 6 + 1e-6));
    fillRR(ctx, ix, y + 132, iw, 176, 16, C.ink);
    txt(ctx, "PROGRESO", ix + 20, y + 160, 10, 700, "#a8a29e", "left", 0.1);
    txt(ctx, `${n}/6`, ix + 20, y + 222, 54, 800, "#faf6ef", "left", -0.03);
    fillRR(ctx, ix + 20, y + 240, iw - 40, 7, 3.5, "#3a322c");
    if (n > 0) fillRR(ctx, ix + 20, y + 240, (iw - 40) * (n / 6), 7, 3.5, C.dAccent);
    txt(ctx, done ? "Todo listo." : `Trabajando en Ejemplo, ${["Alex", "Noa", "Sasha", "Dani", "Eli", "Juli"][Math.min(5, n)]}`, ix + 20, y + 280, 12, done ? 700 : 400, done ? "#faf6ef" : "#a8a29e");
  }
  return R;
}

// ─── titulares ───────────────────────────────────────────────────────────────
const Hd = (text, baseline, size = 124) => makePhrase({ text, size, wght: 800, tracking: -0.045, x: 72, baseline, color: C.ink, periodColor: C.accent });
const H1 = [Hd("Subís tu", 360), Hd("documento.", 480)];
const H2 = [Hd("Sale el", 360), Hd("formulario.", 480)];
const H3 = [Hd("Marcás lo que", 360, 108), Hd("observás.", 470, 108)];
const H4 = [Hd("Y generás", 360), Hd("los informes.", 480, 116)];
const HK = [Hd("Tu documento,", 360, 112), Hd("hecho formulario.", 470, 96)];

function headline(ctx, t, lines, tin, tout, preset = "golpe") {
  if (t < tin - 2 || t > tout + 14) return;
  lines.forEach((ph, i) => {
    const h = tin + i * 5;
    const enter = preset === "tinta" ? tinta(h, { stagger: 0.6 }) : preset === "envio" ? envio(h) : golpe(h);
    drawPhrase(ctx, ph, t, [enter, evaporar(tout + i * 2, { stagger: 0.35, dur: 5 })]);
    if (ph.period && t < tout + 2) {
      const pd = ph.period;
      drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent, { scale: spr(t, h + 2, SPR.slam), alpha: 1 - p(t, tout, tout + 4) });
    }
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
  drop: 36, medio: 54, gen: 90, h2: 108, areas: 112, expand: 144, confirm: 180,
  h3: 198, form: 200, chip0: 234, chip1: 261, lapse: 270, h4: 324, genIn: 324,
  genTap: 342, prog: 360, done: 414, exit: 486, placa: 504,
};
export const PLACA_DUR = 97.4;
const DUR = HOOK + T.placa + 118;
export const TAPS = [T.medio, T.gen, T.expand, T.confirm, T.chip0, T.chip1, T.genTap];

// ─── gancho: el formulario terminado se rebobina hasta la hoja PDF ───────────
const SHEET_START = { cx: 830, cy: 820, s: 0.62, rot: 0.16 };
function hook(ctx, f) {
  backdrop(ctx, f - HOOK);
  headlineStatic(ctx, HK, f);
  const k = E.inCubic(p(f, 4, 16));
  // El formulario se pliega hacia la hoja.
  stage(ctx, { cx: lerp(540, SHEET_START.cx, k), cy: lerp(1060, SHEET_START.cy, k), s: lerp(0.84, 0.3, k), rot: SHEET_START.rot * k, alpha: 1 - p(f, 11, 16) }, (c) => {
    formCard(c, { sel: [0, null], stripDone: { active: 0, ok: (i) => i > 0 && i < 4 }, activeInd: 1 });
  });
  stage(ctx, { ...SHEET_START, alpha: p(f, 9, 15) }, (c) => pdfSheet(c, 1.2));
}
function headlineStatic(ctx, lines, f) {
  lines.forEach((ph, i) => {
    drawPhrase(ctx, ph, f, [evaporar(5 + i * 2, { stagger: 0.2, dur: 5 })]);
    if (ph.period) drawDot(ctx, ph.period.cx, ph.period.cy, ph.period.d, C.accent, { alpha: 1 - p(f, 7 + i * 2, 11 + i * 2) });
  });
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
  headline(ctx, t, H2, T.h2, 186, "tinta");
  headline(ctx, t, H3, T.h3, 312);
  headline(ctx, t, H4, T.h4, T.exit, "envio");

  const CY = 1060;

  // ── A: la hoja cae en la zona de carga ────────────────────────────────────
  if (t < T.areas + 16) {
    const inK = E.outCubic(p(t, 0, 14));
    const out = E.inCubic(p(t, T.gen + 10, T.areas + 10));
    const ust = { cx: 540, cy: CY + 90 * (1 - inK), s: 0.9, alpha: inK * (1 - out) };
    const fileK = p(t, T.drop, T.drop + 8);
    stage(ctx, ust, (c) => {
      const R = uploadCard(c, { tipo: t >= T.medio ? 1 : 0, fileK, press: press(t, T.gen), generating: t >= T.gen, spin: t * 0.25 });
      HIT.medio = center(ust, R.tipos[1]);
      HIT.gen = center(ust, R.btn);
      HIT.drop = center(ust, R.drop);
    });
    // La hoja vuela desde arriba a la derecha y se mete en la zona de carga.
    if (t < T.drop + 4) {
      const u = E.inOutCubic(p(t, 2, T.drop));
      const to = HIT.drop ?? [540, 1100];
      stage(ctx, {
        cx: lerp(SHEET_START.cx, to[0], u),
        cy: lerp(SHEET_START.cy, to[1], u) - 140 * Math.sin(Math.PI * u),
        s: lerp(SHEET_START.s, 0.14, u),
        rot: lerp(SHEET_START.rot, 0, u),
        alpha: 1 - p(t, T.drop - 2, T.drop + 2),
      }, (c) => pdfSheet(c, 1.4));
    }
    tapRing(ctx, HIT.medio, t, T.medio);
    tapRing(ctx, HIT.gen, t, T.gen);
  }

  // ── B: el documento se vuelve áreas, indicadores y sugerencias ────────────
  if (t >= T.gen + 8 && t < T.form + 16) {
    // Renglones de la hoja que salen del botón y se acomodan como áreas.
    if (t < T.areas + 24) {
      emit(ctx, (e) => {
        for (let i = 0; i < 10; i++) {
          const k = E.inOutCubic(p(t, T.gen + 8 + i, T.areas + 10 + i));
          const from = HIT.gen ?? [540, 1300];
          const x0 = from[0] - 200 + 400 * hash1(i + 1);
          const tx = 540 - 300 + 30 * (i % 3);
          const ty = 820 + 70 * Math.floor(i / 2.6);
          const x = lerp(x0, tx, k);
          const y = lerp(from[1], ty, k) - 160 * Math.sin(Math.PI * k);
          const a = Math.sin(Math.PI * k);
          e.fillStyle = `rgba(251,146,60,${0.8 * a})`;
          e.beginPath();
          e.roundRect(x, y - 3, 90 + 80 * hash1(i + 7), 6, 3);
          e.fill();
        }
      });
    }
    const ak = E.outCubic(p(t, T.areas + 6, T.areas + 20));
    const out = E.inCubic(p(t, T.confirm + 6, T.form + 12));
    const ast = { cx: 540, cy: CY + 60 * (1 - ak), s: 0.8 * lerp(0.94, 1, ak) * (1 - 0.06 * out), alpha: ak * (1 - out) };
    stage(ctx, ast, (c) => {
      const R = areasCard(c, {
        expandK: p(t, T.expand, T.expand + 18),
        press: press(t, T.confirm),
        rowsK: (i) => p(t, T.areas + 12 + i * 3, T.areas + 20 + i * 3),
      });
      HIT.confirm = center(ast, R.btn);
      HIT.expand = center(ast, { ...R.area0, h: 40 });
    });
    tapRing(ctx, HIT.expand, t, T.expand);
    tapRing(ctx, HIT.confirm, t, T.confirm);
  }

  // ── C: el formulario, listo para usar ─────────────────────────────────────
  if (t >= T.form && t < T.genIn + 16) {
    const fk = E.outCubic(p(t, T.form + 4, T.form + 20));
    const out = E.inCubic(p(t, T.genIn - 6, T.genIn + 10));
    const sel = [t >= T.chip0 ? 0 : null, t >= T.chip1 ? 0 : null, null];
    const activeInd = t < T.chip0 + 9 ? 0 : 1;
    const lapse = (i) => i === 0 ? t >= T.chip1 + 6 : t >= T.lapse + i * 7;
    const fst = { cx: 540, cy: CY + 70 * (1 - fk), s: 0.84 * lerp(0.9, 1, fk) * (1 - 0.06 * out), alpha: fk * (1 - out) };
    stage(ctx, fst, (c) => {
      const R = formCard(c, { sel, stripDone: { active: t < T.chip1 + 6 ? 0 : -1, ok: lapse }, activeInd });
      if (R.chip0_0) HIT.chip0 = center(fst, R.chip0_0);
      if (R.chip1_0) HIT.chip1 = center(fst, R.chip1_0);
    });
    tapRing(ctx, HIT.chip0, t, T.chip0);
    tapRing(ctx, HIT.chip1, t, T.chip1);
  }

  // ── D: generación rápida ──────────────────────────────────────────────────
  if (t >= T.genIn && t < T.exit + 16) {
    const gk = E.outCubic(p(t, T.genIn + 4, T.genIn + 18));
    const out = E.inCubic(p(t, T.exit, T.exit + 14));
    const gst = { cx: 540, cy: CY + 60 * (1 - gk), alpha: gk * (1 - out), s: 1 - 0.08 * out };
    // El progreso avanza a medio beat por informe.
    const prog = t < T.prog ? 0 : clamp((t - T.prog + 1) / (T.done - T.prog));
    stage(ctx, gst, (c) => {
      const R = generaCard(c, { press: press(t, T.genTap), prog, done: t >= T.done });
      if (R.btn) HIT.genTap = center(gst, R.btn);
    });
    tapRing(ctx, HIT.genTap, t, T.genTap);
    if (t >= T.done && t < T.done + 20) {
      emit(ctx, (e) => {
        for (let i = 0; i < 16; i++) {
          const a = hash1(i * 7 + 2) * TAU;
          const d = 60 + 300 * E.outCubic(p(t, T.done, T.done + 18)) * (0.5 + hash1(i * 3));
          e.fillStyle = `rgba(251,146,60,${0.85 * (1 - p(t, T.done + 6, T.done + 20))})`;
          e.beginPath();
          e.arc(540 + Math.cos(a) * d, 1150 + Math.sin(a) * d * 0.55, 4 + 3 * hash1(i), 0, TAU);
          e.fill();
        }
      });
    }
  }

  // ── salida: el punto de "informes." vuela a la placa ──────────────────────
  const pd = H4[1].period;
  if (t >= T.exit + 4 && t < T.placa) {
    const f0 = T.exit + 4;
    const fl = flightV(t, { t0: f0, t1: T.placa, P0: [pd.cx, pd.cy], P1: [pd.cx + 60, pd.cy - 80], P2: [PLACA_DOT.x + 60, PLACA_DOT.y - 40], P3: [PLACA_DOT.x, PLACA_DOT.y], v0: 0, v1: 14 });
    drawDot(ctx, fl.x, fl.y, lerp(pd.d, PLACA_DOT.d, p(t, f0, T.placa)), C.accent);
  } else if (t >= T.exit && t < T.exit + 4) drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent);
}

const BUSY = [[0, 14], [2, T.drop + 4], [T.gen + 6, T.areas + 24], [T.confirm, T.form + 20], [T.genIn - 6, T.genIn + 18], [T.done, T.done + 20], [T.exit, T.placa]];
function motion(f) {
  if (f < HOOK) return f >= 4 ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
  const t = f - HOOK;
  if (t >= T.placa) return EndCard.motion(placaStory(t, T.placa, PLACA_DUR));
  return BUSY.some(([a, b]) => t >= a && t < b) ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
}

export default {
  id: "reel-formularios",
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
