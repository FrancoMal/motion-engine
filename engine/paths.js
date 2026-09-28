// Paths SVG a mano: parser, aplanado a polilíneas, largo, trim, remuestreo y
// morph. Es lo que permite que un trazo se dibuje de 0 a 1, que los puntos
// viajen por una curva y que una forma se convierta en otra.

import { clamp, lerp } from "./math.js";

// ─── parser ──────────────────────────────────────────────────────────────────

const CMD = /[MmLlHhVvCcSsQqTtAaZz]/;
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) out.push(m[1] ? m[1] : parseFloat(m[2]));
  return out;
}

// Devuelve comandos absolutos: {c: 'M'|'L'|'C'|'Q'|'A'|'Z', v: [...]}.
export function parsePath(d) {
  const tk = tokenize(d);
  const cmds = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl = null;
  let lastCmd = "";
  let cmd = "";
  while (i < tk.length) {
    if (typeof tk[i] === "string" && CMD.test(tk[i])) cmd = tk[i++];
    else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const n = ARGC[up];
    const a = tk.slice(i, i + n);
    i += n;
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (up) {
      case "M":
        cx = a[0] + ox;
        cy = a[1] + oy;
        sx = cx;
        sy = cy;
        cmds.push({ c: "M", v: [cx, cy] });
        lastCtrl = null;
        break;
      case "L":
        cx = a[0] + ox;
        cy = a[1] + oy;
        cmds.push({ c: "L", v: [cx, cy] });
        lastCtrl = null;
        break;
      case "H":
        cx = a[0] + (rel ? cx : 0);
        cmds.push({ c: "L", v: [cx, cy] });
        lastCtrl = null;
        break;
      case "V":
        cy = a[0] + (rel ? cy : 0);
        cmds.push({ c: "L", v: [cx, cy] });
        lastCtrl = null;
        break;
      case "C": {
        const v = [a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy];
        cmds.push({ c: "C", v });
        lastCtrl = [v[2], v[3]];
        cx = v[4];
        cy = v[5];
        break;
      }
      case "S": {
        const r = lastCmd === "C" || lastCmd === "S" ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
        const v = [r[0], r[1], a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy];
        cmds.push({ c: "C", v });
        lastCtrl = [v[2], v[3]];
        cx = v[4];
        cy = v[5];
        break;
      }
      case "Q": {
        const v = [a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy];
        cmds.push({ c: "Q", v });
        lastCtrl = [v[0], v[1]];
        cx = v[2];
        cy = v[3];
        break;
      }
      case "T": {
        const r = lastCmd === "Q" || lastCmd === "T" ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
        const v = [r[0], r[1], a[0] + ox, a[1] + oy];
        cmds.push({ c: "Q", v });
        lastCtrl = r;
        cx = v[2];
        cy = v[3];
        break;
      }
      case "A": {
        const v = [a[0], a[1], a[2], a[3], a[4], a[5] + ox, a[6] + oy];
        cmds.push({ c: "A", v, from: [cx, cy] });
        cx = v[5];
        cy = v[6];
        lastCtrl = null;
        break;
      }
      case "Z":
        cmds.push({ c: "Z", v: [sx, sy] });
        cx = sx;
        cy = sy;
        lastCtrl = null;
        break;
    }
    lastCmd = up;
  }
  return cmds;
}

// ─── aplanado ────────────────────────────────────────────────────────────────

// Arco SVG (parametrización por extremos) → centro, radios y ángulos.
// Implementación de la nota F.6.5 de la spec de SVG.
function arcToCenter(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= Math.PI * 2;
  else if (fs && dth < 0) dth += Math.PI * 2;
  return { cx, cy, rx, ry, phi, th1, dth };
}

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// density = segmentos por unidad de largo del path (en sus propias unidades).
// Para un logo de viewBox 64 dibujado a 800 px, density ~ 800/64/2 = 6.
export function flatten(d, density = 1) {
  const cmds = typeof d === "string" ? parsePath(d) : d;
  const subs = [];
  let cur = null;
  let p = [0, 0];
  const push = (q) => cur.points.push(q);
  for (const cm of cmds) {
    if (cm.c === "M") {
      cur = { points: [[cm.v[0], cm.v[1]]], closed: false };
      subs.push(cur);
      p = [cm.v[0], cm.v[1]];
      continue;
    }
    if (!cur) {
      cur = { points: [p.slice()], closed: false };
      subs.push(cur);
    }
    if (cm.c === "L" || cm.c === "Z") {
      push([cm.v[0], cm.v[1]]);
      if (cm.c === "Z") cur.closed = true;
      p = [cm.v[0], cm.v[1]];
    } else if (cm.c === "C") {
      const [x1, y1, x2, y2, x3, y3] = cm.v;
      const est = dist(p, [x1, y1]) + dist([x1, y1], [x2, y2]) + dist([x2, y2], [x3, y3]);
      const n = Math.max(8, Math.ceil(est * density));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const mt = 1 - t;
        push([
          mt * mt * mt * p[0] + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
          mt * mt * mt * p[1] + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
        ]);
      }
      p = [x3, y3];
    } else if (cm.c === "Q") {
      const [x1, y1, x2, y2] = cm.v;
      const est = dist(p, [x1, y1]) + dist([x1, y1], [x2, y2]);
      const n = Math.max(8, Math.ceil(est * density));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const mt = 1 - t;
        push([mt * mt * p[0] + 2 * mt * t * x1 + t * t * x2, mt * mt * p[1] + 2 * mt * t * y1 + t * t * y2]);
      }
      p = [x2, y2];
    } else if (cm.c === "A") {
      const [rx, ry, rot, fa, fs, x, y] = cm.v;
      const a = arcToCenter(p[0], p[1], rx, ry, rot, fa, fs, x, y);
      const est = Math.abs(a.dth) * Math.max(a.rx, a.ry);
      const n = Math.max(12, Math.ceil(est * density));
      const cos = Math.cos(a.phi);
      const sin = Math.sin(a.phi);
      for (let k = 1; k <= n; k++) {
        const th = a.th1 + (a.dth * k) / n;
        const ex = a.rx * Math.cos(th);
        const ey = a.ry * Math.sin(th);
        push([a.cx + cos * ex - sin * ey, a.cy + sin * ex + cos * ey]);
      }
      p = [x, y];
    }
  }
  return measure(subs);
}

// Agrega largos acumulados a cada sub-path.
export function measure(subs) {
  let total = 0;
  for (const s of subs) {
    const cum = [0];
    for (let i = 1; i < s.points.length; i++) cum.push(cum[i - 1] + dist(s.points[i - 1], s.points[i]));
    s.cum = cum;
    s.length = cum[cum.length - 1];
    s.offset = total;
    total += s.length;
  }
  return { subs, length: total };
}

// Polilínea suelta → forma medida.
export function polyline(points, closed = false) {
  return measure([{ points, closed }]);
}

// ─── consultas ───────────────────────────────────────────────────────────────

function locate(sub, s) {
  const cum = sub.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  return { i: lo, f: (s - cum[lo]) / seg };
}

// Punto y ángulo de la tangente a distancia s (en unidades del path).
export function pointAt(shape, s) {
  s = clamp(s, 0, shape.length);
  for (const sub of shape.subs) {
    if (s <= sub.offset + sub.length || sub === shape.subs[shape.subs.length - 1]) {
      const local = clamp(s - sub.offset, 0, sub.length);
      const { i, f } = locate(sub, local);
      const a = sub.points[i];
      const b = sub.points[Math.min(i + 1, sub.points.length - 1)];
      return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
  }
  return { x: 0, y: 0, angle: 0 };
}

// Traza en ctx (moveTo/lineTo) solo la porción [a, b] del largo total, con a y
// b como fracciones 0..1. No hace stroke: lo decide quien llama.
export function tracePortion(ctx, shape, a, b) {
  const s0 = clamp(a, 0, 1) * shape.length;
  const s1 = clamp(b, 0, 1) * shape.length;
  if (s1 <= s0) return false;
  let drew = false;
  for (const sub of shape.subs) {
    const lo = Math.max(s0, sub.offset);
    const hi = Math.min(s1, sub.offset + sub.length);
    if (hi <= lo) continue;
    const l0 = lo - sub.offset;
    const l1 = hi - sub.offset;
    const A = locate(sub, l0);
    const B = locate(sub, l1);
    const P = sub.points;
    const pa = P[A.i];
    const pa2 = P[Math.min(A.i + 1, P.length - 1)];
    ctx.moveTo(lerp(pa[0], pa2[0], A.f), lerp(pa[1], pa2[1], A.f));
    for (let k = A.i + 1; k <= B.i; k++) ctx.lineTo(P[k][0], P[k][1]);
    const pb = P[B.i];
    const pb2 = P[Math.min(B.i + 1, P.length - 1)];
    ctx.lineTo(lerp(pb[0], pb2[0], B.f), lerp(pb[1], pb2[1], B.f));
    if (sub.closed && l0 <= 0.001 && l1 >= sub.length - 0.001) ctx.closePath();
    drew = true;
  }
  return drew;
}

// Traza la forma completa.
export function trace(ctx, shape) {
  for (const sub of shape.subs) {
    const P = sub.points;
    ctx.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
    if (sub.closed) ctx.closePath();
  }
}

// Puntos equiespaciados a lo largo de la forma: el tramo punteado del logo, las
// "observaciones" que viajan por una curva.
export function dotsAlong(shape, spacing, phase = 0, from = 0, to = 1) {
  const out = [];
  const s0 = from * shape.length;
  const s1 = to * shape.length;
  for (let s = s0 + (((phase % spacing) + spacing) % spacing); s <= s1 + 1e-6; s += spacing) out.push(pointAt(shape, s));
  return out;
}

// ─── remuestreo y morph ──────────────────────────────────────────────────────

// n puntos equiespaciados por largo sobre toda la forma.
export function resample(shape, n) {
  const out = [];
  const L = shape.length;
  for (let k = 0; k < n; k++) {
    const p = pointAt(shape, (L * k) / (n - 1));
    out.push([p.x, p.y]);
  }
  return out;
}

// Interpola dos listas de puntos del mismo largo.
export function morphPoints(a, b, t) {
  return a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
}

// Traza una lista de puntos como polilínea (abierta o cerrada).
export function tracePoints(ctx, pts, closed = false) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  if (closed) ctx.closePath();
}

// Cache de formas aplanadas: los paths de íconos y del logo se reusan en cada
// sub-frame.
const cache = new Map();
export function shapeOf(d, density = 1) {
  const key = density + "|" + d;
  let s = cache.get(key);
  if (!s) {
    s = flatten(d, density);
    cache.set(key, s);
  }
  return s;
}
