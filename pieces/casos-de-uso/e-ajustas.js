// Pieza 2, escena E "Leés. Ajustás." (tratamiento final 4.5 T20', 4.6 y T15),
// f214-358, campo Papel.
//
//   214-230  T20': la hoja de arriba de la pila (C-P2-9) se vuelve la tarjeta
//            de lectura de Alex; el papel se derrama desde ella y el campo
//            pasa de noche a papel por cobertura (60 % en el downbeat de f224).
//   230-294  lectura: "Leés." (barrido), "Alex" en negrita, "Ajustás." (KA),
//            "Editar", selección y caret ("entusiasmo" -> "curiosidad"),
//            "Guardar cambios", Loader, vuelta a lectura.
//   294-308  T20r: la tarjeta se encoge al tile de Alex; la sala viene desde
//            la profundidad.
//   308-352  Resumen: "Editado", CERRADO, "Descargar carpeta", TZ, implosión.
//   352-358  T15: el punto vuela al contrato de la placa (C-END).
//
// Capas: L0 papel, L1 retícula de puntos (z +900), L2 columnas (z +300), L4
// UI (z 0), L5 motas desenfocadas (z -400); la frase va en capa de pantalla
// (drawTop), fija de R a L. Cámara del mundo con dolly lento y mano (1,5 px,
// 0,4 Hz), que se apaga alrededor del derrame y de la implosión.

import { EASE, SPR, spr, p, ring } from "../../shared/system.js";
import { makePhrase, drawPhrase, drawDot, barrido, barridoGuide, ajuste, evaporar, bumps, periodScale } from "../../shared/phrase.js";
import { camera, layer, project } from "../../engine/camera.js";
import { blurred, lightLeak } from "../../engine/fx.js";
import { clamp, lerp, noise1, deg, hash1, TAU } from "../../engine/math.js";
import { kf } from "../../engine/ease.js";
import { C } from "../../shared/brand.js";
import { createCanvas } from "@napi-rs/canvas";
import { PAPER } from "./e-ui.js";
import { drawCard, spillAt, spillPath, drawSpillLip, coverage, T as TL } from "./e-lectura.js";
import { drawHeader, drawTiles, tileEnterAlpha, drawZip, drawZipLabel, drawDotActor, zipState, BTN, ZC, T as TC } from "./e-carpeta.js";
import { IS_V } from "../../engine/format.js";

const START = 214;
const END = 358;

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Se escribe como zoom y traslación de pantalla (pantalla = mundo·z + T), que
// se interpola sin saltos aunque cambie el pivote. T = pivote·(1 - z).
const piv = (z, px, py) => [z, px * (1 - z), py * (1 - z)];
const CARD_C = IS_V ? [1464, 680] : [1290, 540];
const SALA_C = IS_V ? [1464, 740] : [960, 560];
const CAM_KEYS = [
  [228, [1, 0, 0]],
  [294, piv(1.012, ...CARD_C), EASE.swell], // dolly lento sobre la tarjeta
  [308, [1, 0, 0], EASE.glide], // T20r: la cámara se abre mientras la sala sube
  [330, piv(1.008, ...SALA_C), EASE.swell],
  [350, piv(1.03, ...ZC), EASE.swell], // empuje al zip (el centro no se mueve)
];
// Mano: se enciende al terminar el derrame y se apaga antes de la implosión.
const handW = (t) => p(t, 228, 232) * (1 - p(t, 344, 348));

export function camAt(t) {
  if (t < 228) return camera({ F: 1400 });
  const [z, tx0, ty0] = kf(t, CAM_KEYS);
  const h = handW(t);
  const nt = (t / 30) * 0.4 * 2;
  const tx = tx0 + 1.5 * h * noise1(nt, 11);
  const ty = ty0 + 1.5 * h * noise1(nt, 23);
  return camera({ F: 1400, zoom: z, x: (960 * (1 - z) - tx) / z, y: (540 * (1 - z) - ty) / z, roll: deg(0.15) * h * noise1(nt, 37) });
}

// Rect de pantalla del botón "Descargar carpeta" (nace en el mundo).
function btnScreen(cam) {
  const a = project(cam, BTN.x, BTN.y, 0);
  const b = project(cam, BTN.x + BTN.w, BTN.y + BTN.h, 0);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

// ─── capas de fondo ──────────────────────────────────────────────────────────
// Presencia de las capas de textura: llegan con el papel y se retiran antes
// del vuelo final (el contrato pide papel limpio en f352).
const bgA = (t) => p(t, 222, 234) * (1 - p(t, 336, 348));

// L1: retícula de puntos de cuaderno (la observación como textura). Un patrón
// de una celda dibujada a 2x: miles de arcos en un path costaban 1,2 s.
let DOT_PAT = null;
function dotPattern(c) {
  if (!DOT_PAT) {
    const cell = createCanvas(92, 92);
    const cc = cell.getContext("2d");
    cc.fillStyle = "#e4d8c4";
    cc.beginPath();
    cc.arc(46, 46, 4.8, 0, TAU);
    cc.fill();
    DOT_PAT = c.createPattern(cell, "repeat");
  }
  return DOT_PAT;
}
function dotGrid(ctx, cam, t, a) {
  if (a <= 0.002) return;
  layer(ctx, cam, 900, (c) => {
    const inv = 2300 / 1400;
    c.save();
    c.globalAlpha *= 0.55 * a;
    c.translate(960 - 1000 * inv, 540 - 560 * inv);
    c.scale(0.5, 0.5);
    c.fillStyle = dotPattern(c);
    // Con margen: el encuadre vertical ve más alto que el horizontal.
    c.fillRect(-2400, -2400, 4000 * inv + 4800, 2240 * inv + 4800);
    c.restore();
  });
}

// L2: las 12 columnas en líneas finas (márgenes 120, calle 24, columna 118),
// escaladas para que en reposo caigan sobre la grilla de pantalla.
function hairlines(ctx, cam, a) {
  if (a <= 0.002) return;
  layer(ctx, cam, 300, (c) => {
    const sInv = (1400 + 300) / 1400;
    c.save();
    c.globalAlpha *= 0.35 * a;
    c.strokeStyle = C.border;
    c.lineWidth = 1.2;
    c.beginPath();
    for (let k = 0; k < 12; k++) {
      for (const sx of [120 + 142 * k, 120 + 142 * k + 118]) {
        const x = 960 + (sx - 960) * sInv;
        c.moveTo(x, -1400);
        c.lineTo(x, 2480);
      }
    }
    c.stroke();
    c.restore();
  });
}

// L5: motas tibias desenfocadas en primer plano (z -400, se mueven 1,4x).
// En vertical se reparten por la columna que ve la cámara.
const MOTES = Array.from({ length: 7 }, (_, i) => ({
  x: IS_V ? 900 + hash1(i * 7 + 1) * 1130 : 140 + hash1(i * 7 + 1) * 1640,
  y: IS_V ? -380 + hash1(i * 7 + 2) * 1900 : 90 + hash1(i * 7 + 2) * 900,
  r: 34 + hash1(i * 7 + 3) * 50,
  a: 0.18 + hash1(i * 7 + 4) * 0.2,
  seed: i * 13 + 5,
}));
function motes(ctx, cam, t, a) {
  if (a <= 0.002) return;
  layer(ctx, cam, -400, (c) => {
    const inv = 1000 / 1400;
    for (const m of MOTES) {
      const x = 960 + (m.x - 960) * inv + 18 * noise1(t / 40, m.seed);
      const y = 540 + (m.y - 540) * inv + 14 * noise1(t / 46, m.seed + 1);
      const g = c.createRadialGradient(x, y, 0, x, y, m.r);
      g.addColorStop(0, `rgba(253,233,211,${m.a * a})`);
      g.addColorStop(0.6, `rgba(253,233,211,${m.a * a * 0.45})`);
      g.addColorStop(1, "rgba(253,233,211,0)");
      c.fillStyle = g;
      c.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
  });
}

// El mismo leak que la placa final (misma semilla y parámetros): así f358 no
// salta.
const leak = (ctx, t) => lightLeak(ctx, t, { intensity: 0.07 / 0.55, x: 0.86, y: 0.08, seed: 3 });

function paperWorld(ctx, t, cam) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  const a = bgA(t);
  dotGrid(ctx, cam, t, a);
  hairlines(ctx, cam, a);
}

// ─── dibujo ──────────────────────────────────────────────────────────────────

function draw(ctx, t) {
  if (t < START) return;
  const cam = camAt(t);
  const spill = spillAt(t);

  // Papel: adentro del derrame hasta cubrir el cuadro, después todo.
  if (t < TL.spill1) {
    if (spill) {
      // Halo de papel: el borde se abre suave (la luz llega desde la hoja).
      ctx.save();
      ctx.shadowColor = PAPER;
      ctx.shadowBlur = 80;
      spillPath(ctx, spill);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.restore();
      ctx.save();
      spillPath(ctx, spill);
      ctx.clip();
      paperWorld(ctx, t, cam);
      leak(ctx, t);
      ctx.restore();
      drawSpillLip(ctx, t);
    }
  } else paperWorld(ctx, t, cam);

  // La sala: viene desde z +700 (desenfocada) en T20r; después se pliega.
  if (t >= TC.exit && t < TC.imp0) {
    const kz = p(t, TC.exit, TC.land, EASE.glide);
    const z = 700 * (1 - kz);
    if (z > 0.5) {
      layer(ctx, cam, z, (c) => blurred(c, "e-sala", 12 * (z / 700), (b) => drawTiles(b, t, { includeAlex: false, alphaFn: tileEnterAlpha(t) })));
    } else {
      // Destino del pliegue: el centro del zip en pantalla, llevado al mundo.
      let target;
      const z = t >= TC.tap ? zipState(t, btnScreen(cam)) : null;
      if (z) {
        const s = cam.zoom;
        target = [(z.cx - 960) / s + 960 + cam.x, (z.cy - 540) / s + 540 + cam.y];
      }
      layer(ctx, cam, 0, (c) => drawTiles(c, t, { includeAlex: t >= TC.land, target }));
    }
    layer(ctx, cam, 0, (c) => drawHeader(c, t));
  }

  // La tarjeta (hoja -> lectura -> tile).
  if (t < TC.land) layer(ctx, cam, 0, (c) => drawCard(c, t));

  // Zip, etiqueta y punto: en pantalla.
  if (t >= TC.tap) {
    drawZip(ctx, t, btnScreen(cam));
    drawZipLabel(ctx, t);
    drawDotActor(ctx, t);
  }

  // Primer plano y luz.
  if (t >= 226) motes(ctx, cam, t, bgA(t));
  if (t >= TL.spill1) leak(ctx, t);
}

// ─── frase (capa de pantalla) ────────────────────────────────────────────────
// En vertical, arriba de la tarjeta y alineada con su borde izquierdo.
const LX = IS_V ? 954 : 120;
const LEES = makePhrase({ text: "Leés.", size: 160, wght: 760, tracking: -0.045, x: LX, baseline: IS_V ? 40 : 480, color: C.ink, periodColor: C.accent });
const AJ = makePhrase({ text: "Ajustás.", size: 160, wght: 760, tracking: -0.045, x: LX, baseline: IS_V ? 200 : 640, color: C.ink, periodColor: C.accent });
const KA_OFF = [-14, 10, -6, 12, -9, 7, -11, 5];
const KA_ROT = [-3, 2, -2, 3, -1, 2, -3, 1];
const H_LEES = 238;
const H_AJ = 252;
// La frase se va antes de T20r (f294), rápido y de izquierda a derecha: así la
// tarjeta viaja al resumen sobre limpio y no atraviesa "Leés. Ajustás.".
const X_LEES = 288;
const X_AJ = 289.5;
const OUT = { stagger: 0.3, dur: 4 };

export const PROG_LEES = [barrido(H_LEES, { appear: 236, dur: 6 }), evaporar(X_LEES, OUT)];
export const PROG_AJ = [ajuste(H_AJ, KA_OFF, KA_ROT), bumps([280], 60), evaporar(X_AJ, OUT)];
export { LEES, AJ };

// Salida del punto con el mismo ritmo que la evaporación de su frase.
function periodExit(t, ph, X) {
  const s = X + ph.n * OUT.stagger;
  const k = EASE.accel(clamp((t - s) / OUT.dur));
  return { k, dx: 0.3 * ph.size * k, dy: -14 * k };
}

function drawTop(ctx, t) {
  if (t < 236 || t >= 306) return;
  // "Leés.": barrido de lectura con su guía de acento.
  barridoGuide(ctx, LEES, t, H_LEES, { dur: 6 });
  drawPhrase(ctx, LEES, t, PROG_LEES);
  const pl = LEES.period;
  const el = periodExit(t, LEES, X_LEES);
  if (t >= TL.alex - 0.75) {
    ring(ctx, t, TL.alex - 0.75, pl.cx, pl.cy, pl.d, C.accent);
    ring(ctx, t, 280, pl.cx, pl.cy, pl.d, C.accent);
    drawDot(ctx, pl.cx + el.dx, pl.cy + el.dy, pl.d, C.accent, { scale: periodScale(t, { H: TL.alex - 0.75, from: 1.7, cfg: SPR.slam }) * (1 - el.k), alpha: 1 - el.k });
  }
  // "Ajustás.": llega desalineado y se acomoda (KA).
  drawPhrase(ctx, AJ, t, PROG_AJ);
  if (t >= H_AJ - 4) {
    const pa = AJ.period;
    const i = 7;
    const inK = EASE.brake(clamp((t - (H_AJ - 4)) / 4));
    const fix = spr(t, H_AJ + 1 + i * 0.5, SPR.snap);
    const dy = lerp(KA_OFF[i] + 20, KA_OFF[i], inK) * (1 - fix);
    const ea = periodExit(t, AJ, X_AJ);
    const a = clamp((t - (H_AJ - 4)) / 3) * (1 - ea.k);
    ring(ctx, t, 266, pa.cx, pa.cy, pa.d, C.accent);
    drawDot(ctx, pa.cx + ea.dx, pa.cy + dy + ea.dy, pa.d, C.accent, { alpha: a, scale: 1 - ea.k });
  }
}

// ─── grade, blur, lectura, golpes ────────────────────────────────────────────

function field(t) {
  if (t < START) return { noche: 1 };
  if (t >= TL.spill1) return { papel: 1 };
  const c = coverage(t);
  return { noche: 1 - c, papel: c };
}

function motion(t) {
  if (t < 214) return { shutter: 0.5, samples: 8 }; // antes del relevo: manda la pila
  if (t < 216) return { shutter: 0.75, samples: 12 }; // hoja que se lanza
  if (t >= 221 && t < 227) return { shutter: 1, samples: 24 }; // pico del whip del derrame
  if (t < 230) return { shutter: 1, samples: 16 }; // derrame (relleno de campo)
  if (t < 248) return { shutter: 0.5, samples: 8 };
  if (t < 263) return { shutter: 0.75, samples: 12 }; // KA, toque, píldora
  if (t < 279) return { shutter: 0.5, samples: 8 };
  if (t < 284) return { shutter: 0.75, samples: 12 }; // guardar
  if (t < 293) return { shutter: 0.5, samples: 8 };
  if (t < 302) return { shutter: 0.75, samples: 24 }; // T20r: encogimiento rápido
  if (t < 316) return { shutter: 0.75, samples: 12 }; // sala, "Editado"
  if (t < 320) return { shutter: 0.5, samples: 8 };
  if (t < 328.5) return { shutter: 0.75, samples: 12 }; // CERRADO
  if (t < 331) return { shutter: 0.75, samples: 24 }; // toque: el botón sale disparado
  if (t < 346) return { shutter: 0.75, samples: 24 }; // TZ y pliegue: 24 tiles rápidos
  if (t < 352) return { shutter: 1, samples: 16 }; // implosión
  return { shutter: 0.75, samples: 16 }; // T15
}

const scene = {
  id: "e",
  start: START,
  end: END,
  draw,
  drawTop,
  topEnd: 306,
  motion,
  field,
  // R medido con phrase.glyphsStill (todos los glifos en reposo).
  phrases: [
    { id: "Leés.", words: 1, R: 245, L: 288 },
    { id: "Leés. Ajustás.", words: 2, R: 260, L: 288 },
  ],
  hits: [
    { f: 224, level: "H1", kind: "derrame de papel 60 %" },
    { f: 238, level: "H2", kind: "Leés. barrido" },
    { f: 245, level: "H3", kind: "Alex en negrita" },
    { f: 252, level: "H2", kind: "Ajustás. KA" },
    { f: 259, level: "H3", kind: "toque en Editar" },
    { f: 266, level: "H2", kind: "selección" },
    { f: 280, level: "H1", kind: "Guardar cambios" },
    { f: 294, level: "H2", kind: "salida y T20r" },
    { f: 308, level: "H2", kind: "Listo -> Editado" },
    { f: 322, level: "H2", kind: "CERRADO" },
    { f: 329, level: "H3", kind: "Descargar carpeta" },
    { f: 336, level: "H1", kind: "aterriza el zip" },
    { f: 343, level: "H3", kind: "cierre" },
    { f: 350, level: "H2", kind: "implosión" },
  ],
};

export default scene;
export { draw, drawTop, motion, field };
