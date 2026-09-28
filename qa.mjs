#!/usr/bin/env node
// Controles de calidad de una pieza (tratamiento final 7.6). No renderiza el
// video: lee lo que declaran las escenas y prueba el grade.
//
//   node qa.mjs <pieza>
//
// 1. Lectura: cada frase declarada tiene que sostenerse al menos
//    ceil((0,25·palabras + 0,3)·30) frames entre R y L.
// 2. Golpes: los H1 y H2 caen en múltiplos de 14 (la grilla de 128,57 BPM).
// 3. Marca: un parche plano #c2410c sale del grade con menos de 4 niveles de
//    diferencia por canal y #faf6ef con menos de 3, en cada preset.
// 4. Escenas provisorias que todavía no se reemplazaron.
// Sale con código 1 si algo falla.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minHold } from "./shared/system.js";
import { finish } from "./engine/grade.js";
import { blend, PRESETS } from "./shared/grade-presets.js";
import { hexToRgb } from "./engine/math.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error("uso: node qa.mjs <pieza>");
  process.exit(1);
}
const piece = (await import(pathToFileURL(path.join(here, "pieces", name, "index.js")).href)).default;
let fails = 0;
const fail = (msg) => {
  fails++;
  console.log("  FALLA  " + msg);
};
const ok = (msg) => console.log("  ok     " + msg);

console.log(`\n${name}: lectura (tiempo de salida${piece.warp ? ", a través del mapa de re-temporización" : ""})`);
// Holgura "sin apuro" que pidió Franco, más generosa que el mínimo técnico.
const comfy = (words) => Math.ceil((0.4 * words + 0.8) * 30);
const toOut = (f) => (piece.warp ? piece.warp.out(f) : f);
for (const sc of piece.scenes) {
  for (const ph of sc.phrases ?? []) {
    const hold = toOut(ph.L) - toOut(ph.R);
    const min = minHold(ph.words);
    const want = comfy(ph.words);
    const line = `${sc.id ?? "placa"} "${ph.id}" ${ph.words} palabras: ${(hold / 30).toFixed(2)} s en pantalla (mínimo ${(min / 30).toFixed(2)} s, sin apuro ${(want / 30).toFixed(2)} s)`;
    if (hold + 1e-6 < min) fail(line);
    else if (hold < want) console.log("  justo  " + line);
    else ok(line);
  }
}

console.log(`\n${name}: golpes en la grilla`);
let off = 0;
let total = 0;
for (const sc of piece.scenes) {
  for (const h of sc.hits ?? []) {
    total++;
    if ((h.level === "H1" || h.level === "H2") && Math.abs(h.f / 14 - Math.round(h.f / 14)) > 1e-6) {
      off++;
      fail(`${sc.id ?? "placa"} ${h.level} "${h.kind}" en f${h.f} no cae en la grilla de 14 f`);
    }
  }
}
if (!off) ok(`${total} golpes declarados, los H1/H2 en la grilla`);

console.log(`\n${name}: colores de marca después del grade`);
const w = 16;
const h = 16;
for (const preset of Object.keys(PRESETS)) {
  const g = { ...blend({ [preset]: 1 }), grain: 0, vignette: 0 };
  for (const [hex, tol] of [["#c2410c", 4], ["#faf6ef", 3]]) {
    const [r, gg, b] = hexToRgb(hex);
    const acc = new Uint16Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      acc[i * 4] = r;
      acc[i * 4 + 1] = gg;
      acc[i * 4 + 2] = b;
    }
    const out = finish(acc, 1, w, h, g, null);
    const p = (8 * w + 8) * 3;
    const d = [Math.abs(out[p] - r), Math.abs(out[p + 1] - gg), Math.abs(out[p + 2] - b)];
    const line = `${preset.padEnd(7)} ${hex} → rgb(${out[p]},${out[p + 1]},${out[p + 2]}) desvío ${Math.max(...d)} (tolerancia ${tol})`;
    if (Math.max(...d) > tol) fail(line);
    else ok(line);
  }
}

console.log(`\n${name}: escenas`);
for (const sc of piece.scenes) {
  if (sc.stub) fail(`${sc.id} sigue siendo provisoria`);
}
if (!piece.scenes.some((s) => s.stub)) ok("ninguna escena provisoria");

console.log(fails ? `\n${fails} controles fallaron.` : "\nTodo en orden.");
process.exit(fails ? 1 : 0);
