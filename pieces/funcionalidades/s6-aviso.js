// S6 "aviso en el celular" (tratamiento final 3.7), f280-358, Noche.
//
//   T13' f280-292  el panel de planificaciones encoge y se vuelve el ícono
//                  instalado; el teléfono se forma alrededor (pantalla por
//                  iris, bisel por trim, cuerpo) y la noche se derrama de él.
//   K4   f286.5    el push real cae en la ranura de arriba (contacto 290.5,
//                  el teléfono vibra).
//   TL   f290.5    el aviso se despega hacia cámara y se vuelve el hero legible
//                  "Ya están listos / tus 12 informes." (R 298, L 353).
//   hold           brillo 308, anillo 322, badge 336 (H1), anticipación 349.
//   T15  f351-358  el punto final vuela por la cúbica con largo de arco y llega
//                  con la velocidad exacta del contrato de la placa; un iris de
//                  papel centrado en el punto se come la noche (353-358).
//
// Contratos: C-P1-16 (panel en 280), C-P1-17 (env.shared.spill 282-303),
// C-P1-18 (aviso en la ranura en 290.5), C-P1-19 (hero en 298), C-END (358).

import { env, emit } from "../../engine/env.js";
import { camera, layer, card3d, offscreen, project } from "../../engine/camera.js";
import { clamp, lerp, lerpLog, hash2, noise1 } from "../../engine/math.js";
import { kf } from "../../engine/ease.js";
import { createCanvas } from "@napi-rs/canvas";
import { EASE, SPR, spr, p as prog, punch, ring } from "../../shared/system.js";
import { flightV } from "../../shared/punto.js";
import { rr } from "../../shared/ui.js";
import { C, drawMark } from "../../shared/brand.js";
import { contract } from "../../shared/endcard.js";
import { PANEL, drawPanelContent } from "./s6-panel.js";
import { HERO, BASE, PERIOD, cardBg, drawBaseContent, drawHeroContent } from "./s6-notif.js";
import { PH, APP, SLOT, BADGE, CAM, toWorld, toScreen, drawPhoneForming, drawPhoneAtRest } from "./s6-phone.js";

// El panel vivo de S5 (C-P1-16): si S5 exporta drawPanelLocal, la tercera
// tarjeta sigue abriéndose mientras el panel se achica. Si S5 no carga o
// falla, queda la copia local (s6-panel.js), así esta escena nunca se rompe
// por un archivo vecino a medio editar.
let s5PanelLocal = null;
try {
  const m = await import("./s5-panel.js");
  if (typeof m.drawPanelLocal === "function") s5PanelLocal = m.drawPanelLocal;
} catch {
  s5PanelLocal = null;
}
function panelLocal(c, t) {
  if (s5PanelLocal) {
    c.save();
    try {
      s5PanelLocal(c, t);
      c.restore();
      return;
    } catch {
      c.restore();
    }
  }
  drawPanelContent(c);
}

const START = 280;
const END = 358;
const NOCHE = "#1c1917";
const TAU = Math.PI * 2;

// ─── tiempos ─────────────────────────────────────────────────────────────────
const SPILL = { cx: PH.cx, cy: PH.cy, t0: 282, t1: 292 }; // la noche sale del teléfono
const DROP0 = 286.5;
const CONTACT = 290.5;
const R = 298;
const L = 353;

// Vuelo del punto (T15). P3 y la velocidad final salen del contrato de la placa
// (5.1); P2 queda sobre la tangente de llegada, así la dirección es exacta.
const V_END = contract.dot.v;
const SPEED_END = Math.hypot(V_END[0], V_END[1]);
const DIR_END = [V_END[0] / SPEED_END, V_END[1] / SPEED_END];
const P3 = [contract.dot.x, contract.dot.y];
const FLIGHT = {
  t0: 351,
  t1: 358,
  P0: [1178, 656 - 4], // el punto sale desde arriba de su anticipación
  P1: [1236, 540],
  P2: [P3[0] - DIR_END[0] * 60.04, P3[1] - DIR_END[1] * 60.04], // (1077.0, 400.6)
  P3,
  v0: 0,
  v1: SPEED_END, // 14.0 px/f
};

// ─── curvas ──────────────────────────────────────────────────────────────────
export const spillR = (t) => (t < SPILL.t0 ? 0 : lerpLog(20, 2300, EASE.glide(prog(t, SPILL.t0, SPILL.t1))));
const irisR = (t) => (t < L ? 0 : lerpLog(20, 2300, EASE.whip(prog(t, L, END))));
// TL: la posición, el tamaño y la rotación llegan con brake en 296.5; el
// overshoot de 3.7 (1.012 → 1.000 con swell hasta 300.5) va como escala hacia
// cámara alrededor del centro de la tarjeta, así el texto se mueve menos de
// 2 px/f desde R = 298 (con el overshoot en posición se movía 3.8 px/f).
const liftP = (t) => EASE.brake(prog(t, CONTACT, 296.5));
const liftS = (t) => kf(t, [[CONTACT, 1], [296.5, 1.01, EASE.brake], [300.5, 1.0, EASE.swell]]);
const rack = (t) => EASE.swell(prog(t, 291, 299));
const recede = (t) => EASE.accel(prog(t, L, 360));
// El foco se va al punto: el mundo se ablanda antes de que el iris lo tape.
const defocus = (t) => EASE.swell(prog(t, L, 357));

// Derrame exportado para la inversión K7 de S5.
export function spillAt(t) {
  return { cx: SPILL.cx, cy: SPILL.cy, r: spillR(t) };
}

// Vibración del teléfono al contacto: ±3 px, 3 ciclos, f290.5-295.5.
function buzz(t) {
  if (t < CONTACT || t > CONTACT + 5) return 0;
  const u = (t - CONTACT) / 5;
  return 3 * Math.sin(TAU * 3 * u) * (1 - 0.55 * u);
}

// K4 del aviso (h 140): cae 286.5-290.5 estirándose, aplasta 2 f, vuelve con snap.
function dropK4(t) {
  if (t < DROP0) return null;
  if (t < CONTACT) {
    const k = EASE.accel((t - DROP0) / (CONTACT - DROP0));
    return { dy: -140 * (1 - k), sx: lerp(1, 0.95, k), sy: lerp(1, 1.1, k) };
  }
  if (t < CONTACT + 2) {
    const k = (t - CONTACT) / 2;
    return { dy: 0, sx: lerp(0.95, 1.12, k), sy: lerp(1.1, 0.84, k) };
  }
  const k = spr(t, CONTACT + 2, SPR.snap);
  return { dy: 0, sx: lerp(1.12, 1, k), sy: lerp(0.84, 1, k) };
}

// Cámara del mundo: punch 3 en f280, identidad cuando la noche cubre todo
// (f292) y un dolly lento con truck durante la lectura (el hero no se mueve).
function worldCam(t) {
  let zoom = punch(t, START);
  let x = 0;
  let y = 0;
  if (t >= SPILL.t1) {
    const k = EASE.swell(prog(t, SPILL.t1, L));
    zoom *= 1 + 0.014 * k;
    x = 34 * k;
    y = -10 * k;
  }
  return camera({ F: 1400, x, y, zoom });
}

// Fracción del cuadro cubierta por un círculo (grilla de 64 x 36).
function coverage(cx, cy, r) {
  if (r <= 0) return 0;
  let n = 0;
  const r2 = r * r;
  for (let j = 0; j < 36; j++) {
    const y = (j + 0.5) * 30 - cy;
    for (let i = 0; i < 64; i++) {
      const x = (i + 0.5) * 30 - cx;
      if (x * x + y * y <= r2) n++;
    }
  }
  return n / (64 * 36);
}
const farCorner = (x, y) => Math.max(Math.hypot(x, y), Math.hypot(1920 - x, y), Math.hypot(x, 1080 - y), Math.hypot(1920 - x, 1080 - y));

// ─── capas de profundidad ────────────────────────────────────────────────────
// L1: bokeh cálido, 12 discos #fb923c al 6-10 %, 60-180 px, z +1200, fuera de foco.
const Z_BOKEH = 1200;
const BOKEH = Array.from({ length: 12 }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const h = (k) => hash2(i * 13 + 5, k * 7 + 3);
  return {
    x: (col + 0.15 + 0.7 * h(0)) * 480,
    y: (row + 0.15 + 0.7 * h(1)) * 360,
    d: lerp(60, 180, h(2)),
    a: lerp(0.06, 0.1, h(3)),
    drift: lerp(0.12, 0.3, h(4)),
  };
});
const spriteCache = new Map();
function softDisc(d, blur, color) {
  const key = d.toFixed(0) + "|" + blur + "|" + color;
  let s = spriteCache.get(key);
  if (s) return s;
  const pad = Math.ceil(blur * 3);
  const size = Math.ceil(d + pad * 2);
  const cv = createCanvas(size, size);
  const c = cv.getContext("2d");
  c.filter = `blur(${blur}px)`;
  c.fillStyle = color;
  c.beginPath();
  c.arc(size / 2, size / 2, d / 2, 0, TAU);
  c.fill();
  s = { canvas: cv, size };
  spriteCache.set(key, s);
  return s;
}

// Posición de mundo para que un elemento de capa z caiga en (sx, sy) con la
// cámara en reposo.
const S_OF = (z) => 1400 / (1400 + z);
const worldAt = (sx, sy, z) => [960 + (sx - 960) / S_OF(z), 540 + (sy - 540) / S_OF(z)];

function drawBokeh(ctx, t, cam) {
  for (const b of BOKEH) {
    const [wx, wy] = worldAt(b.x, b.y - b.drift * (t - START), Z_BOKEH);
    const p = project(cam, wx, wy, Z_BOKEH);
    if (!p) continue;
    const sp = softDisc(b.d, 18, "#fb923c");
    const k = p.s / S_OF(Z_BOKEH);
    const sz = sp.size * k;
    ctx.save();
    ctx.globalAlpha *= b.a;
    ctx.drawImage(sp.canvas, p.x - sz / 2, p.y - sz / 2, sz, sz);
    ctx.restore();
  }
}

// L2: grilla de 12 columnas (márgenes 120, calle 24, columna 118) en z +300.
function drawGrid(ctx, cam) {
  const s0 = S_OF(300);
  layer(ctx, cam, 300, (c, s) => {
    c.fillStyle = "#26201c";
    for (let k = 0; k < 12; k++) {
      for (const sx of [120 + k * 142, 238 + k * 142]) {
        const wx = 960 + (sx - 960) / s0;
        c.fillRect(wx - 0.5 / s, -600, 1 / s, 2300);
      }
    }
  });
}

// L5: motas desenfocadas adelante de todo (z -400), lejos del texto del hero.
const Z_MOTE = -400;
const MOTES = [
  [180, 180, 14, 0.16],
  [330, 860, 22, 0.12],
  [90, 610, 10, 0.2],
  [760, 120, 12, 0.14],
  [1780, 170, 18, 0.13],
  [1840, 780, 26, 0.1],
  [1640, 1000, 12, 0.16],
  [980, 960, 16, 0.12],
  [420, 330, 8, 0.2],
].map(([x, y, d, a], i) => ({ x, y, d, a, seed: 40 + i }));
function drawMotes(ctx, t, cam) {
  for (const m of MOTES) {
    const sx = m.x + 22 * noise1((t - START) * 0.018, m.seed);
    const sy = m.y - 0.35 * (t - START) + 10 * noise1((t - START) * 0.021, m.seed + 9);
    const [wx, wy] = worldAt(sx, sy, Z_MOTE);
    const p = project(cam, wx, wy, Z_MOTE);
    if (!p) continue;
    const sp = softDisc(m.d, 5, "#fde9d3");
    const sz = sp.size * (p.s / S_OF(Z_MOTE)) * 1.4;
    ctx.save();
    ctx.globalAlpha *= m.a;
    ctx.drawImage(sp.canvas, p.x - sz / 2, p.y - sz / 2, sz, sz);
    ctx.restore();
  }
}

// ─── texturas con tamaño por baldes (nítidas a cualquier escala) ─────────────
function bucketTex(key, w, aspect, draw) {
  const need = w * 1.35 * Math.max(0.5, env.scale);
  const B = [96, 128, 176, 240, 320, 440, 600, 800, 1100, 1400];
  let bw = B[B.length - 1];
  for (const b of B) {
    if (b >= need) {
      bw = b;
      break;
    }
  }
  const bh = Math.ceil(bw * aspect);
  const o = offscreen(`s6-${key}-${bw}`, bw, bh);
  return { o, bw, bh };
}

// Sombra de un rect redondeado, cacheada una vez por tipo y dibujada estirada
// al tamaño que haga falta (la penumbra escala con la tarjeta, como si la luz
// estuviera fija respecto del objeto). spread negativo = rect achicado.
const shadowCache = new Map();
function shadowSprite(key, w, h, r, blur, offY, alpha, inset = 0) {
  let sp = shadowCache.get(key);
  if (sp) return sp;
  const pad = Math.ceil(blur * 1.6 + Math.abs(offY));
  const cv = createCanvas(Math.ceil(w + pad * 2), Math.ceil(h + pad * 2));
  const c = cv.getContext("2d");
  const far = 10000;
  c.shadowColor = `rgba(0,0,0,${alpha})`;
  c.shadowBlur = blur;
  c.shadowOffsetX = far;
  c.shadowOffsetY = offY;
  rr(c, pad + inset - far, pad + inset, w - inset * 2, h - inset * 2, Math.max(2, r - inset));
  c.fillStyle = "#000";
  c.fill();
  sp = { canvas: cv, pad, w, h };
  shadowCache.set(key, sp);
  return sp;
}
function drawShadow(ctx, sp, cx, cy, W, H, alpha = 1) {
  if (alpha <= 0.002) return;
  const kx = W / sp.w;
  const ky = H / sp.h;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(sp.canvas, cx - (sp.w / 2 + sp.pad) * kx, cy - (sp.h / 2 + sp.pad) * ky, sp.canvas.width * kx, sp.canvas.height * ky);
  ctx.restore();
}
const SH = {
  // Las dos sombras de la tarjeta blanca de S5 (0 2 6 .06 y 0 30 60 -25 .28).
  panelNear: () => shadowSprite("panelNear", 520, 640, 28, 6, 2, 0.06),
  panelFar: () => shadowSprite("panelFar", 520, 640, 28, 60, 30, 0.28, 25),
  icon: () => shadowSprite("icon", 84, 84, 22, 14, 5, 0.5),
  base: () => shadowSprite("base", 400, 110, 24, 18, 6, 0.35),
  hero: () => shadowSprite("hero", 1000, 330, 44, 80, 40, 0.55, 20),
};

// ─── T13': el panel se vuelve el ícono ───────────────────────────────────────
const APP3 = toWorld(APP.x, APP.y);
const PANEL_C = [PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2];

// Contenido del panel como textura: la tercera tarjeta de S5 todavía se abre
// hasta ~f288, así que se re-dibuja cada 0,25 f (4 veces por frame en vez de
// 16) y desde ahí queda fija. Redibujar el texto del panel en cada sub-frame
// costaba ~20 ms.
const PANEL_TS = 1.5;
const panelCache = new Map();
function panelTex(t) {
  const tq = t >= 288 ? 288 : Math.round(t * 4) / 4;
  let cv = panelCache.get(tq);
  if (cv) return cv;
  if (panelCache.size > 6) panelCache.delete(panelCache.keys().next().value);
  cv = createCanvas(Math.ceil(PANEL.w * PANEL_TS), Math.ceil(PANEL.h * PANEL_TS));
  const c = cv.getContext("2d");
  c.scale(PANEL_TS, PANEL_TS);
  panelLocal(c, tq);
  panelCache.set(tq, cv);
  return cv;
}

function drawFlyer(ctx, t) {
  const u = EASE.whip(prog(t, START, 290));
  // Arco suave: el panel sube hacia el ícono con una panza hacia la derecha.
  const dx = APP3[0] - PANEL_C[0];
  const dy = APP3[1] - PANEL_C[1];
  const len = Math.hypot(dx, dy);
  const bulge = 38 * Math.sin(Math.PI * u);
  const x = lerp(PANEL_C[0], APP3[0], u) + (-dy / len) * -bulge;
  const y = lerp(PANEL_C[1], APP3[1], u) + (dx / len) * -bulge;
  const z = lerp(0, APP3[2], u);
  const w = lerpLog(PANEL.w, APP.s, u);
  const h = lerpLog(PANEL.h, APP.s, u);
  const r = lerpLog(PANEL.r, APP.r, u);
  const rx = PH.rx * u;
  const ry = PH.ry * u;
  const logo = EASE.swell(prog(t, 284, 288));

  const { o, bw, bh } = bucketTex("fly", w, 1.25, null);
  const c = o.ctx;
  c.scale(bw / w, bh / h);
  c.save();
  rr(c, 0, 0, w, h, r);
  c.clip();
  if (logo < 1) {
    c.save();
    c.imageSmoothingQuality = "high";
    c.drawImage(panelTex(t), 0, 0, w, h);
    c.restore();
  }
  if (logo > 0) {
    c.save();
    c.globalAlpha = logo;
    c.fillStyle = C.paper;
    c.fillRect(0, 0, w, h);
    drawMark(c, w / 2, h / 2, Math.min(w, h) * 0.625);
    c.restore();
  }
  c.restore();
  // Filo de la tarjeta blanca (se apaga al volverse ícono).
  if (logo < 1) {
    c.save();
    c.globalAlpha = 1 - logo;
    c.lineWidth = 1.5 * (PANEL.w / w) ** 0.3;
    c.strokeStyle = C.border;
    rr(c, 0.75, 0.75, w - 1.5, h - 1.5, r - 0.75);
    c.stroke();
    c.restore();
  }

  const [sx, sy, ss] = toScreen([x, y, z]);
  drawShadow(ctx, SH.panelNear(), sx, sy, w * ss, h * ss, 1 - u);
  drawShadow(ctx, SH.panelFar(), sx, sy, w * ss, h * ss, 1 - u);
  drawShadow(ctx, SH.icon(), sx, sy, w * ss, h * ss, u);
  ctx.save();
  ctx.translate(CAM.x, CAM.y);
  ctx.imageSmoothingQuality = "high";
  card3d(ctx, CAM, o.canvas, { x, y, z, w, h, rx, ry, n: 3, shade: 0 });
  ctx.restore();
}

// ─── TL: el aviso se despega y se vuelve el hero ─────────────────────────────
const SLOT3 = toWorld(SLOT.x + SLOT.w / 2, SLOT.y + SLOT.h / 2);
const HERO_C = [HERO.x + HERO.w / 2, HERO.y + HERO.h / 2];

function liftGeom(t) {
  const p = liftP(t);
  const q = clamp(p, 0, 1);
  const S = liftS(t);
  // El aplastamiento del contacto (K4) es del teléfono: se relaja a medida que
  // la tarjeta se despega.
  const sq = dropK4(t) ?? { sx: 1, sy: 1 };
  const keep = 1 - q * q;
  const w0 = lerp(BASE.w, HERO.w, p) * S;
  const h0 = lerp(BASE.h, HERO.h, p) * S;
  return {
    p,
    q,
    x: lerp(SLOT3[0], HERO_C[0], p),
    y: lerp(SLOT3[1], HERO_C[1], p),
    z: lerp(SLOT3[2], 0, q) - 110 * Math.sin(Math.PI * q),
    w0,
    h0,
    sx: 1 + (sq.sx - 1) * keep,
    sy: 1 + (sq.sy - 1) * keep,
    r: lerp(BASE.r, HERO.r, q),
    rx: PH.rx * (1 - q),
    ry: PH.ry * (1 - q),
  };
}

// Contenido del aviso en unidades de tarjeta (w0 x h0): fondo, base que se
// funde y hero que carga la tinta.
function drawNotifCard(c, t, g, { withPeriod }) {
  const out = EASE.swell(prog(t, 293.5, 295.25));
  const swap = EASE.swell(prog(t, 294.5, 296));
  const ink = prog(t, 294.5, 297.5);
  c.save();
  rr(c, 0, 0, g.w0, g.h0, g.r);
  c.clip();
  cardBg(c, g.w0, g.h0, g.r);
  if (out < 1) {
    c.save();
    const s = g.w0 / BASE.w;
    c.scale(s, s);
    drawBaseContent(c, { alpha: 1 - out });
    c.restore();
  }
  if (swap > 0) {
    c.save();
    const s = g.w0 / HERO.w;
    c.scale(s, s);
    drawHeroContent(c, t, { alpha: swap, ink, withPeriod });
    c.restore();
  }
  c.restore();
}

// Sombra del aviso: de la chica de la base (18/6/.35) a la del hero
// (0 40 80 -20 rgba(0,0,0,.55)), cruzadas por q. cx, cy, W, H en pantalla.
function notifShadow(ctx, cx, cy, W, H, q) {
  drawShadow(ctx, SH.base(), cx, cy, W, H, 1 - q);
  drawShadow(ctx, SH.hero(), cx, cy, W, H, q);
}

// Mapea un punto del hero (coordenadas locales 1000 x 330) a pantalla en el
// modo plano (p >= 1).
function heroToScreen(g, lx, ly) {
  const W = g.w0 * g.sx;
  const H = g.h0 * g.sy;
  return [g.x - W / 2 + lx * (g.w0 / HERO.w) * g.sx, g.y - H / 2 + ly * (g.w0 / HERO.w) * g.sy];
}

function drawLifting(ctx, t, g) {
  const W = g.w0 * g.sx;
  const H = g.h0 * g.sy;
  if (g.p < 1) {
    // Warp proyectivo que se relaja: rotateY -14° → 0 mientras sale del plano.
    const { o, bw, bh } = bucketTex("notif", g.w0, 0.36, null);
    const c = o.ctx;
    c.scale(bw / g.w0, bh / g.h0);
    drawNotifCard(c, t, g, { withPeriod: true });
    const [sx, sy, ss] = toScreen([g.x, g.y, g.z]);
    notifShadow(ctx, sx, sy, W * ss, H * ss, g.q);
    ctx.save();
    ctx.translate(CAM.x, CAM.y);
    ctx.imageSmoothingQuality = "high";
    card3d(ctx, CAM, o.canvas, { x: g.x, y: g.y, z: g.z, w: W, h: H, rx: g.rx, ry: g.ry, n: 4, shade: 0 });
    ctx.restore();
    return;
  }
  // Plano: la tarjeta ya mira a cámara; se dibuja vectorial, nítida.
  notifShadow(ctx, g.x, g.y, W, H, 1);
  ctx.save();
  ctx.translate(g.x - W / 2, g.y - H / 2);
  ctx.scale(g.sx, g.sy);
  drawNotifCard(ctx, t, g, { withPeriod: false });
  drawGlint(ctx, t, g);
  ctx.restore();
}

// Brillo especular diagonal (f308, banda de 120 px, blanco 35 %, 8 f). Con
// glide cruzaba el 80 % de la tarjeta en 2 f y no se leía: va con swell. Sobre
// una tarjeta casi blanca la banda solo se ve en lo oscuro (texto, ícono), así
// que además el filo de la tarjeta "agarra" la luz donde pasa la banda.
function drawGlint(ctx, t, g) {
  if (t < 308 || t > 316) return;
  const k = EASE.swell(prog(t, 308, 316));
  const s = g.w0 / HERO.w;
  const bx = lerp(-200, HERO.w + 200, k);
  const ax = 0.94;
  const ay = 0.34;
  const band = (half, peak) => {
    const gr = ctx.createLinearGradient(bx - half * ax, 165 - half * ay, bx + half * ax, 165 + half * ay);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.5, `rgba(255,255,255,${peak})`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    return gr;
  };
  const fade = Math.sin(Math.PI * clamp((t - 308) / 8));
  ctx.save();
  ctx.scale(s, s);
  rr(ctx, 0, 0, HERO.w, HERO.h, HERO.r);
  ctx.save();
  ctx.clip();
  // Reflejo de laminado: bordes apenas oscuros alrededor del núcleo blanco al
  // 35 %, así la pasada se lee también sobre el papel y no solo sobre el texto.
  const half = 150;
  const sheen = ctx.createLinearGradient(bx - half * ax, 165 - half * ay, bx + half * ax, 165 + half * ay);
  sheen.addColorStop(0, "rgba(60,40,30,0)");
  sheen.addColorStop(0.3, `rgba(60,40,30,${0.07 * fade})`);
  sheen.addColorStop(0.44, `rgba(255,255,255,${0.2 * fade})`);
  sheen.addColorStop(0.5, `rgba(255,255,255,${0.35 * fade})`);
  sheen.addColorStop(0.56, `rgba(255,255,255,${0.2 * fade})`);
  sheen.addColorStop(0.7, `rgba(60,40,30,${0.05 * fade})`);
  sheen.addColorStop(1, "rgba(60,40,30,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, HERO.w, HERO.h);
  ctx.restore();
  // Filo que se enciende al paso de la banda; en Noche florece por la capa
  // emisiva (dos destellos que corren por el borde de arriba y el de abajo).
  const rim = (c, a, lw) => {
    c.lineWidth = lw;
    c.strokeStyle = band(130, a * fade);
    rr(c, 1.5, 1.5, HERO.w - 3, HERO.h - 3, HERO.r - 1.5);
    c.stroke();
  };
  rim(ctx, 1, 3);
  emit(ctx, (e) => rim(e, 0.9, 5));
  ctx.restore();
}

// Hero en reposo como bitmap (para la recesión bajo el iris), con niveles de
// desenfoque cacheados (0, 4, 9, 14 px) que se mezclan entre vecinos.
let heroCache = null;
function heroBitmap() {
  if (heroCache) return heroCache;
  const pad = 160;
  const cv = createCanvas(HERO.w + pad * 2, HERO.h + pad * 2);
  const c = cv.getContext("2d");
  c.translate(pad, pad);
  const g = { w0: HERO.w, h0: HERO.h, r: HERO.r, sx: 1, sy: 1 };
  drawShadow(c, SH.hero(), HERO.w / 2, HERO.h / 2, HERO.w, HERO.h, 1);
  drawNotifCard(c, 400, g, { withPeriod: false });
  heroCache = { canvas: cv, x: HERO.x - pad, y: HERO.y - pad };
  return heroCache;
}
const HERO_LEVELS = [0, 4, 9, 14];
const heroBlur = new Map();
function heroLevel(i) {
  const b = HERO_LEVELS[i];
  const src = heroBitmap().canvas;
  if (b === 0) return src;
  let cv = heroBlur.get(b);
  if (cv) return cv;
  cv = createCanvas(src.width, src.height);
  const c = cv.getContext("2d");
  c.filter = `blur(${b}px)`;
  c.drawImage(src, 0, 0);
  heroBlur.set(b, cv);
  return cv;
}

// La tarjeta se va hacia atrás (z → +900, accel) y se desenfoca (hasta 14 px).
function drawHeroReceding(ctx, t) {
  const hb = heroBitmap();
  const s = S_OF(900 * recede(t));
  const b = 14 * defocus(t);
  let i = 0;
  while (i < HERO_LEVELS.length - 2 && b > HERO_LEVELS[i + 1]) i++;
  const f = clamp((b - HERO_LEVELS[i]) / (HERO_LEVELS[i + 1] - HERO_LEVELS[i]));
  ctx.save();
  ctx.translate(960, 540);
  ctx.scale(s, s);
  ctx.translate(-960, -540);
  ctx.drawImage(heroLevel(i), hb.x, hb.y);
  if (f > 0.01) {
    ctx.globalAlpha *= f;
    ctx.drawImage(heroLevel(i + 1), hb.x, hb.y);
  }
  ctx.restore();
}

// ─── el punto ────────────────────────────────────────────────────────────────
function pulse336(t) {
  if (t < 336) return 1;
  if (t < 338) return lerp(1, 1.18, (t - 336) / 2);
  return lerp(1.18, 1, spr(t, 338, SPR.snap));
}

// Estado del punto desde que el hero queda plano. {x, y, d, glow}
function dotAt(t, g) {
  if (t < FLIGHT.t0) {
    const [x, y] = heroToScreen(g, PERIOD.x, PERIOD.y);
    const a = EASE.swell(prog(t, 349, 351));
    const s = (g.w0 / HERO.w) * pulse336(t) * (1 + 0.08 * a);
    return { x, y: y - 4 * a, d: PERIOD.d * s, glow: 0, alpha: EASE.swell(prog(t, 294, 296)) };
  }
  const f = flightPos(t);
  const d = lerp(PERIOD.d * 1.08, contract.dot.d, f.k);
  return { x: f.x, y: f.y, d, glow: prog(t, FLIGHT.t0, FLIGHT.t0 + 2) };
}

// flightV de shared/punto.js con su tabla de 200 muestras da en f358 la
// dirección de la cuerda del último tramo (1° corrida en esta curva, que cierra
// fuerte al final). El último 0,6 f es una Hermite en posición entre el estado
// del vuelo y el contrato exacto (P3, v = (-12.13, 7.00)): C1 y exacto en 358.
const PATCH = 0.6;
function flightPos(t) {
  const TA = FLIGHT.t1 - PATCH;
  if (t <= TA) return flightV(t, FLIGHT);
  const a = flightV(TA, FLIGHT);
  const a0 = flightV(TA - 0.01, FLIGHT);
  const vA = [(a.x - a0.x) / 0.01, (a.y - a0.y) / 0.01];
  const u = clamp((t - TA) / PATCH);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return {
    x: h00 * a.x + h10 * PATCH * vA[0] + h01 * P3[0] + h11 * PATCH * V_END[0],
    y: h00 * a.y + h10 * PATCH * vA[1] + h01 * P3[1] + h11 * PATCH * V_END[1],
    k: lerp(a.k, 1, u),
  };
}

function drawTheDot(ctx, p) {
  ctx.save();
  ctx.globalAlpha *= p.alpha ?? 1;
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.d / 2, 0, TAU);
  ctx.fill();
  if (p.glow > 0) {
    // Misma emisión que la punta de la placa (5.4): continuidad en f358.
    emit(ctx, (e) => {
      e.fillStyle = `rgba(251,146,60,${0.9 * p.glow})`;
      e.beginPath();
      e.arc(p.x, p.y, p.d * 0.9, 0, TAU);
      e.fill();
    });
  }
  ctx.restore();
}

// ─── dibujo ──────────────────────────────────────────────────────────────────
// Ancho del borde suave de un disco que crece rápido: lo que avanza el radio
// entre dos sub-frames del obturador. Sin esto, 16 muestras de un radio que se
// multiplica x100 en pocos frames se ven como anillos escalonados.
function featherOf(R, t, shutter, samples) {
  const dr = Math.abs(R(t) - R(t - 0.05)) / 0.05;
  return clamp((dr * shutter * 1.4) / samples, 2, 600);
}

// Disco de color con borde suave (el campo que se derrama o el iris).
function softDiscFill(ctx, cx, cy, r, fw, rgb) {
  const r0 = Math.max(0, r - fw / 2);
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r + fw / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-4000, -4000, 12000, 12000);
}

function clipDisc(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, TAU);
  ctx.clip();
}

function draw(ctx, t) {
  if (t < START) return;
  if (t < 303) env.shared.spill = spillAt(t);

  const cam = worldCam(t);
  const sr = spillR(t);
  const spilling = t < SPILL.t1 && sr < farCorner(SPILL.cx, SPILL.cy) + 200;
  const g = t >= CONTACT ? liftGeom(t) : null;
  const dot = g && g.p >= 1 ? dotAt(t, g) : null;

  // Iris de papel (353-358): cuando cubre todo, solo queda el punto.
  const ir = irisR(t);
  const irFw = ir > 0 ? featherOf(irisR, t, 0.75, 16) : 0;
  if (dot && ir > 0 && ir - irFw / 2 >= farCorner(dot.x, dot.y)) {
    ctx.fillStyle = C.surface;
    ctx.fillRect(-4000, -4000, 12000, 12000);
    drawTheDot(ctx, dot);
    return;
  }

  // Campo de noche que se derrama desde el teléfono (sobre el mundo de S5).
  if (sr > 0) {
    const fw = spilling ? featherOf(spillR, t, 1, 16) : 0;
    if (spilling) softDiscFill(ctx, SPILL.cx, SPILL.cy, sr, fw, "28,25,23");
    else {
      ctx.fillStyle = NOCHE;
      ctx.fillRect(-4000, -4000, 12000, 12000);
    }
    ctx.save();
    if (spilling) clipDisc(ctx, SPILL.cx, SPILL.cy, sr - fw * 0.25);
    drawBokeh(ctx, t, cam);
    drawGrid(ctx, cam);
    drawPhoneLayer(ctx, t, cam);
    ctx.restore();
    if (spilling) spillLip(ctx, t, sr);
  } else if (t >= 281) {
    // Antes del derrame la pantalla ya se descubre debajo del panel.
    drawPhoneLayer(ctx, t, cam);
  }

  // El panel que se vuelve ícono (arriba del mundo de S5 y del derrame).
  if (t < 290) layer(ctx, cam, 0, () => drawFlyer(ctx, t));

  // El aviso despegado / hero (se va hacia atrás desde L).
  if (g) {
    if (t > L) drawHeroReceding(ctx, t);
    else drawLifting(ctx, t, g);
  }

  if (sr > 0) {
    ctx.save();
    if (spilling) clipDisc(ctx, SPILL.cx, SPILL.cy, sr);
    drawMotes(ctx, t, cam);
    ctx.restore();
  }

  // Iris, anillo del punto (beat 24) y el punto.
  if (dot) {
    if (ir > 0) softDiscFill(ctx, dot.x, dot.y, ir, irFw, "250,246,239");
    ring(ctx, t, 322, dot.x, dot.y, PERIOD.d, C.accent);
    drawTheDot(ctx, dot);
  }
}

// Borde del derrame: un filo ámbar tenue que avanza (emisivo).
function spillLip(ctx, t, r) {
  const k = prog(t, SPILL.t0, SPILL.t1);
  const a = 1 - k;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(251,146,60,${0.3 * a})`;
  ctx.beginPath();
  ctx.arc(SPILL.cx, SPILL.cy, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
  emit(ctx, (e) => {
    e.lineWidth = 6;
    e.strokeStyle = `rgba(251,146,60,${0.7 * a})`;
    e.beginPath();
    e.arc(SPILL.cx, SPILL.cy, r, 0, TAU);
    e.stroke();
  });
}

// Teléfono (formación, reposo, desenfoque de foco y recesión), su halo de luz
// de pantalla y el badge.
function drawPhoneLayer(ctx, t, cam) {
  const rc = recede(t);
  const sR = S_OF(900 * rc);
  layer(ctx, cam, 0, (c) => {
    c.save();
    if (rc > 0) {
      c.translate(960, 540);
      c.scale(sR, sR);
      c.translate(-960, -540);
    }
    // La pantalla encendida tiñe la noche alrededor (#7c2d12, muy tenue).
    const halo = 0.16 * prog(t, 283, 292) * (1 - 0.6 * defocus(t));
    if (halo > 0.002) {
      const hg = c.createRadialGradient(PH.cx, PH.cy, 60, PH.cx, PH.cy, 860);
      hg.addColorStop(0, `rgba(124,45,18,${halo})`);
      hg.addColorStop(0.45, `rgba(124,45,18,${halo * 0.45})`);
      hg.addColorStop(1, "rgba(124,45,18,0)");
      c.fillStyle = hg;
      c.fillRect(PH.cx - 860, PH.cy - 860, 1720, 1720);
    }
    const bz = buzz(t);
    if (t < SPILL.t1) {
      const st = {
        reveal: t < 281 ? 0 : t >= 291 ? Infinity : lerpLog(20, 800, EASE.glide(prog(t, 281, 291))),
        bezel: EASE.pen(prog(t, 283, 291)),
        body: EASE.swell(prog(t, 289, 292)),
        app: t >= 290 ? 1 : 0,
        label: prog(t, 289, 292),
        notif: t >= DROP0 && t < CONTACT ? dropK4(t) : null,
      };
      drawPhoneForming(c, t, st, bz);
    } else {
      const k = rack(t);
      drawPhoneAtRest(c, { blur: lerp(6 * k, 14, defocus(t)), alpha: 1 - 0.2 * k, dx: bz });
      drawBadge(c, t, k);
    }
    c.restore();
  });
}

// Badge de acento (K3) sobre el ícono desenfocado, en el downbeat f336.
function drawBadge(ctx, t, rackK) {
  if (t < 336) return;
  const sc = spr(t, 336, SPR.snap);
  const a = prog(t, 336, 338) * (1 - 0.5 * defocus(t));
  const [bx, by] = toScreen(toWorld(BADGE.x, BADGE.y));
  // Un poco fuera de foco, como el ícono (sprite pre-desenfocado: un
  // ctx.filter por sub-frame costaba ~27 ms).
  const sp = softDisc(BADGE.d, 2.2, C.accent);
  const sz = sp.size * sc;
  ctx.save();
  ctx.globalAlpha *= a * lerp(1, 0.85, rackK);
  if (sz > 0.01) ctx.drawImage(sp.canvas, bx - sz / 2, by - sz / 2, sz, sz);
  ctx.restore();
  ring(ctx, t, 336, bx, by, BADGE.d, "#fb923c");
  emit(ctx, (e) => {
    e.fillStyle = `rgba(251,146,60,${0.85 * a})`;
    e.beginPath();
    e.arc(bx, by, (BADGE.d / 2) * sc * 1.1, 0, TAU);
    e.fill();
  });
}

// ─── interfaz de escena ──────────────────────────────────────────────────────
function motion(t) {
  // Despegue: el aviso pasa por ~340 px/f (brake). Con 16 muestras el texto se
  // veía en copias separadas; con 32 la estela es continua. El derrame ya
  // cubrió todo en ~f288, así que acá alcanza con 270°.
  if (t > CONTACT && t <= 293.5) return { shutter: 0.75, samples: 32 };
  if (t <= SPILL.t1) return { shutter: 1, samples: 16 }; // campo que se derrama, T13'
  if (t <= 297) return { shutter: 0.75, samples: 16 }; // TL: contacto y despegue rápido
  if (t <= 301) return { shutter: 0.75, samples: 12 }; // TL: asentado
  if (t < FLIGHT.t0) return { shutter: 0.5, samples: 8 }; // lectura
  return { shutter: 0.75, samples: 16 }; // T15 + iris (igual que la placa)
}

function field(t) {
  if (t < SPILL.t0) return { crema: 1 };
  if (t < SPILL.t1) {
    const c = coverage(SPILL.cx, SPILL.cy, spillR(t));
    return { crema: 1 - c, noche: c };
  }
  if (t < L) return { noche: 1 };
  const g = liftGeom(t);
  const d = dotAt(t, g);
  const c = coverage(d.x, d.y, irisR(t));
  return { noche: 1 - c, papel: c };
}

const scene = {
  id: "s6",
  start: START,
  end: END,
  draw,
  motion,
  field,
  spill: spillAt,
  phrases: [{ id: "aviso", words: 6, R, L }],
  hits: [
    { f: 280, level: "H1", kind: "panel-to-icon, punch 3" },
    { f: 290.5, level: "H3", kind: "push contact" },
    { f: 294, level: "H2", kind: "notification lift" },
    { f: 308, level: "H2", kind: "glint" },
    { f: 322, level: "H2", kind: "period ring" },
    { f: 336, level: "H1", kind: "badge" },
    { f: 350, level: "H2", kind: "period anticipation" },
  ],
};
export default scene;

// Para verificación (harness): geometría del aviso y del punto.
export const _debug = { liftGeom, dotAt, liftP, spillR, irisR, FLIGHT };
