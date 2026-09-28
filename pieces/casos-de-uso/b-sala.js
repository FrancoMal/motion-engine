// Pieza 2, escena B: "Toda la sala." (tratamiento final 4.3), f53-131, Crema.
//
// T17, segunda parte: el punto de "Cierra el período." estalla en f56 en unas
// 560 partículas de acento que arman "Toda la sala." como tipografía de matriz
// de puntos (de izquierda a derecha), más 24 que quedan flotando debajo: la
// sala. Un disco crema sale del mismo punto y le gana a las partículas. El
// núcleo del punto no se pierde: se junta y aterriza como el punto final de la
// frase nueva en el beat de f70, y la tinta aparece a través de las partículas
// (recorte por unión de círculos): las observaciones se vuelven palabras.
//
// Después la sala cae a su grilla de 8 x 3 (cada punto florece en un avatar),
// respira, cada avatar gira y se vuelve una planilla, y la docente marca: 1 o 2
// puntos por renglón pasan a acento con un tecleo de semicorcheas.
//
// T18': el día se cierra sobre la pila con un iris inverso (noche afuera) y las
// planillas vuelan a la pila, la más cercana primero, creciendo en espacio
// logarítmico hasta la hoja de la pila y tomando su afín. El punto final de la
// frase no se evapora: sube y se vuelve la luz de la lámpara.
//
// Capas: L1 trama de puntos a z +900 · L2 grilla de 12 columnas a z +300 · el
// mundo (sala) a z 0 · L5 motas a z -400 · la frase fija a la pantalla. La
// cámara del mundo (dolly de salida 1,04 → 1,00 y pulso de mano) no toca la
// frase.
//
// Costuras:
//   C-P2-1 f56  el punto (1625, 457) d 34: lo dibuja B desde f56.
//   C-P2-2 f64  crema en todo el cuadro (hasta f64 A pinta el papel debajo).
//   C-P2-3 f73  frase sólida en x 380 / base 440; 24 partículas en la nube.
//   C-P2-4 f102 24 planillas 96 x 124 en los centros de los avatares.
//   C-P2-5 t_j  la hoja j llega a su ranura de la pila; desde t_j la dibuja C.
//   C-P2-6 f120 noche afuera del iris cerrado; la lámpara es de C desde f110.

import { createCanvas } from "@napi-rs/canvas";
import { EASE, SPR, spr, p, ring } from "../../shared/system.js";
import { makePhrase, drawPhrase, drawDot, evaporar, bumps, periodScale } from "../../shared/phrase.js";
import { sampleGlyphPoints, burstHoming } from "../../shared/particles.js";
import { clipCircle } from "../../shared/masks.js";
import { C } from "../../shared/brand.js";
import { emit, env } from "../../engine/env.js";
import { setType } from "../../engine/text.js";
import { kf } from "../../engine/ease.js";
import { project, offscreen } from "../../engine/camera.js";
import { clamp, lerp, lerpLog, mix, noise1, hash2, deg, smoothstep } from "../../engine/math.js";
import { INITIALS, gridPos, gridCol, gridRow, RANK, landT, MINI, SHEET, PILE_SY, PILE_SKEW, drawSheetAt, pileCam, pileSlotOf, landing } from "./b-hojas.js";

// La pila es de C (C-P2-5): cámara, ranuras y estado de entrega (LANDING) se
// leen de c-pila.js en tiempo de ejecución a través de b-hojas (pileCam,
// pileSlotOf, landing), con réplicas si no cargó.

// ─── tiempos ─────────────────────────────────────────────────────────────────

const START = 53;
const END = 131;
const T_BURST = 56; // H1: estallido (CA 1 lo pone el compositor)
const T_FULL = 64; // el crema cubre todo (C-P2-2)
const T_LAND = 70; // H2: el punto final aterriza, la matriz se solidifica
const T_SOLID = 69; // recorte por unión de círculos 69-73
const T_R = 73;
// K5 más corto y antes que en el tratamiento: la frase termina de irse en ~f108,
// cuando "Los informes" (C) empieza a entintarse. Así nunca se leen las dos.
const T_L = 101;
const T_FLIP = 96; // los avatares giran (el canto pasa en f98)
const T_MARK = 101.5; // marcas de la docente (98 + 3,5)
const T_IRIS0 = 104;
const T_IRIS1 = 120;
const T_LAMP = 119; // el punto llega a la lámpara (112 + 7)

// ─── geometría ───────────────────────────────────────────────────────────────

const ORIGIN = [1625, 457];
const D_HANDOFF = 34;
const CREMA = C.accentSoft; // #fde9d3
const NOCHE = C.ink; // #1c1917
const LAMP = [1520, 300];

const PH = makePhrase({ text: "Toda la sala.", size: 200, wght: 760, tracking: -0.045, x: 380, baseline: 440, color: C.ink, periodColor: C.accent });
const PERIOD = PH.period; // ~ (1427, 426.5), d 27
// Grilla de muestreo: con 10,75 px de paso salen ~560 puntos (tratamiento: ~560).
const PITCH = 10.75;
const PTS = sampleGlyphPoints(PH, PITCH);
const N = PTS.length;
const P_R = 4; // radio de partícula

// Nube de la sala (mundo): una franja suelta debajo de la frase y arriba de la
// primera fila de la grilla (C-P2-3: debajo de y 500 en pantalla), así ningún
// punto queda flotando encima de un avatar ya abierto.
const CLOUD = INITIALS.map((_, i) => {
  const [gx] = gridPos(i);
  const r = gridRow(i);
  return [gx + (hash2(i, 901) - 0.5) * 110, 513 + 6 * r + (hash2(i, 902) - 0.5) * 12];
});
// Contacto de cada punto de la sala con su lugar (orden de grilla, 0,5 f).
const dropC = (i) => 77 + 0.5 * i;

// ─── cámara del mundo ────────────────────────────────────────────────────────
// Foco 1400. Dolly de salida: la capa del mundo va de 1,04 a 1,00 en f70-110
// (swell), moviendo la cámara en z, así las capas lejanas y cercanas escalan
// distinto (paralaje real). Pulso de mano de P2: 1,5 px, 0,4 Hz, roll 0,15°.

const FOC = 1400;
const PIV = [960, 740];
function cam(t) {
  const s0 = lerp(1.04, 1, p(t, 70, 110, EASE.swell));
  const n = t * 0.0267;
  return {
    s0,
    cz: FOC * (1 - 1 / s0),
    hx: 1.5 * noise1(n, 501),
    hy: 1.5 * noise1(n + 3.7, 502),
    roll: deg(0.15) * noise1(n + 7.1, 503),
  };
}
const zScale = (c, z) => FOC / (FOC + z - c.cz);
function layerXf(ctx, c, z) {
  const s = zScale(c, z);
  const par = s / c.s0;
  ctx.translate(PIV[0] + c.hx * par, PIV[1] + c.hy * par);
  ctx.rotate(c.roll);
  ctx.scale(s, s);
  ctx.translate(-PIV[0], -PIV[1]);
}
function proj(c, x, y, z = 0) {
  const s = zScale(c, z);
  const par = s / c.s0;
  const dx = (x - PIV[0]) * s;
  const dy = (y - PIV[1]) * s;
  const cr = Math.cos(c.roll);
  const sr = Math.sin(c.roll);
  return [PIV[0] + c.hx * par + dx * cr - dy * sr, PIV[1] + c.hy * par + dx * sr + dy * cr, s];
}

// ─── campo: barrido crema e iris de anochecer ────────────────────────────────

const wipeR = (t) => lerpLog(20, 2300, p(t, T_BURST, T_FULL, EASE.glide));
const insideWipe = (t, x, y) => (t >= T_FULL ? 1 : Math.hypot(x - ORIGIN[0], y - ORIGIN[1]) <= wipeR(t) ? 1 : 0);

const IRIS_C = [1440, 600];
const FEATHER = 300;
const irisR = (t) => lerpLog(2300, 20, p(t, T_IRIS0, T_IRIS1, EASE.swell));
// Cuánta noche hay en (x, y): 0 = día, 1 = noche. Borde de 300 px; cuando el
// radio es menor que medio borde, el centro también se va cerrando, así en f120
// no queda un agujero que salte.
function irisProfile(t) {
  const r = irisR(t);
  const hf = FEATHER / 2;
  return { r, inner: Math.max(0, r - hf), outer: r + hf, d0: r < hf ? 1 - r / hf : 0 };
}
function darkAt(t, x, y) {
  if (t < T_IRIS0) return 0;
  if (t >= T_IRIS1) return 1;
  const { inner, outer, d0 } = irisProfile(t);
  const d = Math.hypot(x - IRIS_C[0], y - IRIS_C[1]);
  if (d <= inner) return d0;
  if (d >= outer) return 1;
  return lerp(d0, 1, smoothstep(inner, outer, d));
}

function coverage(fn) {
  let s = 0;
  let n = 0;
  for (let y = 15; y < 1080; y += 30) {
    for (let x = 15; x < 1920; x += 30) {
      s += fn(x, y);
      n++;
    }
  }
  return s / n;
}

function drawIris(ctx, t) {
  if (t < T_IRIS0) return;
  const { inner, outer, d0 } = irisProfile(t);
  const g = ctx.createRadialGradient(IRIS_C[0], IRIS_C[1], inner, IRIS_C[0], IRIS_C[1], Math.max(inner + 0.5, outer));
  for (let k = 0; k <= 6; k++) {
    const u = k / 6;
    g.addColorStop(u, `rgba(28,25,23,${lerp(d0, 1, u * u * (3 - 2 * u)).toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 12000, 12000);
}

// ─── capas de profundidad ────────────────────────────────────────────────────

// L1: papel punteado a z +900 (la grilla de puntos de un cuaderno: las
// observaciones como textura), desenfocado por profundidad de campo (círculo
// de confusión ~5 px): cada punto es un sello chico ya difuso. Estampar ~700
// sellos de 16 px cuesta mucho menos que una trama de pantalla completa.
const L1_PITCH = 92;
const L1_DOT = (() => {
  const c = createCanvas(24, 24);
  const x = c.getContext("2d");
  const g = x.createRadialGradient(12, 12, 0, 12, 12, 11);
  g.addColorStop(0, "rgba(232,176,128,0.42)");
  g.addColorStop(0.45, "rgba(232,176,128,0.28)");
  g.addColorStop(1, "rgba(232,176,128,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 24, 24);
  return c;
})();
function drawL1(ctx, c) {
  const s = zScale(c, 900);
  const x0 = PIV[0] - 1000 / s;
  const x1 = PIV[0] + 1000 / s;
  const y0 = PIV[1] - 780 / s;
  const y1 = PIV[1] + 380 / s;
  ctx.save();
  layerXf(ctx, c, 900);
  const d = 17; // mundo; ~10 px en pantalla
  for (let y = Math.floor(y0 / L1_PITCH) * L1_PITCH; y <= y1; y += L1_PITCH) {
    for (let x = Math.floor(x0 / L1_PITCH) * L1_PITCH; x <= x1; x += L1_PITCH) ctx.drawImage(L1_DOT, x - d / 2, y - d / 2, d, d);
  }
  ctx.restore();
}

// L2: grilla de 12 columnas (márgenes 120, calle 24, columna 118), 1 px.
function drawL2(ctx, c) {
  ctx.save();
  layerXf(ctx, c, 300);
  const s = zScale(c, 300);
  ctx.beginPath();
  for (let k = -3; k <= 14; k++) {
    const xa = 120 + 142 * k;
    for (const xx of [xa, xa + 118]) {
      ctx.moveTo(xx, -700);
      ctx.lineTo(xx, 1900);
    }
  }
  ctx.lineWidth = 1 / s;
  ctx.strokeStyle = "rgba(235,228,214,0.35)";
  ctx.stroke();
  ctx.restore();
}

// L5: ocho motas desenfocadas #fff7ee a z -400 (posiciones en pantalla en
// reposo; se proyectan con la cámara, así se mueven más que el mundo).
const MOTES = Array.from({ length: 8 }, (_, k) => {
  const sx = 140 + ((k * 0.618034 + hash2(k, 961) * 0.3) % 1) * 1640;
  const sy = 120 + hash2(k, 962) * 840;
  const d = 30 + 30 * hash2(k, 963);
  // Pantalla en reposo → mundo a z -400 (escala 1,4 alrededor del pivote).
  return { x: PIV[0] + (sx - PIV[0]) / 1.4, y: PIV[1] + (sy - PIV[1]) / 1.4, d: d / 1.4, seed: k };
});
function drawMotes(ctx, t, c) {
  for (const m of MOTES) {
    const wx = m.x + 14 * noise1(t * 0.02 + m.seed * 3.1, 971);
    const wy = m.y + 10 * noise1(t * 0.02 + m.seed * 5.3, 972);
    const [x, y, s] = proj(c, wx, wy, -400);
    const lit = insideWipe(t, x, y) * (1 - darkAt(t, x, y));
    if (lit <= 0.01) continue;
    const r = (m.d / 2) * s * 1.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,247,238,${(0.4 * lit).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(255,247,238,${(0.3 * lit).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,247,238,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

// ─── estallido ───────────────────────────────────────────────────────────────

// Posiciones de la nube de la sala en pantalla en t (con su flotación).
function cloudScreen(t, c) {
  return CLOUD.map(([x, y], i) => {
    const hx = 5 * noise1(t * 0.06 + i * 1.7, 911);
    const hy = 4 * noise1(t * 0.06 + i * 2.3, 912);
    const [sx, sy] = proj(c, x + hx, y + hy);
    return [sx, sy];
  });
}

// Estallido con retorno (shared/particles.js): las N de la frase y las 24 de
// la sala. El retorno arranca de izquierda a derecha: 58 + 6 (x - 380) / 1080.
function burst(t, c) {
  const targets = PTS.concat(cloudScreen(t, c));
  return burstHoming(t, {
    origin: ORIGIN,
    targets,
    seed: 56,
    t0: T_BURST,
    homeStart: (i) => {
      const x = i < N ? PTS[i][0] : CLOUD[i - N][0];
      return 58 + 6 * clamp((x - 380) / 1080);
    },
    vMin: 20,
    vMax: 60,
    drag: 0.82,
    kMin: 400,
    kMax: 700,
    damping: 28,
  });
}

// Puntos de a uno: en Skia un solo camino con ~560 círculos tarda ~56 ms en
// rasterizar (subcaminos superpuestos, regla nonzero) y de a uno ~6 ms.
function dotsFill(ctx, pts, r, color, from = 0, to = pts.length) {
  ctx.fillStyle = color;
  for (let i = from; i < to; i++) {
    const q = pts[i];
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── la sala ─────────────────────────────────────────────────────────────────

// Respiración de f84: 1 → 1,06 → 1, un frame de desfase por columna.
function breath(t, col) {
  const u = t - (84 + col);
  if (u <= 0 || u >= 8) return 1;
  return 1 + 0.06 * (u < 3 ? EASE.swell(u / 3) : 1 - EASE.swell((u - 3) / 5));
}

const flipStart = (i) => T_FLIP + 0.25 * (gridCol(i) + gridRow(i));
const markT = (i, q) => T_MARK + 0.5 * (gridCol(i) + gridRow(i)) + 0.3 * q;
const spinOf = (i) => (hash2(i, 931) * 2 - 1) * deg(7);

function drawAvatar(ctx, x, y, r, sx, sy, fill, initials, textAlpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (textAlpha > 0.01 && r > 8) {
    const fs = 40 * (r / 55);
    setType(ctx, { size: fs, weight: 800, tracking: 0 });
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha *= textAlpha;
    ctx.fillStyle = C.surface;
    ctx.fillText(initials, 0, fs * 0.04);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

// Pose de la planilla i en t: en la grilla, agachándose, en vuelo o null si ya
// aterrizó (desde t_j la dibuja C).
function sheetPose(i, t, c) {
  const [gx, gy] = gridPos(i);
  const [ax, ay, s] = proj(c, gx, gy);
  const F0 = flipStart(i);
  const j = RANK[i];
  const tj = landT(j);
  const L0 = tj - 10;
  if (t >= tj) return null;
  const open = spr(t, F0 + 2, SPR.snap);
  const flipLift = 8 * s * Math.sin(Math.PI * clamp((t - F0) / 4.5));
  // Agacharse antes de salir y estirarse al despegar.
  const q = kf(t, [
    [L0 - 3, 0],
    [L0, 1, EASE.swell],
    [L0 + 2, -0.5, EASE.brake],
    [L0 + 4, 0, EASE.swell],
  ]);
  const pose = {
    x: ax,
    y: ay + (MINI.h / 2) * s - flipLift + 3 * q * s,
    w: MINI.w * s,
    h: MINI.h * s,
    rot: c.roll,
    sx: open * (1 + 0.035 * q),
    sy: 1 - 0.07 * q,
    psy: 1,
    skew: 0,
    k: 0,
    lift: 0,
    shadow: 1,
    flipShade: 0.3 * (1 - clamp(open)),
    j,
    flying: false,
  };
  if (t < L0) return pose;

  // Vuelo: arco de 10 f (control 160 px arriba del punto medio, lunge) hasta
  // 30 px sobre la ranura; en los últimos 6 f, la caída K4 de 30 px, que llega
  // estirada a media amplitud (0,975 x 1,05): el mismo estado con el que C
  // arranca su aplaste en t_j.
  const e = EASE.lunge(clamp((t - L0) / 10));
  const pc = pileCam(t);
  const sl = pileSlotOf(j);
  const at = project(pc, sl.cx, sl.bottom, 0);
  const P0 = [pose.x, pose.y];
  const P3 = [at.x, at.y - 30 * at.s];
  const cx = (P0[0] + P3[0]) / 2;
  const cy = (P0[1] + P3[1]) / 2 - 160;
  const m = 1 - e;
  const x = m * m * P0[0] + 2 * m * e * cx + e * e * P3[0];
  let y = m * m * P0[1] + 2 * m * e * cy + e * e * P3[1];
  let ksx = 1;
  let ksy = 1;
  if (t >= tj - 6) {
    // Caída K4 de 30 px hasta el contacto: llega con la estirada de entrega de
    // C (LANDING.stretch), el estado desde el que C la aplasta.
    const a = EASE.accel(clamp((t - (tj - 6)) / 6));
    const st = landing().stretch;
    y += 30 * at.s * a;
    ksx = lerp(1, st[0], a);
    ksy = lerp(1, st[1], a);
  }
  // Se acerca a cámara a mitad del arco (z hasta -140). El tamaño y el layout
  // de la cara crecen tarde (e^1,5): la hoja viaja chica y legible y se abre
  // en la hoja de la pila al llegar.
  const bulge = FOC / (FOC - 140 * Math.sin(Math.PI * e));
  const g = Math.pow(e, 1.5);
  // El agacharse se disuelve en los primeros frames del vuelo.
  const q0 = clamp(1 - (t - L0) / 4);
  return {
    x,
    y,
    w: lerpLog(MINI.w * s, SHEET.w * at.s, g) * bulge,
    h: lerpLog(MINI.h * s, SHEET.h * at.s, g) * bulge,
    rot: lerp(c.roll, sl.rot + pc.roll, e) + spinOf(i) * Math.sin(Math.PI * e),
    sx: lerp(1, pose.sx, q0) * ksx,
    sy: lerp(1, pose.sy, q0) * ksy,
    psy: lerp(1, PILE_SY, e),
    skew: lerp(0, PILE_SKEW, e),
    k: g,
    lift: Math.sin(Math.PI * e),
    shadow: 1,
    flipShade: 0,
    j,
    pc,
    flying: true,
  };
}

function markState(i, t) {
  return (q) => {
    const M = markT(i, q);
    if (t < M) return { on: 0, scale: 1 };
    return { on: 1, scale: lerp(1.6, 1, spr(t, M, SPR.snap)) };
  };
}

function drawSheetPose(ctx, i, pose, t) {
  // Noche: en el anochecer la hoja queda tenue; al llegar a la pila entra en el
  // estado de entrega de C (papel y luz de la lámpara de LANDING).
  const dark = darkAt(t, pose.x, pose.y - pose.h * 0.45);
  const L = pose.flying ? smoothstep(0.45, 1, pose.k) : 0;
  drawSheetAt(ctx, i, pose, {
    mark: markState(i, t),
    // En la noche, una hoja que todavía no despegó queda casi apagada: si no,
    // la grilla gris se lee debajo de "Los informes".
    shade: 0.985 * dark * (1 - L),
    flipShade: pose.flipShade,
    shadow: pose.shadow * (1 - dark),
    lift: pose.lift,
    light: L,
    cam: pose.pc,
    under: pose.j > 0,
  });
}

function drawSala(ctx, t, c, B) {
  // 1) Puntos de la sala (flotando o cayendo): debajo de los avatares, así el
  //    que cae a la fila 2 pasa por detrás de la fila 1.
  for (let i = 0; i < 24; i++) {
    const C0 = dropC(i);
    if (t < C0) {
      if (!B) continue;
      let [x, y] = B[N + i];
      let sx = 1;
      let sy = 1;
      if (t >= C0 - 6) {
        const u = clamp((t - (C0 - 6)) / 6);
        const [gx, gy] = gridPos(i);
        const [tx, ty] = proj(c, gx, gy);
        x = lerp(x, tx, EASE.swell(u));
        y = lerp(y, ty, EASE.accel(u));
        sx = lerp(1, 0.95, EASE.accel(u));
        sy = lerp(1, 1.1, EASE.accel(u));
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      ctx.beginPath();
      ctx.arc(0, 0, P_R, 0, Math.PI * 2);
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.restore();
    }
  }
  // 2) Avatares.
  const flipping = [];
  for (let i = 0; i < 24; i++) {
    const C0 = dropC(i);
    if (t < C0) continue;
    const F0 = flipStart(i);
    if (t >= F0 + 2) {
      flipping.push(i);
      continue;
    }
    // Avatar: florece al contacto (r 4 → 55, snap) con el aplaste K4.
    const [gx, gy] = gridPos(i);
    const [x, y, s] = proj(c, gx, gy);
    const g = spr(t, C0, SPR.snap);
    // Inhalación antes del giro: el avatar se junta un 6 % en 3 f (swell).
    const inh = EASE.swell(p(t, F0 - 3, F0));
    let r = lerp(P_R, 55, g) * s * breath(t, gridCol(i)) * (1 - 0.06 * inh);
    let sx;
    let sy;
    if (t < C0 + 2) {
      const k = (t - C0) / 2;
      sx = lerp(1, 1.12, k);
      sy = lerp(1, 0.84, k);
    } else {
      const k = spr(t, C0 + 2, SPR.snap);
      sx = lerp(1.12, 1, k);
      sy = lerp(0.84, 1, k);
    }
    let lift = 0;
    let shadeK = 0;
    if (t >= F0) {
      // Giro: el avatar se cierra de canto en 2 f.
      const u = clamp((t - F0) / 2);
      sx *= 1 - EASE.accel(u);
      shadeK = 0.3 * u;
      lift = 8 * s * Math.sin(Math.PI * clamp((t - F0) / 4.5));
    }
    const fill = mix(C.accent, C.accentInk, p(t, C0, C0 + 4));
    // Onda de contacto: sale del borde del avatar cuando ya abrió (tenue).
    if (t >= C0 + 1.5 && t < C0 + 9.5) {
      const k = EASE.glide(clamp((t - C0 - 1.5) / 8));
      ctx.save();
      ctx.globalAlpha *= 0.32 * (1 - k);
      ctx.lineWidth = lerp(3, 0.5, k);
      ctx.strokeStyle = C.accentInk;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(r, 55 * s * lerp(0.95, 1.5, k)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Sombra de contacto suave.
    ctx.save();
    ctx.globalAlpha *= 0.1 * g * (1 - shadeK);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2 + 5 * s, r * sx, r * sy * 0.98, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.restore();
    drawAvatar(ctx, x, y - lift, r, sx, sy, shadeK > 0 ? mix(C.accentInk, "#3b1d10", shadeK) : fill, INITIALS[i], p(t, C0 + 2, C0 + 5));
  }

  // 2) Planillas: primero las que siguen en la grilla, después las que vuelan
  //    (la de rango más alto arriba: aterriza encima).
  if (flipping.length) {
    const resting = [];
    const flying = [];
    for (const i of flipping) {
      const pose = sheetPose(i, t, c);
      if (!pose) continue;
      (pose.flying ? flying : resting).push([i, pose]);
    }
    for (const [i, pose] of resting) drawSheetPose(ctx, i, pose, t);
    flying.sort((a, b) => a[1].j - b[1].j);
    for (const [i, pose] of flying) drawSheetPose(ctx, i, pose, t);
  }
}

// ─── la frase y su punto ─────────────────────────────────────────────────────

// La noche se traga la tinta: la frase ya salió de lectura (L = 106) cuando el
// iris la alcanza, así que en vez de invertirla (K7) cada glifo se apaga donde
// ya es de noche. Así nunca se cruza con "Los informes", que entra claro en la
// oscuridad desde f108 (C).
const noche = (t, g, st, ph) => {
  const d = darkAt(t, g.ax + g.w / 2 + st.dx, ph.baseline - ph.cap / 2 + st.dy);
  if (d > 0.001) st.alpha *= 1 - smoothstep(0.15, 0.75, d);
};
export const PROGRAM = [bumps([98], 60), evaporar(T_L, { stagger: 0.25, dur: 4 }), noche];

const T_SOLID_END = 72.5; // desde acá la frase va sin recorte
const rClip = (t) => lerp(P_R, 13, EASE.brake(clamp((t - T_SOLID) / (T_SOLID_END - T_SOLID))));
// Frame en que el recorte llega a 10 px y las partículas se retiran.
const T_RETIRE = (() => {
  let lo = T_SOLID;
  let hi = T_SOLID_END;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (rClip(mid) < 10) lo = mid;
    else hi = mid;
  }
  return hi;
})();

// El punto: estalla (núcleo que se achica), se junta y aterriza como el punto
// final de "Toda la sala." en f70; en f108 se agacha, sube y en f119 se vuelve
// la luz de la lámpara.
const CORE_ARC = { from: ORIGIN, to: [PERIOD.cx, PERIOD.cy], ctrl: [(ORIGIN[0] + PERIOD.cx) / 2 + 10, Math.min(ORIGIN[1], PERIOD.cy) - 90] };
const LAMP_ARC = { from: [PERIOD.cx, PERIOD.cy], to: LAMP, ctrl: [PERIOD.cx - 30, LAMP[1] - 40] };
const quad = (A, t) => {
  const m = 1 - t;
  return [m * m * A.from[0] + 2 * m * t * A.ctrl[0] + t * t * A.to[0], m * m * A.from[1] + 2 * m * t * A.ctrl[1] + t * t * A.to[1]];
};

function periodState(t) {
  if (t < T_BURST) return null;
  if (t < 62) {
    const d = lerp(D_HANDOFF, 18, EASE.brake(p(t, T_BURST, 59)));
    return { x: ORIGIN[0], y: ORIGIN[1], d, color: C.accent, glow: 0.8 * (1 - p(t, T_BURST, 60)) };
  }
  if (t < T_LAND) {
    const u = EASE.lunge(p(t, 62, T_LAND));
    const [x, y] = quad(CORE_ARC, u);
    return { x, y, d: lerp(18, PERIOD.d * 1.5, u), color: C.accent, glow: 0.35 };
  }
  const base = PERIOD.d * periodScale(t, { H: T_LAND, from: 1.5, cfg: SPR.slam });
  if (t < 108) return { x: PERIOD.cx, y: PERIOD.cy, d: base, color: C.accent, glow: 0 };
  if (t < 111) {
    const k = EASE.swell(p(t, 108, 111));
    const x = PERIOD.cx;
    const y = PERIOD.cy + 7 * k;
    const dk = darkAt(t, x, y);
    return { x, y, d: PERIOD.d * (1 + 0.12 * k), color: mix(C.accent, C.dAccent, dk), glow: 0.3 + 0.7 * dk };
  }
  if (t < T_LAMP) {
    const u = EASE.lunge(p(t, 111, T_LAMP));
    let [x, y] = quad(LAMP_ARC, u);
    y += 7 * (1 - EASE.brake(p(t, 111, 113)));
    const dk = darkAt(t, x, y);
    return { x, y, d: PERIOD.d * lerp(1.12, 0.9, u), color: mix(C.accent, C.dAccent, Math.max(dk, u)), glow: 0.4 + 0.6 * Math.max(dk, u) };
  }
  // Florece en luz: el punto se apaga y el brillo se abre y se va (la lámpara
  // de C ya está entrando, 110-124).
  const k = p(t, T_LAMP, T_LAMP + 4, EASE.brake);
  return { x: LAMP[0], y: LAMP[1], d: PERIOD.d * 0.9 * (1 - k), color: C.dAccent, glow: 1 - k, bloom: p(t, T_LAMP, T_LAMP + 7, EASE.glide) };
}

function drawPeriod(ctx, t) {
  const st = periodState(t);
  if (!st) return;
  // Anillos: aterrizaje (f70), beat de lectura (f84), la lámpara (f119).
  if (t >= T_LAND && t < 108) {
    ring(ctx, t, T_LAND, PERIOD.cx, PERIOD.cy, PERIOD.d, C.accent);
    ring(ctx, t, 84, PERIOD.cx, PERIOD.cy, PERIOD.d, C.accent);
  }
  ring(ctx, t, T_LAMP, LAMP[0], LAMP[1], PERIOD.d * 0.9, C.dAccent);
  if (st.d > 0.3) drawDot(ctx, st.x, st.y, st.d, st.color);
  if (st.glow > 0.01 || st.bloom) {
    emit(ctx, (e) => {
      if (st.d > 0.3) {
        e.fillStyle = `rgba(251,146,60,${(0.9 * st.glow).toFixed(3)})`;
        e.beginPath();
        e.arc(st.x, st.y, st.d * 0.62, 0, Math.PI * 2);
        e.fill();
      }
      if (st.bloom !== undefined) {
        const r = lerp(14, 170, st.bloom);
        const g = e.createRadialGradient(st.x, st.y, 0, st.x, st.y, r);
        const a = 0.85 * (1 - st.bloom);
        g.addColorStop(0, `rgba(251,146,60,${a.toFixed(3)})`);
        g.addColorStop(1, "rgba(251,146,60,0)");
        e.fillStyle = g;
        e.fillRect(st.x - r, st.y - r, 2 * r, 2 * r);
      }
    });
  }
}

// La tinta a través de las partículas: la frase recortada por la unión de
// círculos (tratamiento: clipUnionCircles). Con ~560 círculos, el clip de Skia
// tarda ~58 ms por sub-frame; como máscara (círculos de a uno en un buffer y
// destination-in) es la misma forma en ~8 ms.
const SOL_BOX = [340, 240, 1520, 490];
function drawSolid(ctx, t, B) {
  const sc = env.scale || 1;
  const bw = Math.ceil((SOL_BOX[2] - SOL_BOX[0]) * sc);
  const bh = Math.ceil((SOL_BOX[3] - SOL_BOX[1]) * sc);
  const A = offscreen("b-solid:txt", bw, bh);
  A.ctx.setTransform(sc, 0, 0, sc, -SOL_BOX[0] * sc, -SOL_BOX[1] * sc);
  drawPhrase(A.ctx, PH, t, PROGRAM);
  const Mk = offscreen("b-solid:mask", bw, bh);
  Mk.ctx.setTransform(sc, 0, 0, sc, -SOL_BOX[0] * sc, -SOL_BOX[1] * sc);
  // Los círculos parten de las partículas y terminan en su lugar exacto: la
  // tinta cubre la frase entera antes de soltar el recorte (sin mordidas).
  const u = EASE.brake(p(t, T_SOLID, T_SOLID_END));
  const r = rClip(t);
  Mk.ctx.fillStyle = "#000";
  for (let i = 0; i < N; i++) {
    Mk.ctx.beginPath();
    Mk.ctx.arc(lerp(B[i][0], PTS[i][0], u), lerp(B[i][1], PTS[i][1], u), r, 0, Math.PI * 2);
    Mk.ctx.fill();
  }
  A.ctx.setTransform(1, 0, 0, 1, 0, 0);
  A.ctx.globalCompositeOperation = "destination-in";
  A.ctx.drawImage(Mk.canvas, 0, 0);
  A.ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(A.canvas, SOL_BOX[0], SOL_BOX[1], bw / sc, bh / sc);
}

function drawType(ctx, t, B) {
  // Partículas de la frase: estallido, retorno y matriz de puntos.
  if (B && t < T_SOLID) {
    dotsFill(ctx, B, P_R, C.accent, 0, N);
    if (t < 66) {
      const a = 0.55 * (1 - p(t, T_BURST, 66));
      emit(ctx, (e) => {
        e.globalAlpha *= a;
        dotsFill(e, B, P_R * 1.2, "#fb923c", 0, N);
      });
    }
  }
  // La tinta aparece a través de las partículas (unión de círculos, r 4 → 12).
  if (t >= T_SOLID) {
    if (t < T_SOLID_END && B) {
      drawSolid(ctx, t, B);
      // Las partículas quedan arriba y se achican hasta retirarse (r 10): el
      // punto de acento se abre en tinta.
      if (t < T_RETIRE) dotsFill(ctx, B, P_R * (1 - EASE.brake(p(t, T_SOLID, T_RETIRE))), C.accent, 0, N);
    } else drawPhrase(ctx, PH, t, PROGRAM);
  }
}

// ─── escena ──────────────────────────────────────────────────────────────────

function draw(ctx, t) {
  if (t < T_BURST) return;
  if (t >= T_IRIS1) {
    ctx.fillStyle = NOCHE;
    ctx.fillRect(-4000, -4000, 12000, 12000);
    return;
  }
  const c = cam(t);
  const partial = t < T_FULL;
  ctx.save();
  if (partial) clipCircle(ctx, ORIGIN[0], ORIGIN[1], wipeR(t));
  ctx.fillStyle = CREMA;
  ctx.fillRect(-4000, -4000, 12000, 12000);
  drawL1(ctx, c);
  drawL2(ctx, c);
  ctx.restore();
  if (partial) {
    // Borde del barrido: una banda apenas más cálida adentro del frente.
    const r = wipeR(t);
    const g = ctx.createRadialGradient(ORIGIN[0], ORIGIN[1], Math.max(0, r - 70), ORIGIN[0], ORIGIN[1], r);
    g.addColorStop(0, "rgba(243,201,160,0)");
    g.addColorStop(1, "rgba(243,201,160,0.55)");
    ctx.save();
    clipCircle(ctx, ORIGIN[0], ORIGIN[1], r);
    ctx.fillStyle = g;
    ctx.fillRect(-4000, -4000, 12000, 12000);
    ctx.restore();
  }
  drawIris(ctx, t);
}

// Capa de arriba (se llama después de C): la sala y las hojas en vuelo (así
// una hoja que aterriza queda encima de la pila de C), las motas y la frase.
function drawTop(ctx, t) {
  if (t < T_BURST || t >= END) return;
  const c = cam(t);
  const B = t < 89 ? burst(t, c) : null;
  drawSala(ctx, t, c, B);
  if (t < T_IRIS1) drawMotes(ctx, t, c);
  if (t < 124) drawType(ctx, t, B);
  // Destello del estallido (capa emisiva) y onda del golpe.
  if (t < 60) {
    const k = p(t, T_BURST, 60, EASE.glide);
    emit(ctx, (e) => {
      const r = lerp(24, 120, k);
      const g = e.createRadialGradient(ORIGIN[0], ORIGIN[1], 0, ORIGIN[0], ORIGIN[1], r);
      g.addColorStop(0, `rgba(251,146,60,${(0.9 * (1 - k)).toFixed(3)})`);
      g.addColorStop(1, "rgba(251,146,60,0)");
      e.fillStyle = g;
      e.fillRect(ORIGIN[0] - r, ORIGIN[1] - r, 2 * r, 2 * r);
    });
    ring(ctx, t, T_BURST, ORIGIN[0], ORIGIN[1], D_HANDOFF, C.accent);
  }
  drawPeriod(ctx, t);
}

// Motion blur (2.5): 360° en el barrido de campo, 270° en el estallido, las
// caídas, los giros, el iris y los vuelos; 180° en la lectura quieta.
function motion(t) {
  if (t < 55) return { shutter: 0.5, samples: 8 };
  if (t < T_FULL) return { shutter: 1, samples: 16 };
  if (t < 92) return { shutter: 0.75, samples: 12 };
  if (t < 95) return { shutter: 0.5, samples: 8 };
  if (t < 130) return { shutter: 0.75, samples: 12 };
  return { shutter: 0.5, samples: 8 };
}

// Pesos del grade por cobertura: papel → crema por el disco (56-64), crema, crema
// → noche por el iris (104-120), noche.
function field(t) {
  if (t < T_BURST) return null;
  if (t < T_FULL) {
    const r = wipeR(t);
    const cov = coverage((x, y) => (Math.hypot(x - ORIGIN[0], y - ORIGIN[1]) <= r ? 1 : 0));
    return { papel: 1 - cov, crema: cov };
  }
  if (t < T_IRIS0) return { crema: 1 };
  if (t < T_IRIS1) {
    const d = coverage((x, y) => darkAt(t, x, y));
    return { crema: 1 - d, noche: d };
  }
  return { noche: 1 };
}

// Expuesto para verificaciones (contratos, lectura) y para el banco de prueba.
export const _debug = { PH, PTS, N, burst, cam, proj, sheetPose, periodState, darkAt, wipeR, irisR, dropC, flipStart, markT, T_RETIRE, drawL1, drawL2, drawIris, drawSala, drawType, drawMotes, drawPeriod };

export default {
  id: "b",
  start: START,
  end: END,
  topEnd: END,
  draw,
  drawTop,
  motion,
  field,
  phrases: [{ id: "toda-la-sala", words: 3, R: T_R, L: T_L }],
  hits: [
    { f: 56, level: "H1", kind: "burst" },
    { f: 70, level: "H2", kind: "period-land" },
    { f: 77, level: "H3", kind: "sala-drop" },
    { f: 84, level: "H2", kind: "breathe" },
    { f: 98, level: "H2", kind: "flip" },
    { f: 101.5, level: "H3", kind: "marks" },
    { f: 112, level: "H1", kind: "dusk" },
    { f: 119, level: "H3", kind: "lamp" },
  ],
};
