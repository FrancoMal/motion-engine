// Reel 1 · Planificación (vertical nativo, 24 s).
//
// "De una idea a tu planificación, editala a tu gusto y llevala al informe."
// Todo lo que se ve existe en la app (verificado contra app/src):
//   - /planificacion: el chat ("Describí tu idea de actividades…"), las
//     preguntas con opciones y "Continuar", el botón "Generar planificaciones",
//     las tarjetas del panel y el documento en el canvas.
//   - Edición por chat con la planificación abierta: "Editando «…»".
//   - Nuevo período → Planificación del período → "Importar de mi biblioteca"
//     → "Mi biblioteca de planificaciones" → "Agregar". La app cruza las
//     actividades con los indicadores y las usa como ejemplos al redactar.
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
import { txt, tw, fillRR, checkbox, avatarN } from "../tutorial/app-ui.js";
import { wrap } from "../tutorial/screens.js";

const F = 30;
// Gancho: el primer frame ya muestra el resultado (titular y planificaciones);
// en el primer beat todo se rebobina hacia el botón de enviar del chat y la
// historia arranca desde la idea.
const HOOK = BEAT;
const DUR = HOOK + 576 + 118;

// ─── datos ───────────────────────────────────────────────────────────────────
const PLANES = [
  { tipo: "Proyecto", titulo: "La huerta de la sala", sub: "Ciencias Naturales · Formación Personal y Social", color: "#4d7c0f", icon: "leaf", dur: "2 semanas", n: 3 },
  { tipo: "Secuencia Didáctica", titulo: "Contamos lo plantado", sub: "Matemática", color: "#1e3a8a", icon: "blocks", dur: "1 semana", n: 4 },
  { tipo: "Unidad Didáctica", titulo: "Cuentos de la huerta", sub: "Prácticas del Lenguaje", color: "#9f3d2c", icon: "book-open", dur: "3 semanas", n: 5 },
];
const PROPOSITOS = ["Cuidar a los seres vivos del entorno.", "Trabajar en equipo en tareas compartidas."];
const PROPUESTAS = ["Recorrida por el patio", "Siembra en macetas", "Registro del crecimiento"];
const NUEVA = "Visita al vivero del barrio";

// ─── componentes (px CSS) ────────────────────────────────────────────────────
const ACC = C.accent;

function composer(ctx, text, { caret = false, send = 0, w = 390 } = {}) {
  const x = -w / 2;
  fillRR(ctx, x, -28, w, 56, 16, "#ffffff", text ? ACC : C.borderStrong, 1.2);
  icon(ctx, "paperclip", x + 24, 0, 18, { color: C.inkSoft, width: 2 });
  if (text) txt(ctx, text, x + 44, 5, 15, 400, C.ink);
  else txt(ctx, "Describí tu idea de actividades…", x + 44, 5, 15, 400, C.inkMute);
  if (caret) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 45 + (text ? tw(text, 15, 400) : 0), -9, 1.5, 18);
  }
  const s = 1 - 0.12 * send;
  ctx.save();
  ctx.translate(x + w - 26, 0);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, TAU);
  ctx.fillStyle = text ? ACC : C.border;
  ctx.fill();
  icon(ctx, "send", -1, 1, 16, { color: "#ffffff", width: 2.2 });
  ctx.restore();
  return { sendX: x + w - 26, sendY: 0 };
}

function userBubble(ctx, text, rightX, y) {
  const w = tw(text, 14, 400) + 30;
  ctx.beginPath();
  ctx.roundRect(rightX - w, y, w, 42, [16, 16, 4, 16]);
  ctx.fillStyle = ACC;
  ctx.fill();
  txt(ctx, text, rightX - w + 15, y + 26, 14, 400, "#ffffff");
  return { x: rightX - w, y, w, h: 42 };
}

function avatarIA(ctx, x, y) {
  fillRR(ctx, x, y, 30, 30, 9, C.accentSoft);
  icon(ctx, "sparkles", x + 15, y + 15, 16, { color: C.accentInk, width: 2 });
}

function pill(ctx, x, y, label, on, k = 1) {
  const w = tw(label, 13, 600) + (on ? 38 : 26);
  fillRR(ctx, x, y, w, 32, 16, on ? C.accentSoft : "#ffffff", on ? ACC : C.border, 1);
  if (on) icon(ctx, "check", x + 16, y + 16, 12, { color: C.accentInk, width: 3 });
  txt(ctx, label, x + (on ? 28 : 13), y + 21, 13, 600, on ? C.accentInk : C.ink);
  void k;
  return { x, y, w, h: 32 };
}

// Mensaje del asistente con las preguntas agrupadas.
const GRUPOS = [
  ["Sala", ["3 años", "4 años", "5 años"]],
  ["Duración", ["1 semana", "2 semanas", "1 mes"]],
];
function assistantQuestions(ctx, x, y, sel, pressCta) {
  avatarIA(ctx, x, y);
  const tx = x + 42;
  txt(ctx, "Buenísimo. Contame un poco más:", tx, y + 20, 14, 400, C.ink);
  let gy = y + 44;
  const R = {};
  GRUPOS.forEach(([label, opts], gi) => {
    txt(ctx, label.toUpperCase(), tx, gy + 11, 11, 800, C.inkMute, "left", 0.08);
    let px = tx;
    opts.forEach((o, oi) => {
      const r = pill(ctx, px, gy + 20, o, sel[gi] === oi);
      R[`${gi}_${oi}`] = r;
      px += r.w + 6;
    });
    const ow = tw("Otro…", 13, 600) + 26;
    fillRR(ctx, px, gy + 20, ow, 32, 16, "#ffffff", C.border, 1);
    txt(ctx, "Otro…", px + 13, gy + 41, 13, 600, C.inkMute);
    gy += 64;
  });
  const ready = sel.every((v) => v !== null && v !== undefined);
  const cw = tw("Continuar", 13, 700) + 48;
  const s = 1 - 0.04 * pressCta;
  ctx.save();
  ctx.translate(tx + cw / 2, gy + 20);
  ctx.scale(s, s);
  fillRR(ctx, -cw / 2, -18, cw, 36, 10, ready ? ACC : C.border);
  txt(ctx, "Continuar", -cw / 2 + 16, 5, 13, 700, ready ? "#ffffff" : C.inkMute);
  icon(ctx, "arrow-right", cw / 2 - 18, 0, 14, { color: ready ? "#ffffff" : C.inkMute, width: 2.2 });
  ctx.restore();
  R.cta = { x: tx, y: gy + 2, w: cw, h: 36 };
  return R;
}

function generateMsg(ctx, x, y, press, glow) {
  avatarIA(ctx, x, y);
  const tx = x + 42;
  txt(ctx, "Listo, ya tengo lo que necesito.", tx, y + 20, 14, 400, C.ink);
  const label = "Generar planificaciones";
  const w = tw(label, 13.5, 700) + 58;
  const s = 1 - 0.04 * press;
  ctx.save();
  ctx.translate(tx + w / 2, y + 60);
  ctx.scale(s, s);
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(251,146,60,${0.7 * glow})`;
    ctx.shadowBlur = 30;
    fillRR(ctx, -w / 2, -21, w, 42, 12, ACC);
    ctx.restore();
  }
  fillRR(ctx, -w / 2, -21, w, 42, 12, ACC);
  icon(ctx, "sparkles", -w / 2 + 24, 0, 15, { color: "#ffffff", width: 2 });
  txt(ctx, label, -w / 2 + 40, 5, 13.5, 700, "#ffffff");
  ctx.restore();
  return { x: tx, y: y + 39, w, h: 42, cx: tx + w / 2, cy: y + 60 };
}

function planCard(ctx, x, y, w, P) {
  floatShadow(ctx, x, y, w, 96, 14, 1);
  fillRR(ctx, x, y, w, 96, 14, "#ffffff", C.border, 1);
  fillRR(ctx, x + 14, y + 14, 38, 38, 10, P.color);
  icon(ctx, P.icon, x + 33, y + 33, 19, { color: "#ffffff", width: 1.9 });
  txt(ctx, P.titulo, x + 64, y + 30, 13.5, 800, C.ink);
  txt(ctx, `${P.tipo} · ${P.sub.split(" · ")[0]}`, x + 64, y + 47, 11, 400, C.inkMute);
  icon(ctx, "chevron-right", x + w - 22, y + 30, 16, { color: C.inkMute, width: 2 });
  ctx.fillStyle = C.border;
  ctx.fillRect(x + 14, y + 64, w - 28, 1);
  icon(ctx, "clock", x + 21, y + 80, 12, { color: C.inkMute, width: 2 });
  txt(ctx, P.dur, x + 32, y + 84, 11, 400, C.inkSoft);
  const px = x + 32 + tw(P.dur, 11, 400) + 16;
  icon(ctx, "list-ordered", px, y + 80, 12, { color: C.inkMute, width: 2 });
  txt(ctx, `${P.n} propuestas`, px + 11, y + 84, 11, 400, C.inkSoft);
}

// Documento en el canvas. scroll desplaza el cuerpo; nuevaK 0..1 inserta la
// propuesta nueva; hdr 0..1 opacidad de la barra con Editar.
const DOC_W = 425;
function planDoc(ctx, x, y, h, { scroll = 0, nuevaK = 0, glow = 0, contentA = 1, w = DOC_W, base = true } = {}) {
  const DW = w;
  if (base) {
    floatShadow(ctx, x, y, DW, h, 16, 1.4);
    fillRR(ctx, x, y, DW, h, 16, "#ffffff", C.border, 1);
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, DW, h, 16);
  ctx.clip();
  ctx.globalAlpha *= contentA;
  // barra
  fillRR(ctx, x + 18, y + 14, 32, 32, 9, C.surface, C.border, 1);
  icon(ctx, "chevron-left", x + 34, y + 30, 15, { color: C.ink, width: 2 });
  txt(ctx, "La huerta de la sala", x + 60, y + 35, 13, 700, C.ink);
  const ew = tw("Editar", 12, 700) + 40;
  const ex = x + DW - 18 - 32 - 8 - 32 - 8 - ew;
  fillRR(ctx, ex, y + 14, ew, 32, 9, "#ffffff", C.borderStrong, 1);
  icon(ctx, "pencil", ex + 16, y + 30, 13, { color: C.ink, width: 2 });
  txt(ctx, "Editar", ex + 28, y + 34, 12, 700, C.ink);
  fillRR(ctx, x + DW - 90, y + 14, 32, 32, 9, "#ffffff", C.border, 1);
  icon(ctx, "download", x + DW - 74, y + 30, 15, { color: C.inkSoft, width: 2 });
  fillRR(ctx, x + DW - 50, y + 14, 32, 32, 9, "#ffffff", C.border, 1);
  icon(ctx, "trash-2", x + DW - 34, y + 30, 15, { color: C.inkMute, width: 2 });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 60, DW, 1);
  // cuerpo
  ctx.beginPath();
  ctx.rect(x, y + 61, DW, h - 61);
  ctx.clip();
  let by = y + 88 - scroll;
  const bx = x + 26;
  txt(ctx, "Proyecto: La huerta de la sala", bx, by, 21, 800, C.ink, "left", -0.02);
  by += 22;
  txt(ctx, PLANES[0].sub, bx, by, 12.5, 400, C.inkSoft);
  by += 26;
  icon(ctx, "calendar", bx + 6, by - 4, 13, { color: C.inkMute, width: 2 });
  txt(ctx, "Inicio: ", bx + 18, by, 12.5, 400, C.inkSoft);
  txt(ctx, "2 de septiembre", bx + 18 + tw("Inicio: ", 12.5, 400), by, 12.5, 700, C.ink);
  const cx2 = bx + 18 + tw("Inicio: 2 de septiembre", 12.5, 700) + 16;
  icon(ctx, "clock", cx2 + 6, by - 4, 13, { color: C.inkMute, width: 2 });
  txt(ctx, "2 semanas", cx2 + 18, by, 12.5, 400, C.inkSoft);
  by += 32;
  const label = (ic, t) => {
    icon(ctx, ic, bx + 7, by - 4, 14, { color: ACC, width: 2 });
    txt(ctx, t.toUpperCase(), bx + 20, by, 11, 800, C.accentInk, "left", 0.08);
    by += 20;
  };
  label("target", "Propósitos");
  PROPOSITOS.forEach((s) => {
    ctx.beginPath();
    ctx.arc(bx + 8, by - 4, 2.2, 0, TAU);
    ctx.fillStyle = C.ink;
    ctx.fill();
    txt(ctx, s, bx + 18, by, 13.5, 400, C.ink);
    by += 22;
  });
  by += 14;
  label("list-ordered", "Propuestas didácticas");
  const items = [...PROPUESTAS];
  const iw = DW - 52;
  items.forEach((s, i) => {
    fillRR(ctx, bx, by - 6, iw, 36, 11, C.surface, C.border, 1);
    txt(ctx, `${i + 1}.`, bx + 12, by + 17, 11, 800, C.accentInk);
    txt(ctx, s, bx + 31, by + 17, 13.5, 700, C.ink);
    by += 44;
  });
  if (nuevaK > 0) {
    const k = E.outCubic(clamp(nuevaK));
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, 14 * (1 - k));
    if (glow > 0.01) {
      ctx.save();
      ctx.shadowColor = `rgba(251,146,60,${0.8 * glow})`;
      ctx.shadowBlur = 22;
      fillRR(ctx, bx, by - 6, iw, 36, 11, C.accentSoft);
      ctx.restore();
    }
    fillRR(ctx, bx, by - 6, iw, 36, 11, C.accentSoft, ACC, 1.2);
    txt(ctx, "4.", bx + 12, by + 17, 11, 800, C.accentInk);
    txt(ctx, NUEVA, bx + 31, by + 17, 13.5, 700, C.ink);
    ctx.restore();
  }
  ctx.restore();
}

// Banner + compositor en modo edición.
function editComposer(ctx, text, { caret, send, bannerK }) {
  if (bannerK > 0) {
    ctx.save();
    ctx.globalAlpha *= bannerK;
    fillRR(ctx, -195, -68, 390, 32, 10, C.accentSoft);
    icon(ctx, "pencil", -178, -52, 13, { color: C.accentInk, width: 2.2 });
    txt(ctx, "Editando ", -164, -47, 12.5, 400, C.accentInk);
    txt(ctx, "«La huerta de la sala»", -164 + tw("Editando ", 12.5, 400), -47, 12.5, 800, C.accentInk);
    ctx.restore();
  }
  composer(ctx, text, { caret, send });
}

function libraryModal(ctx, { sel, pressAgregar, rowsA }) {
  const w = 390;
  const x = -w / 2;
  const h = 300;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 18, 1.6);
  fillRR(ctx, x, y, w, h, 18, "#ffffff", C.border, 1);
  txt(ctx, "Mi biblioteca de planificaciones", x + 18, y + 32, 14, 800, C.ink);
  icon(ctx, "x", x + w - 26, y + 27, 15, { color: C.inkMute, width: 2 });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 52, w, 1);
  const R = {};
  PLANES.forEach((P, i) => {
    const ry = y + 66 + i * 58;
    const on = i === 0 && sel;
    ctx.save();
    ctx.globalAlpha *= i === 0 ? 1 : rowsA;
    fillRR(ctx, x + 14, ry, w - 28, 50, 12, on ? C.accentSoft : "#ffffff", on ? ACC : C.border, 1);
    checkbox(ctx, x + 28, ry + 16, 18, on ? 1 : 0, { r: 5 });
    txt(ctx, P.titulo, x + 58, ry + 22, 13.5, 700, C.ink);
    txt(ctx, P.tipo, x + 58, ry + 39, 11, 400, C.inkMute);
    ctx.restore();
    R[`row${i}`] = { x: x + 14, y: ry, w: w - 28, h: 50 };
  });
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + h - 56, w, 1);
  txt(ctx, `${sel ? 1 : 0} seleccionada${sel ? "" : "s"}`, x + 18, y + h - 24, 11, 400, C.inkMute);
  const aw = tw("Agregar", 12, 700) + 40;
  const cw = tw("Cancelar", 12, 600) + 24;
  fillRR(ctx, x + w - 18 - aw - 8 - cw, y + h - 44, cw, 32, 8, "#ffffff", C.borderStrong, 1);
  txt(ctx, "Cancelar", x + w - 18 - aw - 8 - cw + 12, y + h - 23, 12, 600, C.ink);
  const s = 1 - 0.05 * pressAgregar;
  ctx.save();
  ctx.translate(x + w - 18 - aw / 2, y + h - 28);
  ctx.scale(s, s);
  fillRR(ctx, -aw / 2, -16, aw, 32, 8, sel ? ACC : C.border);
  icon(ctx, "plus", -aw / 2 + 16, 0, 13, { color: sel ? "#fff" : C.inkMute, width: 2.4 });
  txt(ctx, "Agregar", -aw / 2 + 27, 4, 12, 700, sel ? "#ffffff" : C.inkMute);
  ctx.restore();
  R.agregar = { x: x + w - 18 - aw, y: y + h - 44, w: aw, h: 32 };
  return R;
}

// Bloque "Planificación del período" del paso de documentos.
function planifBlock(ctx, fileK) {
  const w = 390;
  const x = -w / 2;
  const h = 206;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 16, 1.2);
  fillRR(ctx, x, y, w, h, 16, "#ffffff", C.border, 1);
  txt(ctx, "NUEVO PERÍODO · CARGAR DOCUMENTOS", x + 18, y + 26, 10, 800, C.inkMute, "left", 0.08);
  fillRR(ctx, x + 18, y + 40, 28, 28, 8, C.accentSoft);
  icon(ctx, "list-checks", x + 32, y + 54, 14, { color: C.accentInk, width: 2 });
  txt(ctx, "Planificación del período", x + 56, y + 54, 13, 700, C.ink);
  txt(ctx, "OPCIONAL", x + 56 + tw("Planificación del período", 13, 700) + 8, y + 54, 10, 400, C.inkMute, "left", 0.05);
  txt(ctx, "Trazo Inicial las cruza con los indicadores del cuadro", x + 56, y + 72, 11, 400, C.inkMute);
  txt(ctx, "y enriquece la redacción con ejemplos concretos.", x + 56, y + 87, 11, 400, C.inkMute);
  // Fila del archivo (llega volando: fileK la muestra).
  if (fileK > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp(fileK);
    fileRow(ctx, x + 18, y + 108, w - 36);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 18.5, y + 164.5, w - 37, 28, 8);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = C.borderStrong;
  ctx.stroke();
  ctx.restore();
  icon(ctx, "library", x + w / 2 - tw("Importar de mi biblioteca", 11.5, 600) / 2 - 10, y + 178, 13, { color: C.inkSoft, width: 2 });
  txt(ctx, "Importar de mi biblioteca", x + w / 2 + 6, y + 182, 11.5, 600, C.inkSoft, "center");
  return { file: { x: x + 18, y: y + 108, w: w - 36, h: 46 } };
}
function fileRow(ctx, x, y, w) {
  fillRR(ctx, x, y, w, 46, 12, "#ffffff", C.borderStrong, 1.2);
  fillRR(ctx, x + 10, y + 8, 30, 30, 7, C.accentSoft);
  txt(ctx, "DOCX", x + 25, y + 27, 8.5, 800, C.accentInk, "center");
  txt(ctx, "La huerta de la sala.docx", x + 50, y + 21, 12.5, 600, C.ink);
  txt(ctx, "Proyecto · 3 propuestas", x + 50, y + 36, 10.5, 400, C.inkMute);
}

// Informe (fragmento) con la actividad de la planificación.
const INF_P = "Alex participa con entusiasmo de las propuestas de la sala. En el proyecto de la huerta propone ideas y ayuda a sus compañeros a organizarse.";
function informeCard(ctx, hl) {
  const w = 410;
  const x = -w / 2;
  const h = 250;
  const y = -h / 2;
  floatShadow(ctx, x, y, w, h, 16, 1.4);
  fillRR(ctx, x, y, w, h, 16, "#ffffff", C.border, 1);
  avatarN(ctx, x + 36, y + 38, 36, "Alex Ejemplo");
  txt(ctx, "Ejemplo, Alex", x + 62, y + 36, 15, 800, C.ink);
  txt(ctx, "Informe · Período Medio 2026", x + 62, y + 53, 11, 400, C.inkMute);
  ctx.fillStyle = C.border;
  ctx.fillRect(x, y + 72, w, 1);
  txt(ctx, "Formación Personal y Social", x + 22, y + 102, 14, 800, C.ink);
  const lines = wrap(INF_P, 14, 400, w - 44);
  // Resaltado del tramo de la huerta (barre de izquierda a derecha).
  const key = "En el proyecto de la huerta";
  let ly = y + 130;
  lines.forEach((l) => {
    const i = l.indexOf(key.split(" ")[0] === "En" ? "En el proyecto" : key);
    if (i >= 0 && hl > 0) {
      const pre = tw(l.slice(0, i), 14, 400);
      const full = tw(l.slice(i, i + Math.min(key.length, l.length - i)), 14, 400);
      fillRR(ctx, x + 22 + pre - 3, ly - 15, full * clamp(hl) + 6, 21, 5, C.accentSoft);
    }
    txt(ctx, l, x + 22, ly, 14, 400, C.ink);
    ly += 22;
  });
}

// ─── titulares ───────────────────────────────────────────────────────────────
const H = (text, x, baseline, size = 124) => makePhrase({ text, size, wght: 800, tracking: -0.045, x, baseline, color: C.ink, periodColor: C.accent });
const H1 = [H("De una idea", 72, 440)];
const H2 = [H("a tu", 72, 360), H("planificación.", 72, 480, 118)];
const H3 = [H("Editala", 72, 360), H("a tu gusto.", 72, 480)];
const H4 = [H("Y llevala", 72, 360), H("al informe.", 72, 480)];

function headline(ctx, t, lines, tin, tout, preset = "golpe") {
  if (t < tin - 2 || t > tout + 12) return;
  lines.forEach((ph, i) => {
    const h = tin + i * 5;
    const enter = preset === "tinta" ? tinta(h, { stagger: 0.6 }) : preset === "envio" ? envio(h) : golpe(h);
    drawPhrase(ctx, ph, t, [enter, evaporar(tout + i * 2, { stagger: 0.35, dur: 5 })]);
    if (ph.period && t < tout + 2) {
      const pd = ph.period;
      const k = spr(t, h + 2, SPR.slam);
      drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent, { scale: k, alpha: 1 - p(t, tout, tout + 4) });
    }
  });
}

// ─── ripple de toque (en pantalla) ───────────────────────────────────────────
function tapRing(ctx, x, y, t, tc) {
  const k = p(t, tc, tc + 12);
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha *= 0.6 * (1 - k);
  ctx.beginPath();
  ctx.arc(x, y, lerp(10, 70, E.outCubic(k)), 0, TAU);
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}
// El chat se desvanece al subir (como el scroll de un chat de verdad): nunca
// entra en la zona de los titulares.
const fadeY = (y) => p(y, 520, 640);
// Posición en pantalla de cada toque, tomada del rect real al dibujar.
const HIT = {};
// Punto de pantalla a partir de un punto CSS dentro de un escenario.
const sp = (st, x, y) => [st.cx + x * U * (st.s ?? 1), st.cy + y * U * (st.s ?? 1)];

// ─── tiempo (frames) ─────────────────────────────────────────────────────────
// Tiempos en frames desde el fin del gancho, sobre la grilla de 18 (beat) y 9
// (medio beat): sumando HOOK (un beat) cada golpe cae en la grilla del video.
const T = {
  send: 54, sala: 90, dur: 99, cont: 108, gen: 126,
  burst: 144, cardTap: 198, docIn: 204, docFull: 222,
  editIn: 252, type0: 258, type1: 284, editSend: 288, nueva: 294,
  fold: 324, lib: 342, row: 378, agregar: 396, land: 432,
  inf: 450, hl: 486, exit: 558, placa: 576,
};
export const PLACA_DUR = 97.4; // el cierre del logo (historia 392) cae dos beats después
export const TAPS = [T.send, T.sala, T.dur, T.cont, T.gen, T.cardTap, T.editSend, T.row, T.agregar];

const typed = (s, a, b, t) => s.slice(0, Math.round(s.length * p(t, a, b)));
const IDEA = "Un proyecto sobre la huerta";
const EDIT = "Sumá una visita al vivero";

// ─── cuadro ──────────────────────────────────────────────────────────────────
const HK2 = H("a tu planificación.", 72, 580, 110);
function hook(ctx, f) {
  backdrop(ctx, f - HOOK);
  drawPhrase(ctx, H1[0], 0, []);
  drawPhrase(ctx, HK2, f, [evaporar(6, { stagger: 0.22, dur: 5 })]);
  if (HK2.period) {
    const pd = HK2.period;
    drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent, { alpha: 1 - p(f, 8, 12) });
  }
  const tgt = [540 + (195 - 26) * U, 1380];
  const slots = [790, 1030, 1270];
  for (let i = 2; i >= 0; i--) {
    const k = E.inCubic(p(f, 4 + i * 2, 15 + i));
    stage(ctx, { cx: lerp(540, tgt[0], k), cy: lerp(slots[i], tgt[1], k), s: lerp(1, 0.06, k), rot: (i - 1) * 0.12 * k, alpha: 1 - p(f, 13 + i, 17 + i) }, (c) => planCard(c, -185, -48, 370, PLANES[i]));
  }
  const rise = E.outCubic(p(f, 6, 20));
  stage(ctx, { cx: 540, cy: 1380 + 120 * (1 - rise), alpha: rise }, (c) => composer(c, "", {}));
}

function draw(ctx, f) {
  if (f < HOOK) return hook(ctx, f);
  const t = f - HOOK;
  backdrop(ctx, t);

  if (t >= T.placa - 2) {
    drawPlaca(ctx, t, T.placa, PLACA_DUR);
    return;
  }

  // Titulares.
  headline(ctx, t, H1, -60, 116);
  headline(ctx, t, H2, 162, 214, "tinta");
  headline(ctx, t, H3, 234, 316);
  headline(ctx, t, H4, 342, T.exit, "envio");

  // ── Fase A: chat ──────────────────────────────────────────────────────────
  // Todo el chat sube cuando aparece el mensaje de generar (scroll).
  const scrollK = E.inOutCubic(p(t, 110, 122));
  const chatOut = E.inCubic(p(t, T.burst - 6, T.burst + 12));
  if (t < T.burst + 14) {
    const chatA = p(t, 2, 10) * (1 - chatOut);
    const baseY = 700 - 330 * scrollK;
    // Burbuja de la docente.
    if (t >= T.send) {
      const k = E.outBack ? E.outBack(p(t, T.send, T.send + 12)) : E.outCubic(p(t, T.send, T.send + 12));
      const by = lerp(1380, baseY, E.outCubic(p(t, T.send, T.send + 12)));
      stage(ctx, { cx: 540, cy: by, alpha: chatA * fadeY(by - 60) }, (c) => {
        userBubble(c, IDEA, 195, -21);
      });
      void k;
    }
    // Preguntas del asistente.
    if (t >= T.send + 12) {
      const a = p(t, T.send + 12, T.send + 20) * chatA;
      const sel = [t >= T.sala ? 2 : null, t >= T.dur ? 1 : null];
      const qy = baseY + 88 + 20 * (1 - E.outCubic(p(t, T.send + 12, T.send + 22)));
      const st = { cx: 540, cy: qy, alpha: a * fadeY(qy) };
      stage(ctx, st, (c) => {
        const R = assistantQuestions(c, -195, 0, sel, t >= T.cont - 2 && t < T.cont + 6 ? 1 - Math.abs(t - T.cont) / 6 : 0);
        for (const [key, tc] of [["0_2", T.sala], ["1_1", T.dur], ["cta", T.cont]]) {
          const r = R[key];
          HIT[tc] = sp(st, r.x + r.w / 2, r.y + r.h / 2);
        }
      });
    }
    // Mensaje de generar.
    if (t >= 114) {
      const a = p(t, 114, 122) * chatA;
      const press = t >= T.gen - 2 && t < T.gen + 6 ? 1 - Math.abs(t - T.gen) / 6 : 0;
      const gst = { cx: 540, cy: baseY + 88 + 530 + 16 * (1 - E.outCubic(p(t, 114, 124))), alpha: a };
      stage(ctx, gst, (c) => {
        const r = generateMsg(c, -195, 0, press, p(t, T.gen, T.gen + 6) * (1 - p(t, T.burst - 4, T.burst + 4)));
        HIT[T.gen] = sp(gst, r.cx, r.cy);
        // Generando… (el bloque real de la app, debajo del botón).
        if (t >= T.gen + 4) {
          c.save();
          c.globalAlpha *= p(t, T.gen + 4, T.gen + 9);
          fillRR(c, -153, 96, 348, 48, 12, C.surface, C.border, 1);
          c.translate(-131, 120);
          c.rotate(t * 0.25);
          icon(c, "loader-circle", 0, 0, 16, { color: C.accent, width: 2.2 });
          c.restore();
          c.save();
          c.globalAlpha *= p(t, T.gen + 4, T.gen + 9);
          txt(c, "Generando planificaciones…", -113, 125, 13, 600, C.ink);
          c.restore();
        }
      });
    }
    // Compositor abajo.
    if (t < T.burst) {
      const rise = E.outCubic(p(t, -12, 2));
      const text = t < T.send ? typed(IDEA, 20, 52, t) : "";
      stage(ctx, { cx: 540, cy: 1380 + 120 * (1 - rise), alpha: rise * (1 - chatOut) }, (c) => {
        composer(c, text, { caret: t >= 16 && t < T.send && Math.floor(t / 8) % 2 === 0, send: t >= T.send - 3 && t < T.send + 5 ? 1 - Math.abs(t - T.send) / 5 : 0 });
      });
    }
    // Toques.
    tapRing(ctx, 540 + (195 - 26) * U, 1380, t, T.send);
  }
  // Toques de las opciones y del botón (rects reales de este cuadro).
  for (const tc of [T.sala, T.dur, T.cont, T.gen]) if (HIT[tc]) tapRing(ctx, HIT[tc][0], HIT[tc][1], t, tc);

  // ── Fase B: estallido de planificaciones ──────────────────────────────────
  const btnPt = HIT[T.gen] ?? [540 - 150, 1000];
  const slots = [[540, 760], [540, 1030], [540, 1300]];
  if (t >= T.burst - 2 && t < T.docFull + 2) {
    for (let i = 2; i >= 0; i--) {
      const t0 = T.burst + i * 3;
      const k = clamp((t - t0) / 16);
      if (k <= 0) continue;
      const e = spr(t, t0, SPR.settle);
      const x = lerp(btnPt[0], slots[i][0], e);
      const y = lerp(btnPt[1], slots[i][1], e) - 90 * Math.sin(Math.PI * clamp(e));
      const s = lerp(0.25, 1, e);
      const rot = (i - 1) * 0.12 * (1 - e) + (hash1(i + 3) - 0.5) * 0.02;
      // Las que no se eligen se van hacia atrás al abrir la primera.
      let a = clamp(k * 3);
      let ss = s;
      if (i > 0 && t >= T.cardTap) {
        const out = E.inCubic(p(t, T.cardTap, T.cardTap + 14));
        a *= 1 - out;
        ss *= 1 - 0.2 * out;
      }
      if (i === 0 && t >= T.docIn) continue;
      stage(ctx, { cx: x, cy: y, s: ss * (i === 0 && t >= T.cardTap ? 1 - 0.03 * (1 - Math.abs(t - T.cardTap - 3) / 3) : 1), rot, alpha: a }, (c) => {
        planCard(c, -185, -48, 370, PLANES[i]);
      });
    }
    tapRing(ctx, 540, 760, t, T.cardTap);
  }

  // ── Fase C: la tarjeta se abre en el documento y se edita ─────────────────
  const docStage = { cx: 540, cy: 1010, s: 0.92 };
  if (t >= T.docIn && t < T.fold + 22) {
    const k = E.inOutCubic(p(t, T.docIn, T.docFull));
    // Rect de la tarjeta (370x96 en 540,760) al del documento.
    const cardW = 370;
    const cardH = 96;
    const docH = 360;
    const ek = E.inOutCubic(p(t, T.editIn, T.editIn + 12));
    const w = lerp(cardW, DOC_W, k);
    const h = lerp(cardH, docH, k) - 70 * ek;
    const cy = lerp(760, docStage.cy, k) - 60 * ek;
    const s = lerp(1, docStage.s, k);
    const scroll = 132 * ek;
    const nuevaK = p(t, T.nueva, T.nueva + 10);
    const glow = p(t, T.nueva, T.nueva + 6) * (1 - p(t, T.nueva + 16, T.nueva + 40));
    // Pliegue a archivo.
    const fk = E.inCubic(p(t, T.fold, T.fold + 16));
    stage(ctx, { cx: 540, cy: lerp(cy, 1010, fk), s: s * lerp(1, 0.42, fk), rot: -0.05 * fk, alpha: 1 - p(t, T.fold + 12, T.fold + 18) }, (c) => {
      // Cruce: el papel se estira de tarjeta a documento; el contenido de la
      // tarjeta se va y entra el del documento, sobre el mismo papel.
      planDoc(c, -w / 2, -h / 2, h, { w, scroll, nuevaK, glow, contentA: p(t, T.docIn + 8, T.docIn + 16) });
      if (k < 1) {
        c.save();
        c.globalAlpha *= 1 - p(t, T.docIn + 4, T.docIn + 12);
        c.beginPath();
        c.roundRect(-w / 2, -h / 2, w, h, 14);
        c.clip();
        planCard(c, -w / 2, -h / 2, w, PLANES[0]);
        c.restore();
      }
    });
    // Compositor de edición.
    if (t >= T.editIn && t < T.fold + 6) {
      const a = E.outCubic(p(t, T.editIn, T.editIn + 10)) * (1 - p(t, T.fold, T.fold + 6));
      stage(ctx, { cx: 540, cy: 1440 + 40 * (1 - a), s: 0.92, alpha: a }, (c) => {
        editComposer(c, t < T.editSend ? typed(EDIT, T.type0, T.type1, t) : "", {
          caret: t < T.editSend && Math.floor(t / 8) % 2 === 0,
          send: t >= T.editSend - 3 && t < T.editSend + 5 ? 1 - Math.abs(t - T.editSend) / 5 : 0,
          bannerK: a,
        });
      });
      tapRing(ctx, 540 + (195 - 26) * U * 0.92, 1440, t, T.editSend);
    }
  }

  // ── Fase D: biblioteca y período ──────────────────────────────────────────
  if (t >= T.fold + 10 && t < T.land + 4) {
    // Chip del archivo que queda del pliegue y se vuelve la fila del modal.
    const mk = E.outCubic(p(t, T.lib, T.lib + 14));
    const out = E.inCubic(p(t, T.agregar + 2, T.agregar + 9));
    stage(ctx, { cx: 540, cy: 1010, s: lerp(0.9, 1, mk) * (1 - 0.1 * out), alpha: p(t, T.fold + 10, T.fold + 18) * (1 - out) }, (c) => {
      libraryModal(c, { sel: t >= T.row, pressAgregar: t >= T.agregar - 2 && t < T.agregar + 5 ? 1 - Math.abs(t - T.agregar) / 5 : 0, rowsA: mk });
    });
    tapRing(ctx, 540, 1010 + (-150 + 66 + 25) * U, t, T.row);
    tapRing(ctx, 540 + (195 - 18 - 30) * U, 1010 + (150 - 28) * U, t, T.agregar);
  }
  // El bloque del período entra y recibe la fila.
  if (t >= T.agregar && t < T.inf + 20) {
    const bk = E.outCubic(p(t, T.agregar + 8, T.agregar + 22));
    const blockCy = 1060;
    const fileK = p(t, T.land - 2, T.land + 2);
    const toInf = E.inCubic(p(t, T.inf, T.inf + 14));
    stage(ctx, { cx: 540, cy: blockCy + 80 * (1 - bk), alpha: bk * (1 - toInf) }, (c) => {
      planifBlock(c, fileK);
    });
    // Fila que vuela del modal al bloque.
    if (t >= T.agregar + 6 && t < T.land) {
      const u = E.inOutCubic(p(t, T.agregar + 6, T.land));
      const from = [540, 1010 + (-150 + 66 + 25) * U];
      const to = [540, blockCy + (-103 + 108 + 23) * U];
      const x = lerp(from[0], to[0], u);
      const y = lerp(from[1], to[1], u) - 120 * Math.sin(Math.PI * u);
      stage(ctx, { cx: x, cy: y, s: 1 + 0.08 * Math.sin(Math.PI * u), rot: 0.04 * Math.sin(Math.PI * u) }, (c) => fileRow(c, -177, -23, 354));
    }
  }

  // ── Fase E: el archivo se vuelve informe ──────────────────────────────────
  if (t >= T.inf && t < T.exit + 16) {
    const k = E.outCubic(p(t, T.inf + 4, T.inf + 20));
    const out = E.inCubic(p(t, T.exit, T.exit + 14));
    // Chispas que salen del archivo al transformarse.
    if (t < T.inf + 22) {
      emit(ctx, (e) => {
        for (let i = 0; i < 14; i++) {
          const a = hash1(i * 3 + 1) * TAU;
          const d = 40 + 260 * E.outCubic(p(t, T.inf, T.inf + 20)) * (0.5 + hash1(i * 5));
          const al = 1 - p(t, T.inf + 6, T.inf + 22);
          e.fillStyle = `rgba(251,146,60,${0.9 * al})`;
          e.beginPath();
          e.arc(540 + Math.cos(a) * d, 1120 + Math.sin(a) * d * 0.6, 4 + 3 * hash1(i), 0, TAU);
          e.fill();
        }
      });
    }
    stage(ctx, { cx: 540, cy: 1060 + 60 * (1 - k), s: lerp(0.8, 1, k) * (1 - 0.1 * out), alpha: k * (1 - out) }, (c) => {
      informeCard(c, E.inOutCubic(p(t, T.hl, T.hl + 20)));
    });
  }

  // ── Salida: el punto de "informe." vuela a la placa ───────────────────────
  if (t >= T.exit + 4 && t < T.placa) {
    const pd = H4[1].period;
    const f0 = T.exit + 4;
    const fl = flightV(t, { t0: f0, t1: T.placa, P0: [pd.cx, pd.cy], P1: [pd.cx + 60, pd.cy - 80], P2: [PLACA_DOT.x + 60, PLACA_DOT.y - 40], P3: [PLACA_DOT.x, PLACA_DOT.y], v0: 0, v1: 14 });
    drawDot(ctx, fl.x, fl.y, lerp(pd.d, PLACA_DOT.d, p(t, f0, T.placa)), C.accent);
  } else if (t >= 346 && t < T.exit + 4) {
    // El punto sigue en su lugar mientras el titular se va.
    const pd = H4[1].period;
    if (t >= T.exit) drawDot(ctx, pd.cx, pd.cy, pd.d, C.accent);
  }
}

// Motion blur: más estela solo en las transformaciones.
const BUSY = [[T.send, T.send + 12], [T.burst - 4, T.burst + 22], [T.docIn, T.docFull], [T.fold, T.lib + 10], [T.agregar, T.land], [T.inf, T.inf + 20], [T.exit, T.placa]];
function motion(f) {
  const t = f - HOOK;
  if (f < HOOK) return f >= 4 ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
  if (t >= T.placa) return EndCard.motion(placaStory(t, T.placa, PLACA_DUR));
  return BUSY.some(([a, b]) => t >= a && t < b) ? { shutter: 0.55, samples: 10 } : { shutter: 0.2, samples: 5 };
}

export default {
  id: "reel-planificacion",
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
