// Las pantallas reales del flujo para crear informes, verificadas contra el
// código de la app (app/src/app/...). Textos literales; datos ficticios.
//
// Cada pantalla es una función (ctx, s) que dibuja la PÁGINA en coordenadas
// CSS (y = 0 arriba de todo, scrollea con la cámara) y devuelve
//   { R, pageH, nav, fixed(ctx, scrollY) }
// R: rects con nombre (para apuntar el cursor y encuadrar). fixed dibuja lo que
// no scrollea (barra lateral, barra de acciones pegada abajo).
//
// El estado s tiene: v (valores tipeados), focus (campo con foco), caret,
// press (0..1 por nombre de botón) y lo propio de cada pantalla.

import { C } from "../../shared/brand.js";
import { rr, icon } from "../../shared/ui.js";
import {
  tw, txt, mid, rect, fillRR, btn, btnWidth, tag, avatarN, fieldLabel, input, select, card, cardTitle,
  checkbox, pill, sectionLabel, dropZone, sidebar, topbar, page, APP_W, APP_H, SIDEBAR_W, TOPBAR_H,
} from "./app-ui.js";
import { clamp, lerp, mix } from "../../engine/math.js";

// ─── datos ficticios ─────────────────────────────────────────────────────────
export const SALA = "Sala Ejemplo";
export const ALUMNOS = [
  ["Alex", "Ejemplo"],
  ["Noa", "Ejemplo"],
  ["Sasha", "Ejemplo"],
  ["Dani", "Ejemplo"],
  ["Eli", "Ejemplo"],
  ["Juli", "Ejemplo"],
];
export const AREAS = [
  {
    nombre: "Formación Personal y Social",
    ind: [
      ["Aceptación de normas grupales", ["Cumple espontáneamente las normas acordadas", "Cumple las normas con recordatorios mínimos", "Cumple las normas con indicaciones frecuentes"]],
      ["Participación en propuestas grupales", ["Participa con entusiasmo y propone ideas", "Participa cuando se lo invita", "Participa con acompañamiento del adulto"]],
      ["Resolución de conflictos con pares", ["Resuelve los conflictos dialogando", "Busca al adulto para resolver conflictos", "Necesita mediación para resolver conflictos"]],
    ],
  },
  { nombre: "Prácticas del Lenguaje", ind: [["Escucha y comprensión de relatos"], ["Expresión oral de ideas"], ["Interés por la escritura"]] },
  { nombre: "Matemática", ind: [["Conteo y comparación de cantidades"], ["Uso de números en juegos"], ["Reconocimiento de formas"]] },
  { nombre: "Educación Física", ind: [["Desplazamientos y equilibrio"], ["Juegos con reglas"], ["Coordinación en actividades motrices"]] },
];
const PERIODO = "Período Medio 2026";

// Parte un texto en renglones que entren en maxW.
export function wrap(text, size, weight, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (tw(t, size, weight) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(ctx, text, x, y, size, weight, color, maxW, lh = 1.5, align = "left") {
  const lines = wrap(text, size, weight, maxW);
  lines.forEach((l, i) => txt(ctx, l, align === "center" ? x + maxW / 2 : x, y + size + i * size * lh, size, weight, color, align));
  return lines.length * size * lh;
}

const P = (s, k) => (s.press && s.press[k]) || 0;
const V = (s, k) => (s.v && s.v[k]) || "";
const F = (s, k) => (s.focus === k ? 1 : 0);
const CARET = (s, k) => s.focus === k && s.caret;

// ═════════════════════════════════════════════════════════════════════════════
// Inicio (usuaria nueva: todavía no tiene salas)
export function home(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Buen día, Ana.", "Tu trabajo está al día.", [{ key: "nuevaSala", label: "Nueva sala", icon: "plus" }], { press: s.press });
  const x = 272;
  const w = 960;
  const y = TOPBAR_H + 20;
  const h = 360;
  card(ctx, x, y, w, h, { r: 18 });
  const cx = x + w / 2;
  fillRR(ctx, cx - 28, y + 60, 56, 56, 14, C.accent);
  icon(ctx, "plus", cx, y + 88, 24, { color: "#fff", width: 2.4 });
  txt(ctx, "Tu primera sala te espera.", cx, y + 164, 24, 700, C.ink, "center", -0.022);
  para(ctx, "Cargá una sala con sus alumnos para empezar a evaluar períodos y generar informes desde acá.", cx - 180, y + 178, 13.5, 400, C.inkSoft, 360, 1.55, "center");
  const bw = btnWidth("Crear primera sala", { size: "lg", iconRight: "arrow-right" });
  R.crearPrimera = btn(ctx, cx - bw / 2, y + 266, "Crear primera sala", { size: "lg", iconRight: "arrow-right", press: P(s, "crearPrimera") });
  R.empty = rect(x, y, w, h);
  return { R, pageH: APP_H, nav: "home" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Crear nueva sala (/grupos/nuevo)
const COLORS = ["#c2410c", "#4d7c0f", "#9f3d2c", "#1e3a8a", "#7c3aed", "#0ea5e9", "#db2777", "#16a34a"];
const ICONOS = ["sun", "leaf", "box", "music", "target", "blocks", "book", "palette"];
export function nuevaSala(ctx, s) {
  page(ctx);
  const canSubmit = V(s, "nombre") && V(s, "seccion") && V(s, "docente") && s.jardin === "selected";
  const R = topbar(ctx, "Crear nueva sala", "Datos básicos, personalización y jardín", [
    { key: "cancelar", label: "Cancelar", variant: "secondary" },
    { key: "crearSala", label: s.creando ? "Creando…" : "Crear sala", icon: "plus", disabled: !canSubmit && !s.creando, spin: s.creando ? s.spin : null },
  ], { press: s.press });
  const X = 404;
  const W = 696;
  const ix = X + 24;
  const iw = W - 48;
  // Datos del grupo
  let y = TOPBAR_H + 28;
  card(ctx, X, y, W, 320);
  cardTitle(ctx, "Datos del grupo", ix, y + 22);
  let fy = y + 60;
  fieldLabel(ctx, "Nombre de la sala", ix, fy);
  R.nombre = input(ctx, ix, fy + 22, iw, { value: V(s, "nombre"), placeholder: "Ej: Sala Arcoíris", focus: F(s, "nombre"), caret: CARET(s, "nombre") });
  fy += 84;
  const hw = (iw - 16) / 2;
  fieldLabel(ctx, "Sección", ix, fy);
  R.seccion = input(ctx, ix, fy + 22, hw, { value: V(s, "seccion"), placeholder: "Ej: 2° A", focus: F(s, "seccion"), caret: CARET(s, "seccion") });
  fieldLabel(ctx, "Turno", ix + hw + 16, fy);
  R.turno = select(ctx, ix + hw + 16, fy + 22, hw, "Mañana");
  fy += 84;
  fieldLabel(ctx, "Año", ix, fy);
  input(ctx, ix, fy + 22, hw, { value: "2026" });
  fieldLabel(ctx, "Docente", ix + hw + 16, fy);
  R.docente = input(ctx, ix + hw + 16, fy + 22, hw, { value: V(s, "docente"), placeholder: "Nombre del docente", focus: F(s, "docente"), caret: CARET(s, "docente") });
  R.datos = rect(X, y, W, 320);
  // Personalización
  y += 340;
  card(ctx, X, y, W, 300);
  cardTitle(ctx, "Personalización", ix, y + 22);
  txt(ctx, "Color", ix, y + 72, 12, 600, C.inkSoft);
  COLORS.forEach((c, i) => {
    const cx = ix + 18 + i * 46;
    if (i === 0) {
      ctx.beginPath();
      ctx.arc(cx, y + 104, 21, 0, Math.PI * 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, y + 104, 17, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  txt(ctx, "Ícono", ix, y + 152, 12, 600, C.inkSoft);
  ICONOS.forEach((n, i) => {
    const bx = ix + i * 50;
    fillRR(ctx, bx, y + 164, 42, 42, 10, i === 0 ? C.accentSoft : "#fff", i === 0 ? C.accent : C.border, i === 0 ? 2 : 1);
    icon(ctx, n, bx + 21, y + 185, 18, { color: i === 0 ? C.accent : C.inkSoft, width: 2 });
  });
  fillRR(ctx, ix, y + 222, iw, 60, 12, C.surface, C.border, 1);
  fillRR(ctx, ix + 12, y + 230, 44, 44, 12, COLORS[0]);
  icon(ctx, "sun", ix + 34, y + 252, 22, { color: "#fff", width: 2 });
  txt(ctx, V(s, "nombre") || "Nombre de la sala", ix + 68, y + 250, 14, 700, C.ink);
  txt(ctx, `${V(s, "seccion") || "Sección"} · Turno Mañana`, ix + 68, y + 268, 12, 400, C.inkMute);
  // Jardín
  y += 320;
  const mode = s.jardin || "empty";
  const jh = mode === "empty" ? 244 : mode === "creating" ? 372 : 154;
  card(ctx, X, y, W, jh);
  cardTitle(ctx, "Jardín", ix, y + 22, { iconName: "school" });
  R.jardinCard = rect(X, y, W, jh);
  if (mode === "empty") {
    const cx = X + W / 2;
    icon(ctx, "school", cx, y + 98, 36, { color: C.inkMute, width: 1.8 });
    txt(ctx, "No hay jardines registrados todavía", cx, y + 142, 13, 400, C.inkSoft, "center");
    const bw = btnWidth("Crear el primero", { size: "sm", icon: "plus" });
    R.crearJardin = btn(ctx, cx - bw / 2, y + 160, "Crear el primero", { size: "sm", variant: "secondary", icon: "plus", press: P(s, "crearJardin") });
  } else if (mode === "creating") {
    let by = y + 62;
    fillRR(ctx, ix, by, iw, 58, 12, C.accentSoft, C.accent, 1);
    icon(ctx, "plus", ix + 18, by + 20, 14, { color: C.accentInk, width: 2 });
    txt(ctx, "Estás creando un jardín nuevo.", ix + 32, by + 24, 12, 700, C.accentInk);
    txt(ctx, "Primero guardalo con el botón de abajo, después seguís con los datos de la sala.", ix + 32, by + 42, 12, 400, C.accentInk);
    by += 70;
    fieldLabel(ctx, "Nombre del jardín", ix, by);
    R.jardinNombre = input(ctx, ix, by + 22, iw, { value: V(s, "jardin"), placeholder: "Ej: Jardín N° 123 'Estrellitas'", focus: F(s, "jardin"), caret: CARET(s, "jardin") });
    by += 80;
    const tw3 = (iw - 24) / 3;
    ["Localidad", "Distrito", "Región"].forEach((l, i) => {
      fieldLabel(ctx, l, ix + i * (tw3 + 12), by);
      input(ctx, ix + i * (tw3 + 12), by + 22, tw3, { placeholder: l });
    });
    by += 84;
    const gw = btnWidth("Guardar jardín", { icon: "check" });
    R.guardarJardin = btn(ctx, ix + iw - gw, by, s.guardando ? "Guardando…" : "Guardar jardín", { icon: "check", disabled: !V(s, "jardin"), press: P(s, "guardarJardin"), spin: s.guardando ? s.spin : null });
  } else {
    txt(ctx, "Crear nuevo", X + W - 24, y + 36, 12, 700, C.accent, "right");
    icon(ctx, "plus", X + W - 24 - tw("Crear nuevo", 12, 700) - 10, y + 32, 13, { color: C.accent, width: 2.2 });
    const ry = y + 62;
    fillRR(ctx, ix, ry, iw, 68, 12, C.accentSoft, C.accent, 2);
    fillRR(ctx, ix + 14, ry + 14, 40, 40, 12, C.accent);
    icon(ctx, "school", ix + 34, ry + 34, 20, { color: "#fff", width: 2 });
    txt(ctx, V(s, "jardin") || "Jardín Ejemplo", ix + 66, ry + 32, 14, 700, C.accentInk);
    txt(ctx, "Localidad Ejemplo", ix + 66, ry + 50, 12, 400, C.accentInk);
    icon(ctx, "check", ix + iw - 28, ry + 34, 20, { color: C.accent, width: 3 });
    R.jardinRow = rect(ix, ry, iw, 68);
  }
  return { R, pageH: y + jh + 40, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// La sala (/grupos/[id])
export function sala(ctx, s) {
  page(ctx);
  const n = s.alumnos ?? 0;
  const R = topbar(ctx, SALA, `2° A · Turno Mañana · ${n} ${n === 1 ? "alumno" : "alumnos"}`, [
    { key: "editarSala", label: "Editar sala", variant: "secondary" },
    { key: "nuevoPeriodo", label: "Nuevo período", icon: "plus" },
  ], { press: s.press });
  const y = TOPBAR_H + 20;
  // Períodos
  const lx = 272;
  const lw = 576;
  txt(ctx, "Períodos", lx, y + 20, 20, 700, C.ink, "left", -0.018);
  txt(ctx, "0 períodos todavía", lx, y + 40, 11.5, 400, C.inkMute);
  txt(ctx, "Nuevo", lx + lw, y + 36, 12, 600, C.accent, "right");
  icon(ctx, "plus", lx + lw - tw("Nuevo", 12, 600) - 10, y + 32, 13, { color: C.accent, width: 2.5 });
  const ey = y + 56;
  fillRR(ctx, lx, ey, lw, 190, 16, "#fffaf4");
  ctx.save();
  rr(ctx, lx + 0.75, ey + 0.75, lw - 1.5, 188.5, 16);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.borderStrong;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  fillRR(ctx, lx + lw / 2 - 24, ey + 30, 48, 48, 14, C.accentSoft);
  icon(ctx, "calendar", lx + lw / 2, ey + 54, 22, { color: C.accent, width: 2 });
  txt(ctx, "Sin períodos cargados", lx + lw / 2, ey + 106, 16, 700, C.ink, "center");
  para(ctx, "Creá tu primer período (Inicial / Medio / Final) para empezar a completar formularios y generar informes.", lx + 60, ey + 116, 12.5, 400, C.inkSoft, lw - 120, 1.5, "center");
  R.periodos = rect(lx, y, lw, 246);
  // Alumnos
  const rx = 872;
  const rw = 360;
  txt(ctx, "Alumnos", rx, y + 20, 20, 700, C.ink, "left", -0.018);
  txt(ctx, `${n} en total`, rx, y + 40, 11.5, 400, C.inkMute);
  const elw = tw("Editar lista", 12, 600);
  txt(ctx, "Editar lista", rx + rw, y + 36, 12, 600, C.accent, "right");
  icon(ctx, "user-plus", rx + rw - elw - 11, y + 32, 14, { color: C.accent, width: 2.4 });
  R.editarLista = rect(rx + rw - elw - 22, y + 20, elw + 24, 24);
  const lh = n ? 60 + n * 52 : 130;
  card(ctx, rx, ey, rw, lh, { r: 14 });
  input(ctx, rx + 12, ey + 12, rw - 24, { h: 36, fs: 13, placeholder: "Buscar alumno…", bg: C.surface });
  if (!n) txt(ctx, "No hay alumnos en esta sala todavía.", rx + rw / 2, ey + 88, 13, 400, C.inkMute, "center");
  for (let i = 0; i < n; i++) {
    const ry = ey + 58 + i * 52;
    const [nom, ape] = ALUMNOS[i];
    if (i) {
      ctx.fillStyle = C.border;
      ctx.fillRect(rx, ry, rw, 1);
    }
    avatarN(ctx, rx + 30, ry + 26, 36, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, rx + 58, ry + 31, 13, 700, C.ink);
  }
  R.alumnos = rect(rx, y, rw, 56 + lh);
  return { R, pageH: APP_H, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Alumnos de la sala (/grupos/[id]/alumnos)
export function alumnos(ctx, s) {
  page(ctx);
  const n = s.alumnos ?? 0;
  const R = topbar(ctx, `Alumnos · ${SALA}`, `${n} ${n === 1 ? "alumno" : "alumnos"} en total`, [
    { key: "abrirSala", label: "Abrir sala", variant: "secondary" },
    { key: "agregar", label: s.form ? "Cerrar formulario" : "Agregar alumno", icon: "user-plus" },
  ], { press: s.press });
  const X = 354;
  const W = 800;
  let y = TOPBAR_H + 32;
  if (s.form) {
    const h = 262;
    card(ctx, X, y, W, h, { r: 14 });
    const ix = X + 20;
    const iw = W - 40;
    const hw = (iw - 8) / 2;
    R.nombre = input(ctx, ix, y + 20, hw, { h: 40, fs: 13, value: V(s, "nombre"), placeholder: "Nombre", focus: F(s, "nombre"), caret: CARET(s, "nombre") });
    R.apellido = input(ctx, ix + hw + 8, y + 20, hw, { h: 40, fs: 13, value: V(s, "apellido"), placeholder: "Apellido", focus: F(s, "apellido"), caret: CARET(s, "apellido") });
    txt(ctx, "FECHA DE NACIMIENTO", ix, y + 80, 10, 600, C.inkSoft, "left", 0.05);
    R.fecha = input(ctx, ix, y + 88, iw, { h: 40, fs: 13, placeholder: "dd/mm/aaaa" });
    txt(ctx, "GÉNERO", ix, y + 148, 10, 600, C.inkSoft, "left", 0.05);
    fillRR(ctx, ix, y + 156, iw, 38, 10, "#fff", C.border, 1);
    ["Femenino", "Masculino", "Otro"].forEach((g, i) => {
      txt(ctx, g, ix + (iw / 3) * (i + 0.5), mid(y + 156, 38, 12), 12, 600, C.inkSoft, "center");
    });
    R.genero = rect(ix, y + 156, iw, 38);
    const cw = btnWidth("Cancelar", { variant: "secondary" });
    R.agregarForm = btn(ctx, ix, y + 206, s.guardando ? "Guardando…" : "Agregar alumno", { w: iw - cw - 8, press: P(s, "agregarForm"), disabled: !(V(s, "nombre") && V(s, "apellido")) });
    btn(ctx, ix + iw - cw, y + 206, "Cancelar", { variant: "secondary" });
    R.form = rect(X, y, W, h);
    y += h + 20;
  }
  const lh = n ? n * 68 : 110;
  card(ctx, X, y, W, lh, { r: 14 });
  if (!n) txt(ctx, "No hay alumnos en esta sala todavía.", X + W / 2, y + 60, 13, 400, C.inkMute, "center");
  for (let i = 0; i < n; i++) {
    const ry = y + i * 68;
    const [nom, ape] = ALUMNOS[i];
    const a = s.rowIn ? clamp(s.rowIn(i)) : 1;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(0, 10 * (1 - a));
    if (i) {
      ctx.fillStyle = C.border;
      ctx.fillRect(X, ry, W, 1);
    }
    avatarN(ctx, X + 40, ry + 34, 40, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, X + 72, ry + 39, 14, 700, C.ink);
    icon(ctx, "pencil", X + W - 64, ry + 34, 15, { color: C.inkMute, width: 2 });
    icon(ctx, "trash-2", X + W - 30, ry + 34, 15, { color: C.inkMute, width: 2 });
    ctx.restore();
  }
  R.lista = rect(X, y, W, lh);
  return { R, pageH: Math.max(APP_H, y + lh + 40), nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Nuevo período, paso 1 de 2 (/grupos/[id]/nuevo-periodo)
function stepPills(ctx, x, y, step) {
  const items = [[1, "Cargar documentos"], [2, "Revisar áreas"]];
  let cx = x;
  items.forEach(([n, l], i) => {
    if (i) {
      ctx.fillStyle = step > 1 ? C.accent : C.border;
      ctx.fillRect(cx, y + 14, 32, 2);
      cx += 40;
    }
    const active = step === n;
    const done = step > n;
    const w = 14 + 18 + 8 + tw(l, 12, 600) + 14;
    fillRR(ctx, cx, y, w, 30, 15, active ? C.accent : done ? C.successSoft : "#fff", active || done ? null : C.border, 1);
    ctx.beginPath();
    ctx.arc(cx + 23, y + 15, 9, 0, Math.PI * 2);
    ctx.fillStyle = active ? "rgba(255,255,255,0.25)" : done ? C.success : C.border;
    ctx.fill();
    if (done) icon(ctx, "check", cx + 23, y + 15, 12, { color: "#fff", width: 3 });
    else txt(ctx, String(n), cx + 23, y + 18.6, 10, 700, active ? "#fff" : C.inkMute, "center");
    txt(ctx, l, cx + 40, mid(y, 30, 12), 12, 600, active ? "#fff" : done ? C.success : C.inkMute);
    cx += w + 8;
  });
}
function textarea(ctx, x, y, w, h, placeholder) {
  fillRR(ctx, x, y, w, h, 12, "#fff", C.border, 1);
  const lines = wrap(placeholder, 12, 400, w - 28);
  lines.slice(0, Math.floor((h - 16) / 18)).forEach((l, i) => txt(ctx, l, x + 14, y + 24 + i * 18, 12, 400, C.inkMute));
}
export function wizard1(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Nuevo período", "Cargá tus documentos", [{ key: "cancelar", label: "Cancelar", variant: "ghost" }]);
  const X = 424;
  const W = 656;
  let y = TOPBAR_H + 40;
  stepPills(ctx, X, y, 1);
  y += 58;
  txt(ctx, "Cargá tu planificación", X, y + 26, 26, 700, C.ink, "left", -0.025);
  txt(ctx, "y el resumen evaluativo.", X, y + 56, 26, 700, C.ink, "left", -0.025);
  y += 70;
  y += para(ctx, "Para Sala Ejemplo · ciclo 2026. Si solo tenés la planificación, podemos redactar el documento pedagógico evaluativo automáticamente desde ahí — vas a poder revisarlo y editarlo antes de continuar.", X, y, 14, 400, C.inkSoft, W, 1.5) + 24;
  R.encabezado = rect(X, TOPBAR_H + 98, W, y - TOPBAR_H - 98);
  sectionLabel(ctx, "Período", X, y);
  const pw = (W - 16) / 3;
  const tipo = s.tipo ?? "inicial";
  ["Inicial", "Medio", "Final"].forEach((l, i) => {
    R[`tipo${l}`] = pill(ctx, X + i * (pw + 8), y + 20, pw, 45, l, tipo === l.toLowerCase());
  });
  R.periodo = rect(X, y, W, 65);
  y += 89;
  sectionLabel(ctx, "Opciones por indicador", X, y);
  const ow = (W - 24) / 4;
  [2, 3, 4, 5].forEach((n, i) => {
    R[`op${n}`] = pill(ctx, X + i * (ow + 8), y + 20, ow, 45, String(n), (s.opciones ?? 3) === n);
  });
  y += 73;
  const oh = para(ctx, "Cuántas opciones vas a elegir para cada indicador, de mayor a menor logro. Después podés agregar o borrar las que quieras.", X, y - 6, 11.5, 400, C.inkMute, W, 1.55);
  R.opciones = rect(X, y - 73, W, 73 + oh);
  y += oh + 24;
  sectionLabel(ctx, "Áreas a evaluar", X, y, "(opcional)");
  input(ctx, X, y + 20, W, { h: 42, fs: 13, placeholder: "Escribí un área y presioná Enter…" });
  y += 86;
  // Planificación del período (opcional)
  const py0 = y;
  fillRR(ctx, X, y, 28, 28, 8, C.accentSoft);
  icon(ctx, "list-checks", X + 14, y + 14, 14, { color: C.accentInk, width: 2 });
  txt(ctx, "Planificación del período", X + 38, y + 14, 13, 700, C.ink);
  txt(ctx, "OPCIONAL", X + 38 + tw("Planificación del período", 13, 700) + 8, y + 14, 10, 400, C.inkMute, "left", 0.05);
  para(ctx, "Subí las actividades que realizaste. Trazo Inicial las cruza con los indicadores del cuadro y enriquece la redacción con ejemplos concretos.", X + 38, y + 16, 11, 400, C.inkMute, W - 38, 1.5);
  y += 62;
  R.planifDrop = dropZone(ctx, X, y, W, 104, "Arrastrá acá o tocá para subir", ".pdf o .docx · planificación de actividades");
  y += 116;
  btn(ctx, X, y, "Importar de mi biblioteca", { size: "sm", variant: "secondary", icon: "library" });
  y += 50;
  txt(ctx, "Notas de la docente sobre la planificación", X, y + 12, 12, 600, C.inkSoft);
  txt(ctx, "(opcional)", X + tw("Notas de la docente sobre la planificación", 12, 600) + 6, y + 12, 12, 400, C.inkMute);
  textarea(ctx, X, y + 22, W, 64, '"No hicimos la actividad de la salida a la plaza por la lluvia." / "La estación de plastilina la hicimos solo con un grupo chico."');
  y += 100;
  R.planif = rect(X, py0, W, y - py0);
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = C.border;
  ctx.beginPath();
  ctx.moveTo(X, y + 12);
  ctx.lineTo(X + W, y + 12);
  ctx.stroke();
  ctx.restore();
  y += 36;
  // Documento pedagógico evaluativo (resumen)
  const dy0 = y;
  sectionLabel(ctx, "Documento pedagógico evaluativo (resumen)", X, y);
  y += 22;
  if (s.archivo) {
    const k = clamp(s.archivo);
    ctx.save();
    ctx.globalAlpha *= k;
    fillRR(ctx, X, y, W, 58, 12, "#fff", C.borderStrong, 1.5);
    fillRR(ctx, X + 12, y + 11, 36, 36, 8, C.accentSoft);
    txt(ctx, "PDF", X + 30, y + 33, 10, 800, C.accentInk, "center");
    txt(ctx, "Resumen evaluativo Medio.pdf", X + 60, y + 27, 13, 600, C.ink);
    txt(ctx, "412 KB", X + 60, y + 43, 11, 400, C.inkMute);
    icon(ctx, "x", X + W - 24, y + 29, 14, { color: C.inkMute, width: 2 });
    ctx.restore();
    R.archivo = rect(X, y, W, 58);
    y += 68;
    R.docDrop = dropZone(ctx, X, y, W, 70, "Sumar otro documento", ".pdf o .docx · resumen evaluativo");
    y += 82;
  } else {
    R.docDrop = dropZone(ctx, X, y, W, 110, "Arrastrá acá o tocá para subir", ".pdf o .docx · resumen evaluativo");
    y += 122;
  }
  R.documento = rect(X, dy0, W, y - dy0);
  sectionLabel(ctx, "Contexto del resumen", X, y, "(opcional)");
  textarea(ctx, X, y + 20, W, 80, '"Este año el jardín priorizó el trabajo en pareja pedagógica. Para el indicador de socialización dar peso al juego cooperativo más que a la autonomía individual."');
  y += 132;
  sectionLabel(ctx, "O pegá el texto", X, y);
  textarea(ctx, X, y + 20, W, 90, "Pegá acá el contenido del resumen evaluativo si no tenés el archivo a mano…");
  y += 130;
  if (s.analizando) {
    fillRR(ctx, X, y, W, 86, 14, C.accentSoft, C.accent, 1);
    ctx.save();
    ctx.translate(X + 26, y + 24);
    ctx.rotate(s.spin ?? 0);
    icon(ctx, "loader-circle", 0, 0, 20, { color: C.accentInk, width: 2.2 });
    ctx.restore();
    txt(ctx, "Generando formulario…", X + 48, y + 28, 13, 700, C.accentInk);
    para(ctx, `Tiempo transcurrido: ${s.elapsed ?? 0}s. La duración depende del volumen del documento. Podés cerrar la pestaña: el proceso sigue corriendo en el servidor.`, X + 48, y + 34, 13, 400, C.accentInk, W - 72, 1.45);
    R.banner = rect(X, y, W, 86);
    y += 106;
  }
  R.generarForm = btn(ctx, X, y, s.analizando ? "Generando…" : "Generar Formulario", {
    size: "lg", w: W, iconRight: "arrow-right", press: P(s, "generarForm"), disabled: !s.archivo && !s.analizando, spin: s.analizando ? s.spin : null,
  });
  return { R, pageH: y + 90, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Nuevo período, paso 2 de 2: revisar áreas
export function wizard2(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Nuevo período", "Revisá las áreas", [{ key: "cancelar", label: "Cancelar", variant: "ghost" }]);
  const X = 424;
  const W = 656;
  let y = TOPBAR_H + 40;
  stepPills(ctx, X, y, 2);
  y += 58;
  txt(ctx, "Revisá las", X, y + 26, 26, 700, C.ink, "left", -0.025);
  txt(ctx, "áreas.", X, y + 56, 26, 700, C.ink, "left", -0.025);
  y += 70;
  y += para(ctx, "Trazo Inicial detectó 4 áreas. Editá, agregá o eliminá lo que haga falta antes de confirmar.", X, y, 14, 400, C.inkSoft, W, 1.5) + 24;
  fillRR(ctx, X, y, W, 60, 12, C.successSoft, C.success, 1);
  icon(ctx, "circle-check", X + 26, y + 30, 20, { color: C.success, width: 2 });
  txt(ctx, "4 áreas · 12 indicadores · 36 sugerencias", X + 48, y + 26, 13, 700, C.success);
  txt(ctx, "Editá, eliminá o agregá indicadores y sugerencias antes de confirmar.", X + 48, y + 44, 11, 400, C.success);
  R.resumen = rect(X, y, W, 60);
  y += 80;
  const off = s.noEvaluar || [];
  AREAS.forEach((a, ai) => {
    const evaluada = !off.includes(ai);
    const openInd = ai === 0 && s.expandir ? 0 : -1;
    const rows = a.ind.length;
    const sugH = openInd >= 0 ? a.ind[0][1].length * 22 + 44 : 0;
    const h = 46 + rows * 38 + sugH + 54;
    ctx.save();
    ctx.globalAlpha *= evaluada ? 1 : 0.55;
    card(ctx, X, y, W, h);
    ctx.save();
    rr(ctx, X, y, W, h, 16);
    ctx.clip();
    ctx.fillStyle = C.surface;
    ctx.fillRect(X, y, W, 46);
    ctx.fillStyle = C.border;
    ctx.fillRect(X, y + 46, W, 1);
    ctx.restore();
    ctx.restore();
    // El checkbox se ve siempre nítido (es lo que se toca).
    R[`check${ai}`] = checkbox(ctx, X + 16, y + 15, 16, evaluada ? 1 : 0);
    ctx.save();
    ctx.globalAlpha *= evaluada ? 1 : 0.55;
    icon(ctx, "grip-vertical", X + 48, y + 23, 16, { color: C.inkMute, width: 2 });
    icon(ctx, "layers", X + 68, y + 23, 16, { color: C.accent, width: 2 });
    txt(ctx, a.nombre, X + 84, mid(y, 46, 14), 14, 700, C.ink);
    let bx = X + 84 + tw(a.nombre, 14, 700) + 8;
    const bl = `${rows} indicadores`;
    fillRR(ctx, bx, y + 14, tw(bl, 10, 600) + 16, 18, 9, C.accentSoft);
    txt(ctx, bl, bx + 8, y + 27, 10, 600, C.accentInk);
    bx += tw(bl, 10, 600) + 24;
    if (!evaluada) {
      fillRR(ctx, bx, y + 14, tw("No evaluar", 10, 600) + 16, 18, 9, C.surface, C.border, 1);
      txt(ctx, "No evaluar", bx + 8, y + 27, 10, 600, C.inkMute);
    }
    icon(ctx, "trash-2", X + W - 24, y + 23, 15, { color: C.inkMute, width: 2 });
    let iy = y + 54;
    a.ind.forEach(([nombre, sugs], ii) => {
      const open = ii === openInd;
      icon(ctx, open ? "chevron-down" : "chevron-right", X + 22, iy + 15, 14, { color: C.inkMute, width: 2 });
      txt(ctx, `${ii + 1}.`, X + 38, iy + 20, 12, 600, C.accent);
      txt(ctx, nombre, X + 60, iy + 20, 13, 500, C.ink);
      fillRR(ctx, X + W - 60, iy + 6, 40, 18, 9, C.accentSoft);
      icon(ctx, "sparkles", X + W - 48, iy + 15, 10, { color: C.accentInk, width: 2 });
      txt(ctx, "3", X + W - 36, iy + 19, 10, 600, C.accentInk);
      iy += 38;
      if (open) {
        R.sugerencias = rect(X + 16, iy - 38, W - 32, 38 + sugs.length * 22 + 36);
        sugs.forEach((sg, si) => {
          txt(ctx, `${si + 1}.`, X + 60, iy + 13, 11, 600, C.inkMute);
          txt(ctx, sg, X + 76, iy + 13, 11, 400, C.inkSoft);
          iy += 22;
        });
        fillRR(ctx, X + 60, iy + 2, W - 120, 28, 6, null);
        ctx.save();
        rr(ctx, X + 60.5, iy + 2.5, W - 121, 27, 6);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = C.borderStrong;
        ctx.stroke();
        ctx.restore();
        txt(ctx, "Agregar sugerencia…", X + 70, iy + 20, 11, 400, C.inkMute);
        iy += 44;
      }
    });
    ctx.save();
    rr(ctx, X + 16.5, iy + 4.5, W - 110, 34, 8);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.borderStrong;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    txt(ctx, "Agregar indicador…", X + 30, iy + 26, 12, 400, C.inkMute);
    icon(ctx, "plus", X + W - 76, iy + 21, 14, { color: C.accent, width: 2.4 });
    txt(ctx, "Agregar", X + W - 66, iy + 26, 12, 700, C.accent);
    ctx.restore();
    R[`area${ai}`] = rect(X, y, W, h);
    y += h + 12;
  });
  input(ctx, X, y + 6, W, { h: 42, fs: 13, placeholder: "Agregar nueva área (ej: Música)…" });
  y += 70;
  const bw = (W - 10) / 3;
  btn(ctx, X, y, "Atrás", { size: "lg", variant: "secondary", icon: "arrow-left", w: bw });
  R.confirmar = btn(ctx, X + bw + 10, y, s.confirmando ? "Creando…" : "Confirmar y crear formularios", {
    size: "lg", w: W - bw - 10, iconRight: "check", press: P(s, "confirmar"), spin: s.confirmando ? s.spin : null,
  });
  return { R, pageH: y + 90, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Formulario del período (/grupos/[id]/periodos/[pid]/formulario)
const MAIN_X = SIDEBAR_W + 280;
const FX = MAIN_X + 36;
const FW = 672;
function chipBox(ctx, x, y, w, text, on) {
  const lines = wrap(text, 12, 500, w - 34);
  const h = 16 + lines.length * 16;
  fillRR(ctx, x, y, w, h, 16, on ? C.accent : C.surface, on ? C.accent : C.border, 1);
  if (on) icon(ctx, "check", x + 18, y + 16, 12, { color: "#fff", width: 3 });
  lines.forEach((l, i) => txt(ctx, l, x + (on ? 30 : 12), y + 20 + i * 16, 12, 500, on ? "#fff" : C.inkSoft));
  return rect(x, y, w, h);
}
export function formulario(ctx, s) {
  page(ctx);
  const listos = s.listos ?? 0;
  const R = topbar(ctx, `${SALA} · ${PERIODO}`, `6 alumnos · ${listos} listos · ${6 - listos} te faltan`, [
    { key: "editarEval", label: "Editar evaluación", variant: "secondary" },
    { key: "generarInforme", label: "Generar informe", iconRight: "arrow-right" },
  ], { press: s.press });
  const sel = s.alumno ?? -1;
  let y = TOPBAR_H + 28;
  if (sel < 0) {
    ctx.save();
    rr(ctx, FX + 0.5, y + 0.5, FW - 1, 140, 14);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.borderStrong;
    ctx.stroke();
    ctx.restore();
    txt(ctx, "Seleccioná un alumno.", FX + FW / 2, y + 76, 13, 400, C.inkMute, "center");
  } else {
    const [nom, ape] = ALUMNOS[sel];
    avatarN(ctx, FX + 28, y + 28, 56, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, FX + 70, y + 26, 24, 700, C.ink, "left", -0.02);
    if (s.completo) tag(ctx, FX + 70 + tw(`${ape}, ${nom}`, 24, 700) + 10, y + 8, "completo", "success");
    txt(ctx, `${SALA} · Período Medio 2026`, FX + 70, y + 46, 12, 400, C.inkMute);
    R.alumnoHeader = rect(FX, y, FW, 56);
    y += 76;
    // Pestañas de áreas
    let tx = FX;
    const tab = s.tab ?? 0;
    AREAS.forEach((a, i) => {
      const done = i < tab;
      const w = tw(a.nombre, 12, 600) + 24 + (done ? 17 : 0);
      const on = i === tab;
      fillRR(ctx, tx, y, w, 30, 8, on ? C.accent : null, on ? C.accent : C.border, 1);
      if (done) icon(ctx, "check", tx + 18, y + 15, 12, { color: C.inkSoft, width: 2.5 });
      txt(ctx, a.nombre, tx + 12 + (done ? 17 : 0), mid(y, 30, 12), 12, 600, on ? "#fff" : done ? C.inkSoft : C.inkMute);
      R[`tab${i}`] = rect(tx, y, w, 30);
      tx += w + 6;
    });
    y += 44;
    fillRR(ctx, FX, y, FW, 42, 12, "#fff", C.border, 1);
    icon(ctx, "sticky-note", FX + 22, y + 21, 15, { color: C.inkSoft, width: 2 });
    txt(ctx, "Nota de este período", FX + 38, mid(y, 42, 12.5), 12.5, 600, C.ink);
    txt(ctx, "(opcional)", FX + 44 + tw("Nota de este período", 12.5, 600), mid(y, 42, 12), 12, 400, C.inkMute);
    y += 58;
    const area = AREAS[tab];
    txt(ctx, area.nombre, FX, y + 18, 17, 700, C.ink, "left", -0.01);
    y += 34;
    const inds = tab === 0 ? AREAS[0].ind : area.ind.map(([n]) => [n, ["Lo logra con autonomía", "Lo logra con apoyo", "En proceso"]]);
    inds.forEach(([nombre, sugs], ii) => {
      const st = (s.ind && s.ind[ii]) || { sel: null, active: false };
      const x = FX;
      if (st.active) {
        const cw = (FW - 28 - 6) / 2;
        let ch = 0;
        const cells = sugs.map((sg) => wrap(sg, 12, 500, cw - 34).length);
        const rowsH = [Math.max(cells[0], cells[1] ?? 0), cells[2] ?? 0].map((l) => 16 + l * 16);
        ch = rowsH[0] + 6 + rowsH[1] + 6 + 26;
        const nota = st.nota ?? "";
        const h = 14 + 16 + 10 + 14 + 8 + ch + 14 + 14 + 8 + 56 + 14;
        ctx.save();
        fillRR(ctx, x - 4, y - 4, FW + 8, h + 8, 18, C.accentSoft);
        ctx.restore();
        fillRR(ctx, x, y, FW, h, 14, "#fff", C.accent, 1);
        txt(ctx, nombre, x + 14, y + 26, 12, 600, C.ink);
        txt(ctx, "SUGERENCIAS", x + 14, y + 52, 10, 700, C.inkMute, "left", 0.08);
        let cy = y + 60;
        sugs.forEach((sg, si) => {
          const col = si % 2;
          const row = Math.floor(si / 2);
          const ry = cy + (row ? rowsH[0] + 6 : 0);
          R[`chip${ii}_${si}`] = chipBox(ctx, x + 14 + col * (cw + 6), ry, cw, sg, st.sel === si);
        });
        cy += rowsH[0] + 6 + rowsH[1] + 6;
        fillRR(ctx, x + 14, cy, tw("Escribir la mía", 11, 500) + 32, 24, 12, null);
        icon(ctx, "plus", x + 26, cy + 12, 11, { color: C.accent, width: 2.4 });
        txt(ctx, "Escribir la mía", x + 36, cy + 16, 11, 500, C.accent);
        cy += 40;
        ctx.fillStyle = C.border;
        ctx.fillRect(x + 14, cy, FW - 28, 1);
        txt(ctx, "NOTA PERSONAL", x + 14, cy + 22, 10, 700, C.inkMute, "left", 0.08);
        txt(ctx, "(opcional · enriquece la redacción)", x + 14 + tw("NOTA PERSONAL", 10, 700) * 1.09 + 6, cy + 22, 10, 400, C.inkMute);
        const ny = cy + 30;
        fillRR(ctx, x + 14, ny, FW - 28, 54, 8, C.surface, s.focus === `nota${ii}` ? C.accent : C.border, 1);
        if (nota) {
          txt(ctx, nota, x + 24, ny + 22, 12, 400, C.ink);
          if (s.caret && s.focus === `nota${ii}`) {
            ctx.fillStyle = C.ink;
            ctx.fillRect(x + 25 + tw(nota, 12, 400), ny + 10, 1.5, 16);
          }
        } else wrap("Ej: esta semana se animó por primera vez al sector de equilibrio sin pedirme la mano.", 12, 400, FW - 48).slice(0, 2).forEach((l, i) => txt(ctx, l, x + 24, ny + 22 + i * 17, 12, 400, C.inkMute));
        R[`nota${ii}`] = rect(x + 14, ny, FW - 28, 54);
        R[`ind${ii}`] = rect(x, y, FW, h);
        y += h + 10;
      } else if (st.sel !== null && st.sel !== undefined) {
        const h = 62;
        fillRR(ctx, x, y, FW, h, 14, "#fff", C.border, 1);
        txt(ctx, nombre, x + 14, y + 24, 12, 600, C.ink);
        tag(ctx, x + FW - 14 - tw("listo", 11, 600) - 16, y + 10, "listo", "success");
        txt(ctx, sugs[st.sel] + (st.nota ? " · + nota personal" : ""), x + 14, y + 46, 11, 400, C.inkSoft);
        R[`ind${ii}`] = rect(x, y, FW, h);
        y += h + 10;
      } else {
        const h = 72;
        fillRR(ctx, x, y, FW, h, 14, "#fff", C.border, 1);
        txt(ctx, nombre, x + 14, y + 24, 12, 600, C.ink);
        let cx = x + 14;
        sugs.forEach((sg) => {
          const w = Math.min(260, tw(sg, 11, 500)) + 20;
          fillRR(ctx, cx, y + 36, w, 24, 12, C.surface, C.border, 1);
          txt(ctx, sg, cx + 10, y + 52, 11, 500, C.inkSoft);
          cx += w + 6;
        });
        R[`ind${ii}`] = rect(x, y, FW, h);
        y += h + 10;
      }
    });
  }
  const pageH = Math.max(APP_H, y + 120);
  const fixed = (c, sy) => {
    // Barra lateral de alumnos (280 px, no scrollea).
    c.save();
    c.translate(0, sy);
    c.fillStyle = "#fff";
    c.fillRect(SIDEBAR_W, TOPBAR_H - Math.min(sy, TOPBAR_H), 280, APP_H);
    c.fillStyle = C.border;
    c.fillRect(SIDEBAR_W + 279, 0, 1, APP_H);
    const top = Math.max(0, TOPBAR_H - sy);
    const gx = SIDEBAR_W + 8;
    let gy = top + 12;
    const gen = s.general ?? 0;
    fillRR(c, gx, gy, 264, 52, 10, gen ? C.accentSoft : "#fff", gen ? C.accent : C.borderStrong, 1.5);
    c.beginPath();
    c.arc(gx + 28, gy + 26, 16, 0, Math.PI * 2);
    c.fillStyle = C.accentSoft;
    c.fill();
    icon(c, "layout-grid", gx + 28, gy + 26, 16, { color: C.accent, width: 2.2 });
    txt(c, "General", gx + 54, gy + 23, 13, 700, C.ink);
    txt(c, "vista por sugerencia", gx + 54, gy + 38, 10, 400, C.inkMute);
    R.general = rect(gx, gy + sy, 264, 52);
    gy += 66;
    c.fillStyle = C.border;
    c.fillRect(gx + 8, gy, 248, 1);
    gy += 10;
    input(c, gx + 4, gy, 256, { h: 34, fs: 12.5, placeholder: "Buscar alumno…", bg: C.surface });
    gy += 44;
    ALUMNOS.forEach(([nom, ape], i) => {
      const on = i === sel;
      const done = (s.listoAlumno && s.listoAlumno(i)) || false;
      if (on) fillRR(c, gx, gy, 264, 50, 10, C.accentSoft);
      avatarN(c, gx + 28, gy + 25, 32, `${nom} ${ape}`);
      txt(c, `${ape}, ${nom}`, gx + 52, gy + 23, 13, on ? 700 : 600, on ? C.accentInk : C.ink);
      txt(c, on ? "● en edición" : done ? "✓ listo" : "pendiente", gx + 52, gy + 38, 10, 400, on ? C.accentInk : done ? C.success : C.inkMute);
      if (done && !on) {
        c.beginPath();
        c.arc(gx + 250, gy + 25, 3, 0, Math.PI * 2);
        c.fillStyle = C.success;
        c.fill();
      }
      R[`alumno${i}`] = rect(gx, gy + sy, 264, 50);
      gy += 54;
    });
    // Barra de acciones pegada abajo.
    if (sel >= 0) {
      const by = APP_H - 70;
      c.fillStyle = C.surface;
      c.fillRect(MAIN_X, by, APP_W - MAIN_X, 70);
      c.fillStyle = C.border;
      c.fillRect(MAIN_X, by, APP_W - MAIN_X, 1);
      const bx = FX;
      const aw = (FW - 10) / 3;
      btn(c, bx, by + 12, "Anterior", { variant: "secondary", icon: "arrow-left", w: aw, disabled: (s.tab ?? 0) === 0 });
      R.siguiente = btn(c, bx + aw + 10, by + 12, "Siguiente sección", { w: FW - aw - 10, iconRight: "arrow-right", press: P(s, "siguiente") });
      R.siguiente.y += sy;
      R.siguiente.cy += sy;
      R.barra = rect(MAIN_X, by + sy, APP_W - MAIN_X, 70);
    }
    c.restore();
  };
  return { R, pageH, nav: "groups", fixed };
}

// ═════════════════════════════════════════════════════════════════════════════
// Generar informes (/grupos/[id]/periodos/[pid]/generar): selección y modal
export function generar(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Generar informes", `${SALA} · ${PERIODO}`, [{ key: "volver", label: "Volver al formulario", variant: "ghost", icon: "arrow-left" }]);
  const X = 452;
  const W = 600;
  let y = TOPBAR_H + 24;
  txt(ctx, `${SALA} · ${PERIODO}`, X, y + 12, 12, 400, C.inkMute);
  txt(ctx, "Generar informes", X, y + 46, 26, 700, C.ink, "left", -0.025);
  txt(ctx, "Elegí los alumnos para los que Trazo Inicial va a redactar el informe.", X, y + 74, 14, 400, C.inkSoft);
  y += 96;
  fillRR(ctx, X, y, W, 68, 14, C.accentSoft, C.accent, 1);
  fillRR(ctx, X + 14, y + 14, 40, 40, 12, C.accent);
  icon(ctx, "sparkles", X + 34, y + 34, 20, { color: "#fff", width: 2 });
  txt(ctx, "6 de 6 formularios completos", X + 66, y + 30, 13, 700, C.accentInk);
  txt(ctx, "1 informe = 1 crédito", X + 66, y + 48, 11, 400, C.accentInk);
  R.credito = rect(X, y, W, 68);
  y += 84;
  fillRR(ctx, X, y, W, 42, 12, "#fff", C.border, 1);
  const pl = "Personalizar formato del informe";
  icon(ctx, "sliders-horizontal", X + W / 2 - tw(pl, 13, 600) / 2 - 12, y + 21, 16, { color: C.accent, width: 2 });
  txt(ctx, pl, X + W / 2 + 12, mid(y, 42, 13), 13, 600, C.ink, "center");
  y += 58;
  const nsel = s.seleccion ?? 0;
  const all = nsel === 6;
  txt(ctx, all ? "Deseleccionar todos" : "Seleccionar todos", X, y + 14, 13, 600, C.accent);
  R.todos = rect(X - 4, y - 2, tw("Seleccionar todos", 13, 600) + 8, 24);
  txt(ctx, `${nsel} seleccionado${nsel !== 1 ? "s" : ""}`, X + W, y + 14, 12, 400, C.inkMute, "right");
  y += 28;
  card(ctx, X, y, W, 6 * 60, { r: 14 });
  ALUMNOS.forEach(([nom, ape], i) => {
    const ry = y + i * 60;
    if (i) {
      ctx.fillStyle = C.border;
      ctx.fillRect(X, ry, W, 1);
    }
    checkbox(ctx, X + 16, ry + 20, 20, i < nsel ? 1 : 0);
    avatarN(ctx, X + 66, ry + 30, 36, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, X + 94, ry + 26, 13, 700, C.ink);
    tag(ctx, X + 94, ry + 34, "listo", "success", { h: 18, fs: 10 });
  });
  R.lista = rect(X, y, W, 360);
  y += 380;
  R.generar = btn(ctx, X, y, `Generar informes (${nsel})`, { size: "lg", w: W, icon: "sparkles", disabled: nsel === 0, press: P(s, "generar") });
  txt(ctx, `Vas a usar ${nsel} crédito${nsel !== 1 ? "s" : ""} de tu balance (tenés 10 disponibles).`, X + W / 2, y + 78, 11, 400, C.inkMute, "center");
  R.generarZona = rect(X, y, W, 90);
  const pageH = y + 120;
  const fixed = (c, sy) => {
    const m = s.modal ?? 0;
    if (m <= 0.001) return;
    c.save();
    c.translate(0, sy);
    c.fillStyle = `rgba(28,25,23,${0.42 * m})`;
    c.fillRect(0, 0, APP_W, APP_H);
    const mw = 480;
    const mh = 300;
    const mx = (APP_W - mw) / 2;
    const my = (APP_H - mh) / 2 + 16 * (1 - m);
    c.globalAlpha *= m;
    fillRR(c, mx, my, mw, mh, 18, "#fff", C.border, 1);
    txt(c, "¿Generar 6 informes?", mx + 24, my + 40, 18, 700, C.ink);
    txt(c, `${SALA} · Medio 2026`, mx + 24, my + 60, 12, 400, C.inkMute);
    icon(c, "x", mx + mw - 30, my + 34, 16, { color: C.inkMute, width: 2 });
    fillRR(c, mx + 24, my + 80, mw - 48, 40, 10, C.surface, C.border, 1);
    txt(c, "Calculando tiempo estimado…", mx + 40, mid(my + 80, 40, 12), 12, 400, C.inkSoft);
    checkbox(c, mx + 24, my + 138, 18, 0);
    txt(c, "Avisarme por email cuando estén listos", mx + 52, my + 152, 13, 600, C.ink);
    txt(c, "Útil si la generación va a tardar varios minutos.", mx + 52, my + 170, 11, 400, C.inkMute);
    checkbox(c, mx + 24, my + 190, 18, 0);
    c.save();
    c.globalAlpha *= 0.55;
    txt(c, "Adjuntar los .docx en el email", mx + 52, my + 204, 13, 600, C.ink);
    txt(c, "Activá primero la notificación por email.", mx + 52, my + 222, 11, 400, C.inkMute);
    c.restore();
    const ew = btnWidth("Empezar", { icon: "sparkles" });
    const cw = btnWidth("Cancelar");
    btn(c, mx + mw - 24 - ew - 8 - cw, my + mh - 66, "Cancelar", { variant: "secondary" });
    R.empezar = btn(c, mx + mw - 24 - ew, my + mh - 66, "Empezar", { icon: "sparkles", press: P(s, "empezar") });
    R.empezar.y += sy;
    R.empezar.cy += sy;
    R.modal = rect(mx, my + sy, mw, mh);
    c.restore();
  };
  return { R, pageH, nav: "groups", fixed };
}

// Pantalla de progreso de la generación.
export function generando(ctx, s) {
  page(ctx);
  const done = s.hechos ?? 0;
  const fin = done >= 6;
  const R = topbar(ctx, "Generando informes", fin ? "Listo · te llevamos al resumen…" : `${SALA} · ${done}/6 listos`, fin ? [] : [{ key: "cancelarCola", label: "Cancelar cola", variant: "secondary" }]);
  const X = 272;
  const y = TOPBAR_H + 28;
  // Tarjeta de progreso (oscura).
  fillRR(ctx, X, y, 470, 300, 20, C.ink);
  txt(ctx, "PROGRESO", X + 28, y + 40, 11, 700, "#a8a29e", "left", 0.1);
  txt(ctx, `${done}/6`, X + 28, y + 118, 72, 800, "#faf6ef", "left", -0.03);
  fillRR(ctx, X + 28, y + 144, 414, 8, 4, "#3a322c");
  if (done > 0) fillRR(ctx, X + 28, y + 144, 414 * (done / 6) + 0.01, 8, 4, C.dAccent);
  if (!fin) {
    const cur = ALUMNOS[Math.min(5, done)];
    txt(ctx, "Trabajando en", X + 28, y + 196, 13, 400, "#a8a29e");
    txt(ctx, `${cur[1]}, ${cur[0]}`, X + 28 + tw("Trabajando en ", 13, 400), y + 196, 13, 700, "#faf6ef");
    const sec = s.seccion ?? 0;
    txt(ctx, `${sec}/4`, X + 442, y + 196, 12, 600, "#a8a29e", "right");
    fillRR(ctx, X + 28, y + 212, 414, 6, 3, "#3a322c");
    fillRR(ctx, X + 28, y + 212, 414 * (sec / 4) + 0.01, 6, 3, C.dAccent);
  } else txt(ctx, "Todo listo. Te llevamos al resumen…", X + 28, y + 200, 14, 700, "#faf6ef");
  txt(ctx, "Podés cerrar la app y te avisamos cuando termine.", X + 28, y + 268, 12, 400, "#a8a29e");
  R.progreso = rect(X, y, 470, 300);
  // Lista.
  const LX = X + 494;
  card(ctx, LX, y, 466, 6 * 56, { r: 14 });
  ALUMNOS.forEach(([nom, ape], i) => {
    const ry = y + i * 56;
    if (i) {
      ctx.fillStyle = C.border;
      ctx.fillRect(LX, ry, 466, 1);
    }
    avatarN(ctx, LX + 30, ry + 28, 32, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, LX + 56, ry + 33, 13, 700, C.ink);
    const st = i < done ? ["listo", "success"] : i === done ? ["en proceso", "accent"] : ["en cola", "neutral"];
    tag(ctx, LX + 466 - 16 - tw(st[0], 11, 600) - 16, ry + 17, st[0], st[1]);
  });
  R.lista = rect(LX, y, 466, 336);
  return { R, pageH: APP_H, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// Resumen del período (/grupos/[id]/periodos/[pid]/informes)
export function resumen(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Resumen del período", `${SALA} · ${PERIODO} · 6 de 6 alumnos con informe`, [
    { key: "lote", label: "Editar en lote", icon: "wand-sparkles" },
    { key: "carpeta", label: s.preparando ? "Preparando…" : "Descargar carpeta", variant: "secondary", icon: "download", spin: s.preparando ? s.spin : null },
  ], { press: s.press });
  const X = 272;
  const W = 960;
  let y = TOPBAR_H + 32;
  card(ctx, X, y, W, 58);
  tag(ctx, X + 20, y + 18, "6 de 6 alumnos con informe", "success");
  y += 76;
  card(ctx, X, y, W, 6 * 60, { r: 14 });
  ALUMNOS.forEach(([nom, ape], i) => {
    const ry = y + i * 60;
    if (i) {
      ctx.fillStyle = C.border;
      ctx.fillRect(X, ry, W, 1);
    }
    avatarN(ctx, X + 34, ry + 30, 28, `${nom} ${ape}`);
    txt(ctx, `${ape}, ${nom}`, X + 58, ry + 26, 13, 600, C.ink);
    tag(ctx, X + 58, ry + 33, "Listo", "success", { h: 18, fs: 10 });
    const bx = X + W - 110;
    fillRR(ctx, bx, ry + 12, 36, 36, 10, "#fff", C.border, 1);
    icon(ctx, "eye", bx + 18, ry + 30, 16, { color: C.ink, width: 2 });
    R[`ver${i}`] = rect(bx, ry + 12, 36, 36);
    fillRR(ctx, bx + 44, ry + 12, 36, 36, 10, "#fff", C.border, 1);
    icon(ctx, "download", bx + 62, ry + 30, 16, { color: C.ink, width: 2 });
    R[`bajar${i}`] = rect(bx + 44, ry + 12, 36, 36);
  });
  R.lista = rect(X, y, W, 360);
  return { R, pageH: APP_H, nav: "groups" };
}

// ═════════════════════════════════════════════════════════════════════════════
// El informe (/grupos/[id]/periodos/[pid]/informes/[iid])
export function informe(ctx, s) {
  page(ctx);
  const R = topbar(ctx, "Ejemplo, Alex", "Generado hace 3 min", [
    { key: "editar", label: "Editar", variant: "secondary", icon: "pencil" },
    { key: "descargar", label: s.bajando ? "Preparando…" : "Descargar .docx", icon: "download", spin: s.bajando ? s.spin : null },
  ], { press: s.press });
  const X = 372;
  const W = 760;
  const y = TOPBAR_H + 28;
  card(ctx, X, y, W, 640);
  txt(ctx, "Informe", X + 40, y + 50, 22, 800, C.ink);
  txt(ctx, `${SALA} · Período Medio 2026`, X + 40, y + 74, 12, 400, C.inkMute);
  const bloques = [
    ["Formación Personal y Social", "Alex participa con entusiasmo de las propuestas de la sala y respeta los acuerdos del grupo. En el proyecto de la huerta propone ideas y ayuda a sus compañeros a organizarse."],
    ["Prácticas del Lenguaje", "Escucha con atención los relatos leídos en la ronda y comenta lo que más le gustó. Se anima a contar sus experiencias frente al grupo."],
    ["Matemática", "Cuenta hasta diez y compara cantidades en los juegos de mesa, y registra lo que observa con dibujos y marcas propias."],
  ];
  let by = y + 110;
  bloques.forEach(([t, p]) => {
    txt(ctx, t, X + 40, by + 16, 15, 700, C.ink);
    by += 28;
    by += para(ctx, p, X + 40, by, 14, 400, C.ink, W - 80, 1.6) + 18;
  });
  R.doc = rect(X, y, W, 640);
  return { R, pageH: APP_H, nav: "groups" };
}

export const SCREENS = { home, nuevaSala, sala, alumnos, wizard1, wizard2, formulario, generar, generando, resumen, informe };
