// Pieza 2, "Casos de uso" (tratamiento final, sección 4). 450 frames.
//
// Este archivo solo compone: decide qué escena se dibuja en cada frame, en qué
// orden y con qué capas en cada costura. La animación vive en cada escena.
//
//   A "Cierra el período."                 f0-62    Papel
//   B "Toda la sala."                       f53-131  Crema (iris de anochecer 104-120)
//   C/D pila, lámpara, Generar, borradores  f104-230 Noche + lámpara
//       frases "Los informes del finde." / "El borrador ya está." (capa de pantalla)
//   E "Leés. Ajustás." y la carpeta         f214-358 Papel
//   Placa final                             f358-449 Papel

import a from "./a-cierra.js";
import b from "./b-sala.js";
import c from "./c-pila.js";
import e from "./e-ajustas.js";
import EndCard from "../../shared/endcard.js";
import { activeTop, motionOf, gradeOf } from "../../shared/compose.js";
import { timewarp, retime } from "../../shared/timewarp.js";
import { IS_V, OUT_W, OUT_H } from "../../engine/format.js";
import { applyVcam } from "../../shared/vcam.js";
import { VCAM } from "./vertical.js";

const SCENES = [a, b, c, e];
const ALL = [...SCENES, EndCard];

function draw(ctx, t) {
  if (t >= 358) {
    EndCard.draw(ctx, t);
    return;
  }
  if (t < 56) a.draw(ctx, t);
  else if (t < 131) {
    // B arranca en el estallido del punto (f56). La pila de C se dibuja arriba
    // de B desde que caen las primeras hojas y la lámpara (f110).
    if (t < 64) a.draw(ctx, t);
    b.draw(ctx, t);
    if (t >= 104) c.draw(ctx, t);
  } else if (t < 214) c.draw(ctx, t);
  else if (t < 230) {
    // T20': la hoja de arriba se vuelve la tarjeta de lectura y el papel se
    // derrama sobre la pila que se aleja.
    c.draw(ctx, t);
    e.draw(ctx, t);
  } else e.draw(ctx, t);

  for (const sc of SCENES) if (activeTop(sc, t)) sc.drawTop(ctx, t);
}

// Pieza en frames de historia (el guion original de 450 frames).
const story = {
  id: "casos-de-uso",
  width: OUT_W,
  height: OUT_H,
  fps: 30,
  duration: 450,
  scenes: ALL,
  // En vertical, la cámara vertical encuadra el mundo 1920x1080 de cada momento
  // (ver vertical.js); las escenas apilan lo que en horizontal va lado a lado.
  draw: IS_V
    ? (ctx, t) => {
        applyVcam(ctx, VCAM(t));
        draw(ctx, t);
      }
    : draw,
  motion: (f) => (f >= 358 ? EndCard.motion(f) : motionOf(SCENES, f)),
  grade: (f) => (f >= 358 ? gradeOf([], f, { caFrames: { 392: 1.0 } }) : gradeOf(SCENES, f, { caFrames: { 56: 1.6, 154: 1.6, 322: 1.6 } })),
  ca: { 56: 1.6, 154: 1.6, 322: 1.6, 392: 1.0 },
  punches: [14, 168],
};

// Re-temporización (Franco: "van súper rápido y casi no se entiende"). Cada
// tramo es [inicio, fin] en frames de historia y cuántos frames de salida dura.
export const WARP = timewarp([
  // A "Cierra el período."
  [0, 22, 30], // impacto y la frase que se cierra con el punto
  [22, 54, 90], // lectura
  // B "Toda la sala."
  [54, 73, 30], // el punto estalla y arma la frase
  [73, 98, 66], // lectura, la sala entera cae en su lugar
  [98, 106, 22], // cada alumno se vuelve su hoja con las marcas
  [106, 112, 14], // anochece
  // C "Los informes del finde."
  [112, 130, 36], // las hojas vuelan a la pila y entra la frase
  [130, 140, 48], // lectura
  [140, 154, 40], // el silencio antes de Generar
  // D "El borrador ya está."
  [154, 172, 36], // Generar: el trazo llega a la pila y los puntos se vuelven renglones
  [172, 182, 30], // entra la frase
  [182, 208, 66], // lectura
  [208, 214, 12], // se levanta la hoja de arriba
  [214, 230, 26], // la hoja se vuelve el informe y se derrama el papel
  // E "Leés. Ajustás."
  [230, 245, 30], // "Leés."
  [245, 260, 30], // el nombre en negrita, "Ajustás."
  [260, 286, 66], // edición: seleccionar, escribir, guardar
  [286, 294, 24], // el informe editado
  [294, 308, 22], // el informe vuelve al resumen de la sala
  [308, 329, 54], // resumen: Editado, CERRADO
  [329, 352, 36], // Descargar carpeta, la carpeta se cierra y se vuelve punto
  [352, 358, 12], // el punto viaja a la placa
  // Placa final
  [358, 392, 44],
  [392, 420, 36],
  [420, 450, 105],
]);

export default retime(story, WARP);
