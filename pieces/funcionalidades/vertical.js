// Pieza 1 en vertical (1080x1920): el encuadre de cada momento.
//
// La cámara vertical mira el mundo 1920x1080 de las escenas. Cada tramo
// encuadra lo que importa en ese momento a la mayor escala que entra en el
// ancho útil (936 px), centrado en la zona segura de Instagram (y 269-1536).
// Donde en horizontal hay tipografía y UI lado a lado, la escena las apila
// (IS_V) y el encuadre de acá toma el bloque apilado.
// Tiempos en frames de historia (el mapa de re-temporización se aplica afuera).

import { vcamTrack } from "../../shared/vcam.js";
import { E } from "../../engine/ease.js";
import { EASE } from "../../shared/system.js";

// Encuadres con nombre.
const K = {
  // S1: la frase "Subís tu / planificación." (x 120-1435).
  frase1: { cx: 777, cy: 470, s: 0.71, vy: 820 },
  // S1: el documento (x 750-1170, y 290-830).
  doc: { cx: 960, cy: 560, s: 1.25, vy: 902 },
  // S1: las áreas (x 407-1514).
  areas: { cx: 960, cy: 510, s: 0.85, vy: 902 },
  // S2 apilado: palabras arriba, tarjeta del indicador abajo.
  // Palabras x 120-944, y 170-760; tarjeta corrida a x 122-942, y 806-1276.
  s2: { cx: 532, cy: 723, s: 1.1, vy: 902 },
  // S3: "Área por área." y la barra (x 187-1733).
  s3: { cx: 960, cy: 500, s: 0.6, vy: 902 },
  // S4: el informe de cerca (la cámara de la escena lo centra en 960, 540).
  s4zoom: { cx: 960, cy: 540, s: 0.88, vy: 902 },
  // S4 apilado: frase en dos renglones (y 110-440), instrucción (486-596),
  // botón (620-700), informe (740-1160) y minis (1200-1500), x 120-1180.
  s4: { cx: 650, cy: 805, s: 0.88, vy: 902 },
  // S5 apilado: "Contale" / "tu idea." (y 150-480), chat (560-872) y el panel
  // de planificaciones debajo (920-1560), x 120-1180.
  s5: { cx: 650, cy: 855, s: 0.88, vy: 902 },
  // S6 apilado: el aviso (x 510-1510, y 395-725) y el teléfono debajo
  // (centro 1010, 1100).
  s6: { cx: 1010, cy: 978, s: 0.93, vy: 902 },
  // Placa final: logo, claim y dirección (x 467-1453, y 218-872).
  placa: { cx: 960, cy: 545, s: 0.9, vy: 902 },
};

export const VCAM = vcamTrack([
  [0, K.frase1],
  [46, K.frase1],
  [56, K.doc, EASE.whip],
  [60, K.doc],
  [70, K.areas, E.inOutCubic],
  [84, K.areas],
  [86, K.s2, E.outCubic],
  [133, K.s2],
  [146, K.s3, E.inOutCubic],
  [191, K.s3],
  [199, K.s4zoom, E.inOutCubic],
  [201, K.s4zoom],
  [209, K.s4, E.inOutCubic],
  [249, K.s4],
  [256, K.s5, E.inOutCubic],
  [280, K.s5],
  [292, K.s6, E.inOutCubic],
  [350, K.s6],
  [358, K.placa, E.inOutCubic],
]);

export { K };
