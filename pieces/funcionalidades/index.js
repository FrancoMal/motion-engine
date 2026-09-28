// Pieza 1, "Funcionalidades" (tratamiento final, sección 3). 450 frames.
//
// Este archivo solo compone: decide qué escena se dibuja en cada frame, en qué
// orden y con qué máscara en cada costura. La animación vive en cada escena.
//
//   S1 "Subís tu planificación."   f0-84    Papel
//   S2 "Tocás. Marcás. Seguís."    f84-146  Acento   (TW barrido de swash 134-146)
//   S3 "Área por área."            f134-199 Noche    (T8 párpado 191-199)
//   S4 "Una instrucción."          f191-262 Papel    (latigazo 249-255, aviso→burbuja 245-262)
//   S5 "Contale tu idea."          f246-303 Crema
//   S6 aviso en el celular         f280-358 Noche    (T13' 280-292, T15 351-358)
//   Placa final                    f358-449 Papel

import s1 from "./s1-subis.js";
import s2 from "./s2-tocas.js";
import s3 from "./s3-area.js";
import s4 from "./s4-instruccion.js";
import s5 from "./s5-contale.js";
import s6 from "./s6-aviso.js";
import EndCard from "../../shared/endcard.js";
import { activeTop, motionOf, gradeOf } from "../../shared/compose.js";
import { swashEdgePath } from "../../shared/masks.js";
import { timewarp, retime } from "../../shared/timewarp.js";
import { IS_V, OUT_W, OUT_H } from "../../engine/format.js";
import { applyVcam } from "../../shared/vcam.js";
import { VCAM } from "./vertical.js";

const SCENES = [s1, s2, s3, s4, s5, s6];
const ALL = [...SCENES, EndCard];

function draw(ctx, t) {
  if (t >= 358) {
    EndCard.draw(ctx, t);
    return;
  }
  if (t < 84) s1.draw(ctx, t);
  else if (t < 134) s2.draw(ctx, t);
  else if (t < 146) {
    // TW: S2 a la derecha del borde de swash, S3 adentro del cuerpo de tinta.
    s2.draw(ctx, t);
    ctx.save();
    ctx.clip(swashEdgePath(s3.swashX(t)));
    s3.draw(ctx, t);
    ctx.restore();
    s3.drawWipe?.(ctx, t);
  } else if (t < 191) s3.draw(ctx, t);
  else if (t < 199) {
    // T8: la barra se abre como un párpado y adentro aparece S4.
    s3.draw(ctx, t);
    const { top, bottom } = s3.eyelid(t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4000, top, 12000, Math.max(0, bottom - top));
    ctx.clip();
    s4.draw(ctx, t);
    ctx.restore();
    s3.drawEyelid?.(ctx, t);
  } else if (t < 249) s4.draw(ctx, t);
  else if (t < 262) {
    // Latigazo: el mundo de S4 se va a la izquierda y S5 entra en el mismo paneo.
    s4.draw(ctx, t);
    const bx = s4.panBoundary(t);
    if (bx < 1920) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, -4000, 12000, 12000);
      ctx.clip();
      s5.draw(ctx, t);
      ctx.restore();
    }
  } else if (t < 280) s5.draw(ctx, t);
  else if (t < 303) {
    // T13': S6 (derrame de noche, teléfono) se dibuja sobre el mundo de S5.
    s5.draw(ctx, t);
    s6.draw(ctx, t);
  } else s6.draw(ctx, t);

  // Capas de pantalla (frases) arriba de todo durante los solapes.
  for (const sc of SCENES) if (activeTop(sc, t)) sc.drawTop(ctx, t);
}

// Pieza en frames de historia (el guion original de 450 frames).
const story = {
  id: "funcionalidades",
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
  grade: (f) => (f >= 358 ? gradeOf([], f, { caFrames: { 392: 1.0 } }) : gradeOf(SCENES, f, { caFrames: { 0: 1.6, 140: 1.6, 245: 1.6 } })),
  ca: { 0: 1.6, 140: 1.6, 245: 1.6, 392: 1.0 },
  punches: [112, 224, 280],
};

// Re-temporización (Franco: "van súper rápido y casi no se entiende"). Cada
// tramo es [inicio, fin] en frames de historia y cuántos frames de salida dura.
// Los golpes y las transiciones van a velocidad casi real; las lecturas y las
// capturas de UI se abren para que se lean enteras y se entiendan.
export const WARP = timewarp([
  // S1 "Subís tu planificación."
  [0, 14, 18], // impacto, el punto suelta la palabra
  [14, 46, 96], // lectura de la frase
  [46, 60, 18], // la frase se vuelve el documento
  [60, 70, 13], // los renglones salen volando
  [70, 77, 36], // aterrizan las áreas: tiempo para leerlas
  [77, 84, 9], // se elige Formación Personal y Social y se vuelve campo
  // S2 "Tocás. Marcás. Seguís."
  [84, 106, 44], // las tres palabras con sus casillas
  [106, 112, 12], // entra la tarjeta del indicador
  [112, 126, 26], // las casillas se vuelven avatares y vuelan a la fila
  [126, 133, 36], // la tarjeta completa, 12 / 12
  [133, 146, 15], // inhalación y barrido de swash
  // S3 "Área por área."
  [146, 158, 18], // la frase se arma
  [158, 184, 90], // lectura con los segmentos de progreso
  [184, 190, 12], // la barra se funde, "Listo"
  [190, 199, 12], // párpado
  // S4 "Una instrucción."
  [199, 201, 48], // el informe terminado, de cerca: tiempo para leerlo
  [201, 214, 22], // la cámara se aleja y entra la frase
  [214, 224, 36], // el ejemplo de instrucción pasa al campo
  [224, 238, 38], // previsualizar y las propuestas que vuelan
  [238, 245, 28], // las propuestas en cada informe
  [245, 250, 16], // aplicar: el punteado se vuelve trazo
  [250, 256, 8], // latigazo
  // S5 "Contale tu idea."
  [256, 262, 12], // la burbuja
  [262, 266, 16], // el asistente y "Generar planificaciones"
  [266, 274, 26], // se toca Generar y vuelan las tres planificaciones
  [274, 279.8, 18], // cada tarjeta se abre
  [279.8, 281, 42], // las tres planificaciones completas, quietas para leerlas
  [281, 292, 14], // el panel se vuelve el ícono y se derrama la noche
  // S6 aviso
  [292, 300, 12], // cae el aviso y se despega
  [300, 352, 102], // lectura del aviso
  [352, 358, 12], // el punto sale y se abre el papel
  // Placa final
  [358, 392, 44], // las observaciones y el trazo
  [392, 420, 36], // la T y la dirección
  [420, 450, 105], // quietud final
]);

export default retime(story, WARP);
