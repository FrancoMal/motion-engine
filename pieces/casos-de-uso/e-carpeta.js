// Escena E, segunda mitad (tratamiento final 4.6): el Resumen del período con
// los 24 tiles, "Listo" -> "Editado", el sello CERRADO (verdadero recién ahora:
// los 24 tienen informe), "Descargar carpeta", TZ (el botón se vuelve el tile
// del .zip, los 24 tiles se pliegan adentro, el cierre sube y baja), la
// implosión a un punto y T15 (el punto vuela al contrato de la placa final).

import { EASE, SPR, spr, p, ring } from "../../shared/system.js";
import { makePhrase, drawPhrase, evaporar, drawDot } from "../../shared/phrase.js";
import { flightV } from "../../shared/punto.js";
import { C } from "../../shared/brand.js";
import { rr } from "../../shared/ui.js";
import { drawText, glyphs } from "../../engine/text.js";
import { clamp, lerp, lerpLog, mix, deg, hash1, TAU } from "../../engine/math.js";
import { cubicBezier } from "../../engine/ease.js";
import { emit } from "../../engine/env.js";
import { tileBody, tileContent, TW, TH, outlineAccentButton, ripple, PAPER } from "./e-ui.js";
import { IS_V } from "../../engine/format.js";

// ─── grilla ──────────────────────────────────────────────────────────────────
export const INITIALS = ["AE", "NE", "SE", "DE", "EE", "JE", "CE", "TE", "PE", "LE", "RE", "FE", "GE", "BE", "ME", "VE", "OE", "HE", "ZE", "AP", "NP", "SP", "DP", "TP"];
// En vertical la sala va en 4 columnas x 6 filas debajo del encabezado
// apilado (x 1074-1854, el mismo eje que la pila y la tarjeta de lectura).
export const COLS = IS_V ? 4 : 8;
const ROWS = IS_V ? [353, 523, 693, 863, 1033, 1203] : [420, 590, 760];
const X0 = IS_V ? 1164 : 260;
export const tileCenter = (i) => [X0 + 200 * (i % COLS), ROWS[Math.floor(i / COLS)]];
export const ZC = IS_V ? [1464, 778] : [960, 600]; // centro del zip
// Orden de plegado: distancia al centro del zip, los cercanos primero.
const RANK = (() => {
  const idx = INITIALS.map((_, i) => i);
  idx.sort((a, b) => {
    const [ax, ay] = tileCenter(a);
    const [bx, by] = tileCenter(b);
    return Math.hypot(ax - ZC[0], ay - ZC[1]) - Math.hypot(bx - ZC[0], by - ZC[1]) || a - b;
  });
  const r = new Array(24);
  idx.forEach((i, k) => (r[i] = k));
  return r;
})();

export const T = {
  exit: 294,
  land: 308, // tiles en su lugar (C-P2-11); "Listo" -> "Editado"
  stamp: 322, // CERRADO
  tap: 329, // "Descargar carpeta"
  zip: 336, // el tile del zip aterriza (C-P2-12)
  fold0: 331,
  zipper: 343,
  imp0: 346.5,
  imp1: 350, // implosión completa (downbeat de beat 26)
  dot: 352, // C-P2-13
  end: 358, // C-END
};

// ─── encabezado ──────────────────────────────────────────────────────────────
// En vertical el encabezado se apila: título, subtítulo con el sello, y la
// cuenta en su propio renglón con el botón a la derecha.
const HX = IS_V ? 1074 : 170;
const HY = IS_V ? 100 : 200;
const HEAD = {
  title: makePhrase({ text: "Resumen del período", size: 44, wght: 800, tracking: 0, x: HX, baseline: HY, color: C.ink }),
  sub: makePhrase({ text: "Sala Verde · Medio 2026", size: 28, wght: 600, tracking: 0, x: HX, baseline: HY + 50, color: C.inkSoft }),
  count: IS_V
    ? makePhrase({ text: "24 de 24 alumnos con informe", size: 26, wght: 600, tracking: 0, x: HX, baseline: HY + 118, color: C.success })
    : makePhrase({ text: "24 de 24 alumnos con informe", size: 26, wght: 600, tracking: 0, x: 1750, baseline: 200, align: "right", color: C.success }),
};
const BTN = IS_V ? { x: 1536, y: HY + 78, w: 318, h: 60 } : { x: 1432, y: 226, w: 318, h: 60 };
const STAMP = { x: HX + 330, y: HY + 26, w: 155, h: 36 };

const rise = (t0) => (t, g, st) => {
  st.dy += 24 * (1 - EASE.glide(p(t, t0, t0 + 8)));
  st.alpha *= p(t, t0, t0 + 4);
};
const evap = (X, n) => evaporar(X, { stagger: Math.min(0.5, 3 / n), dur: 5 });

export function drawHeader(ctx, t) {
  if (t < 297 || t > 348) return;
  drawPhrase(ctx, HEAD.title, t, [rise(298), evap(332, HEAD.title.n)]);
  drawPhrase(ctx, HEAD.sub, t, [rise(299.5), evap(333, HEAD.sub.n)]);
  drawPhrase(ctx, HEAD.count, t, [rise(301), evap(332.5, HEAD.count.n)]);
  drawStamp(ctx, t);
  // El botón vive en el mundo hasta el toque; desde f329 lo dibuja el zip.
  if (t < T.tap) {
    const k = EASE.glide(p(t, 302.5, 310.5));
    const press = t < T.tap - 2.5 ? 0 : EASE.swell(p(t, T.tap - 2.5, T.tap));
    ctx.save();
    ctx.translate(0, 24 * (1 - k));
    outlineAccentButton(ctx, BTN.x, BTN.y, BTN.w, BTN.h, "Descargar carpeta", "download", { alpha: p(t, 302.5, 306.5), press });
    ctx.restore();
  }
}

// CERRADO: cae como un sello en f322 (1,35 -> 1 en slam, -5° -> 0), anillo
// de polvo fino. Recién ahora es verdad: los 24 tienen informe.
function drawStamp(ctx, t) {
  if (t < T.stamp - 3) return;
  const pre = p(t, T.stamp - 3, T.stamp, EASE.accel);
  let s;
  let rot;
  if (t < T.stamp) {
    s = lerp(1.9, 1.35, pre);
    rot = deg(-9 + 4 * pre);
  } else {
    const k = spr(t, T.stamp, SPR.slam);
    s = lerp(1.35, 1, k);
    rot = deg(-5) * (1 - k);
  }
  const out = p(t, 333.5, 339, EASE.accel);
  const a = clamp((t - (T.stamp - 3)) / 2) * (1 - out);
  if (a <= 0.002) return;
  const cx = STAMP.x + STAMP.w / 2;
  const cy = STAMP.y + STAMP.h / 2 - 14 * out;
  // Anillo de polvo: el contorno del sello que se abre y se apaga.
  if (t >= T.stamp && t < T.stamp + 12) {
    const k = EASE.glide(p(t, T.stamp, T.stamp + 12));
    const g = lerp(1.02, 1.55, k);
    ctx.save();
    ctx.globalAlpha *= 0.55 * (1 - k);
    rr(ctx, cx - (STAMP.w / 2) * g, cy - (STAMP.h / 2) * g - 2 * k, STAMP.w * g, STAMP.h * g, 10 * g);
    ctx.lineWidth = lerp(2.5, 0.6, k);
    ctx.strokeStyle = C.success;
    ctx.stroke();
    // Motas de polvo.
    ctx.fillStyle = "#b9ad97";
    for (let i = 0; i < 12; i++) {
      const ang = hash1(900 + i) * TAU;
      const dist = lerp(0, 40 + 50 * hash1(930 + i), k);
      const ex = Math.cos(ang);
      const ey = Math.sin(ang);
      const x = cx + ex * (STAMP.w / 2 + dist) * 0.9;
      const y = cy + ey * (STAMP.h / 2 + dist * 0.45);
      ctx.beginPath();
      ctx.arc(x, y, lerp(2.2, 0.6, k), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(s * (1 - 0.1 * out), s * (1 - 0.1 * out));
  // Sombra de apoyo que crece al asentarse.
  ctx.save();
  ctx.shadowColor = `rgba(63,98,18,${0.18 * clamp(2 - s)})`;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  rr(ctx, -STAMP.w / 2, -STAMP.h / 2, STAMP.w, STAMP.h, 10);
  ctx.fillStyle = C.successSoft;
  ctx.fill();
  ctx.restore();
  const st = { size: 24, weight: 800, tracking: 0.08 };
  const cap = glyphs(ctx, "CERRADO", st).cap;
  drawText(ctx, "CERRADO", 0, cap / 2, st, { align: "center", color: C.success });
  ctx.restore();
}

// ─── tiles ───────────────────────────────────────────────────────────────────

// Tag de Alex: "Listo" hasta f308, voltea a "Editado" (pop con back).
export function alexTags(t) {
  const S = T.land - 2; // el pop ya se ve grande en el frame del golpe
  if (t < S - 2.5) return [{ kind: "listo" }];
  if (t < S) {
    const k = EASE.accel(p(t, S - 2.5, S));
    return [{ kind: "listo", sy: 1 - k, sx: 1 + 0.08 * k }];
  }
  const k = EASE.back(p(t, S, S + 7));
  return [{ kind: "editado", sx: k, sy: k, alpha: p(t, S, S + 1.2) }];
}

// Onda de CERRADO por la grilla: cada tile late 1 -> 1,025 -> 1 con demora
// 0,5 f por (columna + fila) desde el sello.
function stampRipple(i, t) {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const t0 = T.stamp + 1 + 0.5 * (c + r);
  if (t < t0 || t > t0 + 8) return 1;
  return 1 + 0.025 * Math.sin(Math.PI * ((t - t0) / 8)) ** 2;
}

// Estado de un tile en el pliegue: vuela 8 f en accel hacia el zip, se achica
// al 20 % y se funde. Devuelve null si ya llegó.
const FOLD_DUR = 8;
export const foldLaunch = (i) => T.fold0 + 0.3 * RANK[i];
function foldState(i, t) {
  const L = foldLaunch(i);
  if (t < L) return { u: 0 };
  const u = EASE.accel(p(t, L, L + FOLD_DUR));
  if (u >= 0.999) return null;
  return { u };
}

// Dibuja los 23 tiles (Alex aparte hasta f308) en coordenadas de mundo.
// includeAlex: false durante T20r (la tarjeta que se encoge es su tile).
export function drawTiles(ctx, t, { includeAlex = true, alphaFn = null, target = ZC } = {}) {
  for (let i = 0; i < 24; i++) {
    if (i === 0 && !includeAlex) continue;
    const fs = foldState(i, t);
    if (!fs) continue;
    const [cx0, cy0] = tileCenter(i);
    const u = fs.u;
    // Espiral leve: cada tile curva hacia el zip por su lado (al centro real
    // del zip, que todavía está asentando su overshoot).
    const dx = target[0] - cx0;
    const dy = target[1] - cy0;
    const d = Math.hypot(dx, dy) || 1;
    const side = cx0 < ZC[0] ? 1 : -1;
    const swirl = 0.18 * d * Math.sin(Math.PI * u) * side;
    const cx = cx0 + dx * u + (-dy / d) * swirl;
    const cy = cy0 + dy * u + (dx / d) * swirl;
    const s = lerp(1, 0.2, u) * stampRipple(i, t);
    const a = (alphaFn ? alphaFn(i) : 1) * (1 - clamp((u - 0.55) / 0.45));
    if (a <= 0.002) continue;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(deg(14) * u * side * (0.5 + hash1(i + 70)));
    ctx.scale(s, s);
    ctx.translate(-TW / 2, -TH / 2);
    ctx.globalAlpha *= a;
    tileBody(ctx, { lift: lerp(0.45, 1.2, u) });
    tileContent(ctx, INITIALS[i], i === 0 ? alexTags(t) : [{ kind: "listo" }]);
    ctx.restore();
  }
}

// Opacidad de entrada de cada tile en T20r: una onda diagonal desde abajo a
// la derecha que termina en el lugar de Alex (arriba a la izquierda), donde
// aterriza la tarjeta; los tiles que caen bajo la frase que sale llegan
// últimos.
export const tileEnterAlpha = (t) => (i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  let t0 = T.exit + 0.45 * (COLS - 1 - c + ROWS.length - 1 - r);
  // Los que caen debajo de "Leés. / Ajustás." esperan a que la frase se vaya
  // (en vertical la frase va arriba de la sala y no tapa ninguno).
  if (!IS_V && c <= 2 && r <= 1) t0 = 301 + 0.6 * (2 - c) + 0.6 * (1 - r);
  return p(t, t0, t0 + 5);
};

// ─── el zip ──────────────────────────────────────────────────────────────────

const ZIP = { w: 200, h: 200, r: 44 };
const TEETH_Y0 = ZC[1] - 70;
const TEETH_Y1 = ZC[1] + 40;
const TAB = { w: 26, h: 40, y0: ZC[1] - 95 };

// Pops del zip con cada llegada de tile: 1 -> 1,03 -> 1 y se suman como un
// redoble corto.
function zipPop(t) {
  let acc = 0;
  for (let i = 0; i < 24; i++) {
    const k = t - (foldLaunch(i) + FOLD_DUR);
    if (k < 0 || k > 8) continue;
    acc += k < 1.2 ? k / 1.2 : Math.exp(-(k - 1.2) / 1.6);
  }
  return 1 + 0.045 * Math.tanh(acc / 1.6);
}

// Curva de la posición del botón al zip: arranca en el toque y llega en f336
// con velocidad (spring settle: toca el destino en su frame 7 y pasa 5 %).
const ARC_C = IS_V ? [1740, 600] : [1270, 640];
function arcPt(from, u) {
  const m = 1 - u;
  return [m * m * from[0] + 2 * m * u * ARC_C[0] + u * u * ZC[0], m * m * from[1] + 2 * m * u * ARC_C[1] + u * u * ZC[1]];
}

// Estado del zip en pantalla (o null). btnScreen(t) da el rect del botón en
// pantalla (el botón nace en el mundo, con la cámara).
export function zipState(t, btnScreen) {
  if (t < T.tap || t >= T.imp1) return null;
  const b = btnScreen;
  const kSize = EASE.glide(p(t, 330, T.zip));
  const kPos = spr(t, T.tap, SPR.settle);
  let [cx, cy] = arcPt([b.x + b.w / 2, b.y + b.h / 2], kPos);
  // La implosión cae exacta sobre el centro (C-P2-13), sin resto del spring.
  const toC = p(t, 344, T.imp1, EASE.swell);
  cx = lerp(cx, ZC[0], toC);
  cy = lerp(cy, ZC[1], toC);
  let w = lerpLog(b.w, ZIP.w, kSize);
  let h = lerpLog(b.h, ZIP.h, kSize);
  let r = lerp(14, ZIP.r, kSize);
  // Pops por llegadas, inhalación (f345-346.5) e implosión (f346.5-350).
  let s = zipPop(t);
  if (t >= 345) s *= 1 + 0.05 * EASE.swell(p(t, 345, T.imp0));
  let imp = 0;
  if (t >= T.imp0) {
    imp = p(t, T.imp0, T.imp1, EASE.accel);
    const size = lerpLog(ZIP.w * s, 13, imp, 0.001);
    w = size;
    h = size;
    s = 1;
    r = lerp(ZIP.r * (size / ZIP.w), size / 2, p(t, T.imp0, T.imp1));
  }
  // Squash de aterrizaje en f336: se aplasta en la dirección del viaje.
  let sx = 1;
  let sy = 1;
  if (t >= T.zip && t < T.zip + 10) {
    const k = t < T.zip + 1.5 ? EASE.brake((t - T.zip) / 1.5) : 1 - spr(t, T.zip + 1.5, SPR.snap);
    sx = 1 - 0.07 * k;
    sy = 1 + 0.05 * k;
  }
  return { cx, cy, w: w * s * sx, h: h * s * sy, r: r * s, kSize, imp, flood: p(t, T.tap - 0.5, 331, EASE.brake), press: 1 - p(t, T.tap, T.tap + 2.5) };
}

export function drawZip(ctx, t, btnScreen) {
  const z = zipState(t, btnScreen);
  if (!z) return;
  const x = z.cx - z.w / 2;
  const y = z.cy - z.h / 2;
  const contentA = 1 - p(t, T.tap - 0.25, T.tap + 1.25);
  if (z.kSize <= 0.001 && t < 330) {
    // Todavía es el botón (toque en f329): contorno de acento con su ripple.
    outlineAccentButton(ctx, x, y, z.w, z.h, "Descargar carpeta", "download", { press: z.press, contentAlpha: contentA, flood: z.flood });
    ripple(ctx, x, y, z.w, z.h, 14, t, T.tap, { maxR: 240, dur: 4.5 });
    return;
  }
  // Sombra del tile (se va con la implosión).
  const shadowA = 1 - z.imp;
  ctx.save();
  if (shadowA > 0.01) {
    ctx.shadowColor = `rgba(124,45,18,${0.32 * shadowA})`;
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 24;
  }
  rr(ctx, x, y, z.w, z.h, z.r);
  ctx.fillStyle = mix("#ffffff", C.accent, z.flood);
  ctx.fill();
  ctx.restore();
  if (z.flood < 1) {
    rr(ctx, x + 1, y + 1, z.w - 2, z.h - 2, Math.max(0, z.r - 1));
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Contenido del botón que se va.
  if (contentA > 0.002) {
    ctx.save();
    rr(ctx, x, y, z.w, z.h, z.r);
    ctx.clip();
    const cs = Math.min(1, z.w / BTN.w);
    ctx.translate(z.cx, z.cy);
    ctx.scale(cs, cs);
    outlineAccentButton(ctx, -BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, "Descargar carpeta", "download", { contentAlpha: contentA, flood: z.flood, body: false });
    ctx.restore();
  }
  // El toque se apaga antes de que el botón despegue: el zip aterriza en
  // acento puro (#c2410c) en f336.
  ripple(ctx, x, y, z.w, z.h, z.r, t, T.tap, { maxR: 240, dur: 4.5 });

  // Cierre: dientes y tirador, en el espacio del tile (200 x 200, centro 0,0).
  const contA = p(t, 333, 336) * (1 - p(t, T.imp0, T.imp0 + 2));
  if (contA > 0.002) {
    ctx.save();
    ctx.translate(z.cx, z.cy);
    ctx.scale(z.w / ZIP.w, z.h / ZIP.h);
    ctx.globalAlpha *= contA;
    const tabY = TAB.y0 - ZC[1] + 100 * (t < T.zipper ? 0 : spr(t, T.zipper, SPR.snap));
    const tabBottom = tabY + TAB.h;
    // Trazo continuo detrás de los dientes cerrados (punteado a continuo).
    const lineEnd = Math.min(TEETH_Y1 - ZC[1], tabBottom - 6);
    if (lineEnd > TEETH_Y0 - ZC[1]) {
      ctx.fillStyle = PAPER;
      rr(ctx, -3, TEETH_Y0 - ZC[1] - 4, 6, lineEnd - (TEETH_Y0 - ZC[1]) + 4, 3);
      ctx.fill();
    }
    for (let j = 0; j < 8; j++) {
      const ty = lerp(TEETH_Y0, TEETH_Y1, j / 7) - ZC[1];
      const closed = clamp((tabBottom - 4 - ty) / 12);
      const off = (j % 2 ? 6 : -6) * (1 - EASE.brake(closed));
      const pop = spr(t, 333 + 0.5 * j, SPR.snap);
      if (pop <= 0.002) continue;
      ctx.save();
      ctx.translate(off, ty);
      ctx.scale(pop, pop);
      rr(ctx, -7, -4, 14, 8, 2.5);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.restore();
    }
    const tabPop = spr(t, 335.5, SPR.slam);
    if (tabPop > 0.002) {
      ctx.save();
      ctx.translate(0, tabY + TAB.h / 2);
      ctx.scale(tabPop, tabPop);
      rr(ctx, -TAB.w / 2, -TAB.h / 2, TAB.w, TAB.h, 13);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, TAB.h / 2 - 11, 4.5, 0, TAU);
      ctx.fillStyle = C.accent;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// Etiqueta del archivo (textura, el nombre real de la carpeta).
const LABEL = makePhrase({ text: "Informes Periodo Medio 2026 - Sala Verde.zip", size: 28, wght: 700, tracking: 0, x: ZC[0], baseline: ZC[1] + 152, align: "center", color: C.ink });
export function drawZipLabel(ctx, t) {
  if (t < 337 || t > 350.5) return;
  // Velo de papel detrás del nombre: los tiles que todavía vuelan pasan por
  // debajo y el texto se lee limpio (regla del velo de papel).
  const va = p(t, 336.5, 339) * (1 - p(t, 345, 349));
  if (va > 0.002) {
    ctx.save();
    ctx.globalAlpha *= 0.85 * va;
    ctx.translate(ZC[0], ZC[1] + 141);
    ctx.scale(1, 0.16);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 420);
    g.addColorStop(0, "rgba(250,246,239,1)");
    g.addColorStop(0.6, "rgba(250,246,239,0.8)");
    g.addColorStop(1, "rgba(250,246,239,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-420, -420, 840, 840);
    ctx.restore();
  }
  drawPhrase(ctx, LABEL, t, [
    (tt, g, st) => {
      st.alpha *= p(tt, 337.5, 340.5);
      st.dy += 10 * (1 - EASE.glide(p(tt, 337.5, 342)));
    },
    evaporar(344, { stagger: 1.5 / LABEL.n, dur: 3.5 }),
  ]);
}

// ─── el punto (C-P2-13 y T15) ────────────────────────────────────────────────

// En vertical el punto sale hacia arriba: la cámara vertical viaja con él de
// la sala a la placa, y en pantalla el vuelo es corto.
const P0 = ZC;
const P1 = IS_V ? [ZC[0] + 90, ZC[1] - 110] : [1110, 570];
const P2 = [1077.0, 400.6];
const P3 = [1025.0, 430.6];
const DIR0 = (() => {
  const dx = P1[0] - P0[0];
  const dy = P1[1] - P0[1];
  const l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
})();
const ANT = 4; // px de anticipación antes del vuelo
const V0 = (ANT * Math.PI) / 2; // velocidad con la que sale de la anticipación

// Posición, diámetro y velocidad del punto para t en [350, 358].
export function dotAt(t) {
  if (t < T.imp1) return null;
  if (t < T.dot) {
    // Rebote de la implosión (13 -> 16) y anticipación contra el vuelo.
    const k = (t - T.imp1) / (T.dot - T.imp1);
    const o = -ANT * Math.sin(Math.PI * k);
    return { x: P0[0] + DIR0[0] * o, y: P0[1] + DIR0[1] * o, d: lerp(13, 16, EASE.brake(k)) };
  }
  const f = flightV(Math.min(t, T.end), { t0: T.dot, t1: T.end, P0, P1, P2, P3, v0: V0, v1: 14 });
  let x = f.x;
  let y = f.y;
  if (t > T.end) {
    x += -12.124 * (t - T.end);
    y += 7 * (t - T.end);
  }
  const u = clamp((t - T.dot) / (T.end - T.dot));
  return { x, y, d: lerp(16, 15.6, u) };
}

export function drawDotActor(ctx, t) {
  const s = dotAt(t);
  if (!s) return;
  // Anillo corto del contacto de la implosión (se apaga antes de f352).
  if (t < T.imp1 + 6) {
    const k = EASE.glide(p(t, T.imp1, T.imp1 + 6));
    ctx.save();
    ctx.globalAlpha *= 0.7 * (1 - k);
    ctx.lineWidth = lerp(3.5, 0.5, k);
    ctx.strokeStyle = C.accent;
    ctx.beginPath();
    ctx.arc(P0[0], P0[1], lerp(8, 44, k), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // Estiramiento de vuelo (smear): el punto se alarga en la dirección de la
  // velocidad en proporción a la rapidez, así la estela del obturador queda
  // densa en vez de lavada. Se relaja a redondo en el último frame y medio:
  // en f358 es el círculo exacto del contrato.
  const b = dotAt(t - 0.05);
  const vx = b ? (s.x - b.x) / 0.05 : 0;
  const vy = b ? (s.y - b.y) / 0.05 : 0;
  const speed = Math.hypot(vx, vy);
  const k = 1 + 0.03 * speed * (1 - p(t, 356.5, 358, EASE.swell));
  if (k > 1.01) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.scale(k, 1 / Math.pow(k, 0.3));
    drawDot(ctx, 0, 0, s.d, C.accent);
    ctx.restore();
  } else drawDot(ctx, s.x, s.y, s.d, C.accent);
  // Destello de la implosión (2 f) y brillo de punta en el vuelo, como la
  // punta de la lapicera de la placa.
  const flash = t < T.dot ? 1 - p(t, T.imp1, T.dot) : 0;
  emit(ctx, (e) => {
    e.fillStyle = `rgba(251,146,60,${0.9})`;
    e.beginPath();
    e.arc(s.x, s.y, s.d * 0.9 + 26 * flash, 0, TAU);
    e.fill();
  });
}

export { BTN, RANK };
