// Pieza 2 en vertical (1080x1920): el encuadre de cada momento.
//
// La cámara vertical mira el mundo 1920x1080 de las escenas. Cada tramo
// encuadra lo que importa a la mayor escala que entra en el ancho útil (936 px),
// centrado en la zona segura de Instagram (y 269-1536). Donde en horizontal
// hay tipografía y UI lado a lado, la escena las apila (IS_V) y el encuadre de
// acá toma el bloque apilado. Tiempos en frames de historia.

import { vcamTrack } from "../../shared/vcam.js";
import { E } from "../../engine/ease.js";

const K = {
  // A: "Cierra el período." y la línea Inicial | Medio | Final (x 120-1800).
  a: { cx: 960, cy: 560, s: 0.55, vy: 902 },
  // B: "Toda la sala." y la grilla de 8 x 3 (x 380-1490).
  b: { cx: 935, cy: 640, s: 0.84, vy: 902 },
  // C/D apilados sobre el eje de la pila (x 1464): frases arriba (y -170-140),
  // pila (290-930) y botón "Generar" abajo (1010-1086).
  c: { cx: 1464, cy: 458, s: 0.9, vy: 902 },
  // E: "Leés." / "Ajustás." (y -110-235) arriba de la tarjeta de lectura
  // (x 954-1974, y 290-1070).
  e: { cx: 1464, cy: 480, s: 0.9, vy: 902 },
  // Resumen: encabezado apilado (y 68-238) y la sala en 4 x 6 (x 1074-1854,
  // y 278-1278).
  res: { cx: 1464, cy: 673, s: 1.0, vy: 902 },
  // Placa final.
  placa: { cx: 960, cy: 545, s: 0.9, vy: 902 },
};

export const VCAM = vcamTrack([
  [0, K.a],
  // El punto de "período." estalla en x 1625 (f56): la cámara sigue abierta
  // hasta que las partículas arman la frase.
  [58, K.a],
  [76, K.b, E.inOutCubic],
  [104, K.b],
  [120, K.c, E.inOutCubic],
  [212, K.c],
  [228, K.e, E.inOutCubic],
  [292, K.e],
  [306, K.res, E.inOutCubic],
  // Quieta durante el zip y la implosión; después viaja con el punto a la placa.
  [351, K.res],
  [358, K.placa, E.inOutCubic],
]);

export { K };
