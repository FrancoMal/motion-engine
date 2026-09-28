// El guion del tutorial: qué pantalla se ve, dónde mira la cámara, adónde va
// el cursor, qué se toca y qué dice la indicación, todo en SEGUNDOS.
//
// Flujo verificado contra la app (rutas de app/src/app):
//   1 Crear la sala        /grupos/nuevo (con el jardín)
//   2 Cargar alumnos       /grupos/[id]/alumnos
//   3 Crear el período     /grupos/[id]/nuevo-periodo, paso 1
//   4 Revisar las áreas    /grupos/[id]/nuevo-periodo, paso 2
//   5 Completar            /grupos/[id]/periodos/[pid]/formulario
//   6 Generar              /grupos/[id]/periodos/[pid]/generar (1 informe = 1 crédito)
//   7 Revisar y descargar  /grupos/[id]/periodos/[pid]/informes y el informe
//
// Los toques (CLICKS) son la misma fuente de verdad para la animación y para
// los efectos de sonido: el cue del clic sale de acá, no se tipea a mano.

import { createCanvas } from "@napi-rs/canvas";
import { SCREENS, ALUMNOS } from "./screens.js";
import { WIDE, fit, camLerp } from "./frame.js";
import { APP_W, APP_H } from "./app-ui.js";
import { clamp, lerp } from "../../engine/math.js";
import { E } from "../../engine/ease.js";

// ─── utilidades de tiempo ────────────────────────────────────────────────────
const p = (t, a, b) => clamp((t - a) / (b - a));
const on = (t, a) => t >= a;
// Texto tipeado entre a y b (letra por letra).
function typed(str, a, b, t) {
  if (t < a) return "";
  const n = Math.round(str.length * p(t, a, b));
  return str.slice(0, n);
}
// Pulso de botón apretado alrededor de un toque.
const press = (t, tc) => (t < tc - 0.12 ? 0 : t < tc ? p(t, tc - 0.12, tc) : 1 - p(t, tc + 0.05, tc + 0.3));
const caret = (t) => Math.floor(t * 2.2) % 2 === 0;
const spin = (t) => t * 6.5;

// Rects de una pantalla en un estado (se dibuja una vez en un lienzo chico).
const MC = createCanvas(16, 16).getContext("2d");
const cache = new Map();
export function layoutOf(name, state) {
  const key = name + JSON.stringify(state, (k, v) => (typeof v === "function" ? String(v) : v));
  if (!cache.has(key)) {
    MC.save();
    const r = SCREENS[name](MC, { spin: 0, ...state });
    if (r.fixed) r.fixed(MC, 0);
    MC.restore();
    cache.set(key, r);
  }
  return cache.get(key);
}
const union = (...rs) => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const X = Math.max(...rs.map((r) => r.x + r.w));
  const Y = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: X - x, h: Y - y };
};
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const scrollFor = (name, state, r, top = 140) => {
  const L = layoutOf(name, state);
  return clamp(r.y - top, 0, Math.max(0, L.pageH - APP_H));
};

// ─── tiempos de los pasos ────────────────────────────────────────────────────
export const STEP_T = [6.5, 26.5, 42.0, 69.5, 86.5, 115.0, 138.0];
export const OUTRO_T = 154.0;
export const DURATION_S = 161.0;
export const CARD_DUR = 1.5;

// ─── tomas ───────────────────────────────────────────────────────────────────
// { t0, screen, state(t), cam: [[t, cam], ...] }
const SHOTS = [];
const CLICKS = []; // { t, x, y } en coordenadas de página (para el cursor y el sfx)
const MOVES = []; // { t0, t1, x, y } desplazamientos del cursor
const HL = []; // { t0, t1, r, spot } resaltados (rect de página)
const CAPS = []; // [t, texto]
const DRAGS = []; // arrastre del archivo

const shot = (t0, screen, state, cam) => SHOTS.push({ t0, screen, state, cam });
const cap = (t, text) => CAPS.push([t, text]);
// Toque: el cursor llega a (x, y) en `arrive`, toca en tc.
function tap(r, arrive, tc, { from = null, hl = true } = {}) {
  const x = r.x + r.w / 2;
  const y = r.y + r.h / 2;
  MOVES.push({ t0: from ?? arrive - 0.8, t1: arrive, x, y });
  CLICKS.push({ t: tc, x, y });
  // El resaltado se apaga apenas termina el toque: muchos botones desaparecen
  // o se mueven al tocarlos y el contorno no puede quedar marcando la nada.
  if (hl) HL.push({ t0: arrive - 0.5, t1: tc + 0.05, r, tap: true });
}
const point = (r, t0, t1) => MOVES.push({ t0, t1, x: r.x + r.w / 2, y: r.y + r.h / 2 });

// ═══ Paso 1: crear la sala ═══════════════════════════════════════════════════
{
  const H = layoutOf("home", {}).R;
  shot(0, "home", (t) => ({ press: { crearPrimera: press(t, 10.0) } }), [
    [0, WIDE()],
    [8.2, WIDE()],
    [9.0, fit(grow(union(H.crearPrimera, { x: H.crearPrimera.x, y: H.crearPrimera.y - 130, w: 1, h: 1 }), 60), 0, { zMax: 1.9 })],
  ]);
  cap(8.0, "Tocá «Crear primera sala»");
  tap(H.crearPrimera, 9.6, 10.0, { from: 8.7 });

  const T0 = 10.3;
  const st = (t) => {
    const v = { nombre: typed("Sala Ejemplo", 11.6, 12.8, t), seccion: typed("2° A", 13.1, 13.6, t), docente: typed("Ana Ejemplo", 14.0, 15.0, t) };
    let focus = null;
    if (t >= 11.3 && t < 12.95) focus = "nombre";
    else if (t >= 12.95 && t < 13.8) focus = "seccion";
    else if (t >= 13.8 && t < 15.3) focus = "docente";
    let jardin = "empty";
    if (t >= 17.0) jardin = "creating";
    if (t >= 20.0) jardin = "selected";
    v.jardin = typed("Jardín Ejemplo", 17.6, 18.8, t);
    if (t >= 17.2 && t < 19.5) focus = "jardin";
    return {
      v, focus, caret: caret(t), jardin, guardando: t >= 19.6 && t < 20.0, creando: t >= 22.0, spin: spin(t),
      press: { crearJardin: press(t, 17.0), guardarJardin: press(t, 19.6), crearSala: press(t, 22.0) },
    };
  };
  const N0 = layoutOf("nuevaSala", st(12)).R;
  const Nemp = layoutOf("nuevaSala", st(16.5));
  const Ncre = layoutOf("nuevaSala", st(19));
  const Nsel = layoutOf("nuevaSala", st(21));
  const syE = scrollFor("nuevaSala", st(16.5), Nemp.R.jardinCard, 160);
  const syC = scrollFor("nuevaSala", st(19), Ncre.R.jardinCard, 120);
  const syS = scrollFor("nuevaSala", st(21), Nsel.R.jardinCard, 200);
  shot(T0, "nuevaSala", st, [
    [T0, WIDE()],
    [10.9, fit(N0.datos, 0, { zMax: 1.3 })],
    [15.4, fit(N0.datos, 0, { zMax: 1.3 })],
    [16.2, fit(Nemp.R.jardinCard, syE, { zMax: 1.6 })],
    [17.0, fit(Nemp.R.jardinCard, syE, { zMax: 1.6 })],
    [17.5, fit(Ncre.R.jardinCard, syC, { zMax: 1.6 })],
    [19.9, fit(Ncre.R.jardinCard, syC, { zMax: 1.6 })],
    [20.3, fit(Nsel.R.jardinCard, syS, { zMax: 1.6 })],
    [20.4, fit(Nsel.R.jardinCard, syS, { zMax: 1.6 })],
    [21.5, fit(grow(Nsel.R.crearSala, 150), 0, { zMax: 2 })],
  ]);
  cap(10.7, "Completá el nombre, la sección y el docente");
  point(N0.nombre, 10.8, 11.3);
  point(N0.seccion, 12.7, 13.0);
  point(N0.docente, 13.5, 13.9);
  cap(16.0, "Si es la primera vez, creá tu jardín");
  tap(Nemp.R.crearJardin, 16.6, 17.0, { from: 15.9 });
  point(Ncre.R.jardinNombre, 17.1, 17.5);
  tap(Ncre.R.guardarJardin, 19.2, 19.6, { from: 18.9 });
  cap(20.6, "Tocá «Crear sala»");
  tap(Nsel.R.crearSala, 21.6, 22.0, { from: 20.8 });

  const S0 = layoutOf("sala", { alumnos: 0 }).R;
  shot(22.8, "sala", (t) => ({ alumnos: 0 }), [[22.8, WIDE()]]);
  cap(23.0, "Tu sala está creada");
  void S0;
}

// ═══ Paso 2: cargar los alumnos ══════════════════════════════════════════════
{
  const S0 = layoutOf("sala", { alumnos: 0 }).R;
  shot(26.5, "sala", () => ({ alumnos: 0, press: {} }), [
    [26.5, WIDE()],
    [28.0, WIDE()],
    [28.6, fit(grow(S0.alumnos, 30), 0, { zMax: 1.9 })],
  ]);
  cap(28.2, "Tocá «Editar lista»");
  tap(S0.editarLista, 29.0, 29.4, { from: 28.4 });

  const T0 = 29.8;
  const st = (t) => {
    const creados = t < 35.8 ? 0 : 1 + Math.min(5, Math.max(0, Math.floor((t - 37.0) / 0.5) + 1));
    const form = t >= 31.0 && t < 35.8;
    let focus = null;
    if (t >= 31.6 && t < 32.75) focus = "nombre";
    else if (t >= 32.75 && t < 34.0) focus = "apellido";
    return {
      alumnos: creados, form, focus, caret: caret(t),
      v: form ? { nombre: typed("Alex", 32.0, 32.6, t), apellido: typed("Ejemplo", 32.9, 33.8, t) } : {},
      rowIn: (i) => (i === 0 ? p(t, 35.8, 36.2) : p(t, 37.0 + (i - 1) * 0.5, 37.3 + (i - 1) * 0.5)),
      press: { agregar: press(t, 31.0), agregarForm: press(t, 35.8) },
    };
  };
  const A0 = layoutOf("alumnos", { alumnos: 0, form: false }).R;
  const A1 = layoutOf("alumnos", { alumnos: 0, form: true }).R;
  const A6 = layoutOf("alumnos", { alumnos: 6, form: false }).R;
  shot(T0, "alumnos", st, [
    [T0, WIDE()],
    [30.2, fit(grow(A0.agregar, 160), 0, { zMax: 2 })],
    [31.1, fit(grow(A0.agregar, 160), 0, { zMax: 2 })],
    [31.6, fit(grow(A1.form, 20), 0, { zMax: 1.6 })],
    [36.0, fit(grow(A1.form, 20), 0, { zMax: 1.6 })],
    [36.6, fit(grow(A6.lista, 30), 0, { zMax: 1.6 })],
  ]);
  cap(30.0, "Tocá «Agregar alumno»");
  tap(A0.agregar, 30.6, 31.0, { from: 30.0 });
  cap(31.5, "Escribí el nombre y el apellido");
  point(A1.nombre, 31.3, 31.7);
  point(A1.apellido, 32.6, 32.85);
  cap(34.0, "La fecha de nacimiento y el género son opcionales");
  HL.push({ t0: 34.0, t1: 35.2, r: union(A1.fecha, A1.genero), soft: true });
  cap(35.1, "Tocá «Agregar alumno» para guardarlo");
  tap(A1.agregarForm, 35.4, 35.8, { from: 35.0 });
  cap(36.8, "Repetí con cada alumno de la sala");
}

// ═══ Paso 3: crear el período ════════════════════════════════════════════════
{
  const S6 = layoutOf("sala", { alumnos: 6 }).R;
  shot(42.0, "sala", (t) => ({ alumnos: 6, press: { nuevoPeriodo: press(t, 45.0) } }), [
    [42.0, WIDE()],
    [43.7, WIDE()],
    [44.3, fit(grow(S6.nuevoPeriodo, 160), 0, { zMax: 2 })],
  ]);
  cap(43.7, "Tocá «Nuevo período»");
  tap(S6.nuevoPeriodo, 44.6, 45.0, { from: 43.9 });

  const T0 = 45.4;
  const st = (t) => ({
    tipo: t >= 47.8 ? "medio" : "inicial",
    opciones: 3,
    archivo: t >= 57.3 ? p(t, 57.3, 57.6) : 0,
    analizando: t >= 66.4,
    elapsed: Math.max(0, Math.floor(t - 66.4)),
    spin: spin(t),
    press: { generarForm: press(t, 66.4) },
  });
  const W0 = layoutOf("wizard1", st(46));
  const W1 = layoutOf("wizard1", st(58));
  const W2 = layoutOf("wizard1", st(67));
  const syDoc = scrollFor("wizard1", st(58), W1.R.documento, 200);
  const syPl = scrollFor("wizard1", st(58), W1.R.planif, 120);
  const syBtn = scrollFor("wizard1", st(67), W2.R.banner, 380);
  shot(T0, "wizard1", st, [
    [T0, WIDE()],
    [46.0, fit(grow(W0.R.periodo, 24), 0, { zMax: 1.9 })],
    [50.6, fit(grow(W0.R.periodo, 24), 0, { zMax: 1.9 })],
    [51.2, fit(grow(W0.R.opciones, 24), 0, { zMax: 1.9 })],
    [54.3, fit(grow(W0.R.opciones, 24), 0, { zMax: 1.9 })],
    [55.7, fit(grow(W1.R.documento, 24), syDoc, { zMax: 1.6 })],
    [58.8, fit(grow(W1.R.documento, 24), syDoc, { zMax: 1.6 })],
    [59.5, fit(grow(W1.R.planif, 16), syPl, { zMax: 1.4 })],
    [64.9, fit(grow(W1.R.planif, 16), syPl, { zMax: 1.4 })],
    [65.6, fit(grow(union(W1.R.generarForm, { ...W1.R.generarForm, y: W1.R.generarForm.y - 60 }), 30), scrollFor("wizard1", st(58), W1.R.generarForm, 500), { zMax: 1.7 })],
    [66.5, fit(grow(union(W1.R.generarForm, { ...W1.R.generarForm, y: W1.R.generarForm.y - 60 }), 30), scrollFor("wizard1", st(58), W1.R.generarForm, 500), { zMax: 1.7 })],
    [67.0, fit(grow(union(W2.R.banner, W2.R.generarForm), 24), syBtn, { zMax: 1.6 })],
  ]);
  cap(46.0, "Elegí el período: Inicial, Medio o Final");
  tap(W0.R.tipoMedio, 47.4, 47.8, { from: 46.6 });
  cap(51.0, "Elegí cuántas opciones querés por indicador");
  HL.push({ t0: 51.8, t1: 54.4, r: W0.R.op3, soft: true });
  point(W0.R.op3, 51.6, 52.4);
  cap(55.2, "Subí tu documento pedagógico evaluativo (.pdf o .docx)");
  DRAGS.push({ t0: 55.9, t1: 57.2, to: W1.R.docDrop, sy: syDoc });
  cap(59.3, "Si solo tenés la planificación, Trazo Inicial puede redactarlo desde ahí");
  HL.push({ t0: 59.8, t1: 64.6, r: W1.R.planifDrop, spot: true });
  cap(65.5, "Tocá «Generar Formulario» y esperá a que termine");
  tap(W1.R.generarForm, 66.0, 66.4, { from: 65.4 });
}

// ═══ Paso 4: revisar las áreas ═══════════════════════════════════════════════
{
  const T0 = 69.5;
  const st = (t) => ({
    expandir: t >= 75.3,
    noEvaluar: t >= 81.0 ? [3] : [],
    confirmando: t >= 84.4,
    spin: spin(t),
    press: { confirmar: press(t, 84.4) },
  });
  const V0 = layoutOf("wizard2", st(72));
  const V1 = layoutOf("wizard2", st(77));
  const V2 = layoutOf("wizard2", st(82));
  const syA3 = scrollFor("wizard2", st(80), V1.R.area3, 240);
  const syEnd = Math.max(0, V2.pageH - APP_H);
  shot(T0, "wizard2", st, [
    [T0, WIDE()],
    [71.3, WIDE()],
    [71.9, fit(grow(union(V0.R.resumen, V0.R.area0), 16), scrollFor("wizard2", st(72), V0.R.resumen, 60), { zMax: 1.5 })],
    [75.0, fit(grow(union(V0.R.resumen, V0.R.area0), 16), scrollFor("wizard2", st(72), V0.R.resumen, 60), { zMax: 1.5 })],
    [75.7, fit(grow(V1.R.sugerencias, 20), scrollFor("wizard2", st(77), V1.R.sugerencias, 180), { zMax: 1.9 })],
    [79.3, fit(grow(V1.R.sugerencias, 20), scrollFor("wizard2", st(77), V1.R.sugerencias, 180), { zMax: 1.9 })],
    [80.0, fit(grow(V1.R.area3, 16), syA3, { zMax: 1.6 })],
    [82.7, fit(grow(V1.R.area3, 16), syA3, { zMax: 1.6 })],
    [83.4, fit(grow(V2.R.confirmar, 70), syEnd, { zMax: 1.9 })],
  ]);
  cap(71.3, "Revisá las áreas que detectó Trazo Inicial");
  cap(75.3, "Podés editar, agregar o borrar indicadores y sugerencias");
  const row = { x: V0.R.area0.x + 10, y: V0.R.area0.y + 54, w: 30, h: 30 };
  tap(row, 74.9, 75.3, { from: 74.3, hl: false });
  cap(79.8, "Destildá las áreas que no vas a evaluar");
  tap(V1.R.check3, 80.6, 81.0, { from: 79.9 });
  cap(83.1, "Tocá «Confirmar y crear formularios»");
  tap(V2.R.confirmar, 84.0, 84.4, { from: 83.3 });
}

// ═══ Paso 5: completar el formulario ═════════════════════════════════════════
{
  const T0 = 86.5;
  const NOTA = "Esta semana ayudó a ordenar la huerta.";
  const st = (t) => {
    const alumno = t >= 89.8 ? 0 : -1;
    let ind;
    let tab = 0;
    if (t < 93.6) ind = [{ active: t >= 90.2, sel: t >= 92.8 ? 0 : null }, {}, {}];
    else if (t < 103.0) ind = [{ sel: 0 }, { active: true, sel: t >= 95.2 ? 0 : null, nota: typed(NOTA, 98.4, 100.6, t) }, {}];
    else {
      tab = 1;
      ind = [{ active: true, sel: null }, {}, {}];
    }
    const lista = (i) => t >= 106.0 + i * 0.45;
    const listos = alumno < 0 ? 0 : [0, 1, 2, 3, 4, 5].filter(lista).length;
    return {
      alumno, ind, tab, listos, completo: listos > 0, listoAlumno: lista,
      focus: t >= 98.0 && t < 101.0 ? "nota1" : null, caret: caret(t),
      general: t >= 109.0 && t < 113.8 ? 1 : 0,
      press: { siguiente: press(t, 103.0) },
    };
  };
  const F0 = layoutOf("formulario", st(88));
  const F1 = layoutOf("formulario", st(91));
  const F2 = layoutOf("formulario", st(96));
  const F3 = layoutOf("formulario", st(99));
  shot(T0, "formulario", st, [
    [T0, WIDE()],
    [88.3, WIDE()],
    [88.9, fit(grow(union(F0.R.general, F0.R.alumno5), 14), 0, { zMax: 1.6 })],
    [89.9, fit(grow(union(F0.R.general, F0.R.alumno5), 14), 0, { zMax: 1.6 })],
    [90.6, fit(grow(F1.R.ind0, 16), 0, { zMax: 1.7 })],
    [93.5, fit(grow(F1.R.ind0, 16), 0, { zMax: 1.7 })],
    [94.1, fit(grow(F2.R.ind1, 16), 0, { zMax: 1.6 })],
    [97.6, fit(grow(F2.R.ind1, 16), 0, { zMax: 1.6 })],
    [98.2, fit(grow(F3.R.nota1, 30), 0, { zMax: 2 })],
    [101.6, fit(grow(F3.R.nota1, 30), 0, { zMax: 2 })],
    [102.2, fit(grow(F3.R.barra, 30), 0, { zMax: 1.7 })],
    [104.8, fit(grow(F3.R.barra, 30), 0, { zMax: 1.7 })],
    [105.6, WIDE()],
    [108.4, WIDE()],
    [109.0, fit(grow(F3.R.general, 60), 0, { zMax: 1.5 })],
  ]);
  cap(88.3, "Elegí un alumno de la lista");
  tap(F0.R.alumno0, 89.4, 89.8, { from: 88.6 });
  cap(92.0, "En cada indicador, tocá la sugerencia que mejor describe lo que observaste");
  tap(F1.R.chip0_0, 92.4, 92.8, { from: 90.8 });
  tap(F2.R.chip1_0, 94.8, 95.2, { from: 94.0 });
  cap(97.8, "Si querés, sumá una nota personal");
  point(F3.R.nota1, 97.6, 98.0);
  cap(102.0, "Tocá «Siguiente sección» para pasar a la próxima área");
  tap(F3.R.siguiente, 102.6, 103.0, { from: 101.8 });
  cap(105.6, "Completá así a cada alumno");
  cap(108.8, "Atajo: en «General» marcás una sugerencia para varios alumnos a la vez");
  point(F3.R.general, 109.2, 110.0);
  HL.push({ t0: 109.6, t1: 113.8, r: F3.R.general });
}

// ═══ Paso 6: generar los informes ════════════════════════════════════════════
{
  const done = (t) => ({ alumno: 0, ind: [{ sel: 0 }, { sel: 0, nota: "x" }, { sel: 1 }], tab: 0, listos: 6, completo: true, listoAlumno: () => true, press: { generarInforme: press(t, 118.0) } });
  const G = layoutOf("formulario", done(116));
  shot(115.0, "formulario", done, [
    [115.0, WIDE()],
    [116.2, WIDE()],
    [117.3, fit(grow(G.R.generarInforme, 160), 0, { zMax: 2 })],
  ]);
  cap(116.7, "Tocá «Generar informe»");
  tap(G.R.generarInforme, 117.6, 118.0, { from: 116.8 });

  const T0 = 118.4;
  const st = (t) => ({
    seleccion: t >= 124.6 ? 6 : 0,
    modal: t >= 126.4 ? E.outCubic(p(t, 126.5, 126.9)) : 0,
    press: { generar: press(t, 126.4), empezar: press(t, 128.6) },
  });
  const Q0 = layoutOf("generar", st(119));
  const Q1 = layoutOf("generar", st(127.5));
  const syGen = scrollFor("generar", st(125), Q0.R.generarZona, 520);
  shot(T0, "generar", st, [
    [T0, WIDE()],
    [118.9, fit(grow(Q0.R.credito, 30), 0, { zMax: 1.9 })],
    [123.3, fit(grow(Q0.R.credito, 30), 0, { zMax: 1.9 })],
    [123.9, fit(grow(union(Q0.R.todos, Q0.R.lista), 10), scrollFor("generar", st(125), Q0.R.todos, 40), { zMax: 1.5 })],
    [125.0, fit(grow(union(Q0.R.todos, Q0.R.lista), 10), scrollFor("generar", st(125), Q0.R.todos, 40), { zMax: 1.5 })],
    [125.6, fit(grow(Q0.R.generarZona, 40), syGen, { zMax: 1.8 })],
    [126.5, fit(grow(Q0.R.generarZona, 40), syGen, { zMax: 1.8 })],
    [127.0, fit(grow({ ...Q1.R.modal, y: Q1.R.modal.y + syGen }, 30), syGen, { zMax: 1.6 })],
  ]);
  cap(118.9, "Cada informe usa 1 crédito de tu saldo");
  HL.push({ t0: 119.6, t1: 123.2, r: Q0.R.credito, spot: true });
  cap(123.8, "Elegí los alumnos: «Seleccionar todos»");
  tap(Q0.R.todos, 124.2, 124.6, { from: 123.6 });
  cap(125.4, "Tocá «Generar informes» y confirmá con «Empezar»");
  tap(Q0.R.generar, 126.0, 126.4, { from: 125.2 });
  const emp = { ...Q1.R.empezar, y: Q1.R.empezar.y + syGen };
  tap(emp, 128.2, 128.6, { from: 127.2 });

  const T1 = 129.0;
  shot(T1, "generando", (t) => ({ hechos: Math.min(6, Math.floor(p(t, 129.6, 134.0) * 6 + 1e-6)), seccion: Math.floor((t * 3) % 4) + 1 }), [[T1, WIDE()]]);
  cap(129.4, "Podés cerrar la app: te avisamos cuando estén listos");
}

// ═══ Paso 7: revisar y descargar ═════════════════════════════════════════════
{
  const R0 = layoutOf("resumen", {}).R;
  shot(135.5, "resumen", (t) => ({ press: {} }), [
    [135.5, WIDE()],
    [139.6, WIDE()],
    [140.2, fit(grow(R0.lista, 10), 0, { zMax: 1.4 })],
  ]);
  cap(135.6, "Tus informes están listos");
  cap(139.8, "Tocá el ojo para abrir y leer cada informe");
  tap(R0.ver0, 142.2, 142.6, { from: 140.6 });

  const I0 = layoutOf("informe", {}).R;
  shot(143.0, "informe", (t) => ({ bajando: t >= 148.6 && t < 149.4, spin: spin(t), press: { descargar: press(t, 148.6) } }), [
    [143.0, WIDE()],
    [143.8, fit(grow(union(I0.editar, I0.descargar), 150), 0, { zMax: 1.6 })],
  ]);
  cap(144.2, "Si hace falta, tocá «Editar» y ajustá el texto");
  point(I0.editar, 144.0, 144.8);
  HL.push({ t0: 144.6, t1: 146.8, r: I0.editar });
  cap(147.0, "Descargalo en Word con «Descargar .docx»");
  tap(I0.descargar, 148.2, 148.6, { from: 147.2 });

  shot(150.0, "resumen", (t) => ({ preparando: t >= 151.4 && t < 152.4, spin: spin(t), press: { carpeta: press(t, 151.4) } }), [
    [150.0, fit(grow(R0.carpeta, 330), 0, { zMax: 1.35 })],
  ]);
  cap(150.2, "O bajá la carpeta con todos los informes");
  tap(R0.carpeta, 151.0, 151.4, { from: 150.2 });
}

// ─── consultas por tiempo ────────────────────────────────────────────────────
SHOTS.sort((a, b) => a.t0 - b.t0);
CAPS.sort((a, b) => a[0] - b[0]);
MOVES.sort((a, b) => a.t0 - b.t0);

export function shotAt(t) {
  let i = 0;
  while (i + 1 < SHOTS.length && SHOTS[i + 1].t0 <= t) i++;
  return { i, cur: SHOTS[i], prev: i > 0 ? SHOTS[i - 1] : null };
}

export function camAt(sh, t) {
  const K = sh.cam;
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i][0]) {
      const u = E.inOutCubic(p(t, K[i - 1][0], K[i][0]));
      return camLerp(K[i - 1][1], K[i][1], u);
    }
  }
  return K[K.length - 1][1];
}

export function captionAt(t) {
  let cur = null;
  let prev = null;
  for (const c of CAPS) {
    if (c[0] <= t) {
      prev = cur;
      cur = c;
    }
  }
  if (!cur) return null;
  // La indicación se apaga en la tarjeta de paso y no vuelve después: la de un
  // paso anterior nunca reaparece en el siguiente.
  for (const s of STEP_T) if (t >= s && cur[0] < s) return null;
  if (t >= OUTRO_T) return null;
  // Primero se va la anterior y recién después entra la nueva: nunca se superponen.
  return { text: cur[1], k: p(t, cur[0] + 0.16, cur[0] + 0.5), prev: prev ? prev[1] : null, kOut: p(t, cur[0], cur[0] + 0.16) };
}

// Posición del cursor (página) o null si no se ve.
const REST = { x: 1180, y: 760 };
export function cursorAt(t) {
  if (t < 7.6 || t >= OUTRO_T) return null;
  let pos = REST;
  let from = REST;
  for (const m of MOVES) {
    if (t < m.t0) break;
    if (t < m.t1) {
      const u = E.inOutCubic(p(t, m.t0, m.t1));
      const arc = Math.sin(Math.PI * u) * Math.min(60, Math.hypot(m.x - from.x, m.y - from.y) * 0.12);
      return { x: lerp(from.x, m.x, u), y: lerp(from.y, m.y, u) - arc, moving: true };
    }
    from = { x: m.x, y: m.y };
    pos = from;
  }
  return { ...pos, moving: false };
}

export const clickAt = (t) => CLICKS.find((c) => t >= c.t - 0.12 && t < c.t + 0.5) ?? null;
export const highlightsAt = (t) => HL.filter((h) => t >= h.t0 - 0.2 && t < h.t1 + 0.3);
export const dragsAt = (t) => DRAGS.find((d) => t >= d.t0 - 0.3 && t < d.t1 + 0.4) ?? null;
export { SHOTS, CLICKS, CAPS, HL, DRAGS, p, ALUMNOS };
