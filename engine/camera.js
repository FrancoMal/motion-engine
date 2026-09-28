// Cámara 2.5D con proyección en perspectiva, escrita a mano.
//
// Convención del mundo: x a la derecha, y hacia abajo, z hacia adentro de la
// pantalla (profundidad). Con la cámara en reposo (x = y = z = 0) el plano
// z = 0 se ve 1:1 en píxeles y alineado con la pantalla: el punto (960, 540)
// del mundo cae en el centro. Así una escena plana se diseña en coordenadas de
// pantalla y después se le da profundidad sin recalcular nada. cam.x y cam.y
// son el desplazamiento de la cámara respecto de ese reposo.
//
// Un punto a profundidad z se ve con escala s = F / (F + z - cam.z). El
// paralaje sale solo: si la cámara se desplaza, lo cercano (s grande) se mueve
// más que lo lejano (s chica).

import { createCanvas } from "@napi-rs/canvas";

export const W = 1920;
export const H = 1080;

export function camera(over = {}) {
  return { x: 0, y: 0, z: 0, F: 1500, zoom: 1, roll: 0, ...over };
}

// Escala de perspectiva para una capa a profundidad z. Devuelve 0 si la capa
// quedó detrás de la cámara (o demasiado cerca para ser legible).
export function depthScale(cam, z) {
  const dz = cam.F + z - cam.z;
  if (dz <= cam.F * 0.04) return 0;
  return cam.F / dz;
}

// Proyecta un punto del mundo a pantalla.
export function project(cam, x, y, z) {
  const s = depthScale(cam, z);
  if (!s) return null;
  let px = (x - cam.x - W / 2) * s * cam.zoom;
  let py = (y - cam.y - H / 2) * s * cam.zoom;
  if (cam.roll) {
    const c = Math.cos(cam.roll);
    const n = Math.sin(cam.roll);
    [px, py] = [px * c - py * n, px * n + py * c];
  }
  return { x: W / 2 + px, y: H / 2 + py, s: s * cam.zoom };
}

// Dibuja una capa plana paralela a la pantalla a profundidad z. Adentro de fn se
// dibuja en coordenadas de mundo (las mismas que pantalla con la cámara en
// reposo). fn recibe la escala efectiva, útil para decidir grosores o blur.
export function layer(ctx, cam, z, fn) {
  const s = depthScale(cam, z);
  if (!s) return;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (cam.roll) ctx.rotate(cam.roll);
  ctx.scale(s * cam.zoom, s * cam.zoom);
  ctx.translate(-cam.x - W / 2, -cam.y - H / 2);
  fn(ctx, s * cam.zoom);
  ctx.restore();
}

// ─── pool de canvases fuera de pantalla ──────────────────────────────────────
// Cada worker renderiza un frame por vez, así que alcanza con reusar por clave.

const pool = new Map();
export function offscreen(key, w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  let c = pool.get(key);
  if (!c || c.width !== w || c.height !== h) {
    c = createCanvas(w, h);
    pool.set(key, c);
  }
  const ctx = c.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
  return { canvas: c, ctx };
}

// ─── planos rotados en 3D (mesh warp proyectivo) ────────────────────────────
// Canvas 2D solo tiene transformaciones afines, y una tarjeta que gira sobre su
// eje Y necesita una proyectiva. Solución clásica: subdividir la tarjeta en una
// grilla, proyectar cada vértice en 3D y dibujar cada triángulo con la afín que
// lleva el triángulo de origen al proyectado, recortado a ese triángulo. Con una
// grilla de 10x10 el error de la aproximación afín es invisible.

function rot3(x, y, z, rx, ry, rz) {
  // Orden: Z, luego X, luego Y (gira en su plano, se inclina, se voltea).
  let c = Math.cos(rz);
  let s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(rx);
  s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}

// Dibuja `img` (un canvas) como una tarjeta de w x h (en unidades de mundo)
// centrada en (x, y, z) con rotaciones rx, ry, rz en radianes.
// shade: oscurece la cara según cuánto se aleja de la cámara (0 = nada).
export function card3d(ctx, cam, img, { x, y, z = 0, w, h, rx = 0, ry = 0, rz = 0, n = 10, shade = 0.18, alpha = 1 }) {
  const grid = [];
  for (let j = 0; j <= n; j++) {
    const row = [];
    for (let i = 0; i <= n; i++) {
      const lx = (i / n - 0.5) * w;
      const ly = (j / n - 0.5) * h;
      const [px, py, pz] = rot3(lx, ly, 0, rx, ry, rz);
      const p = project(cam, x + px, y + py, z + pz);
      if (!p) return;
      row.push([p.x, p.y]);
    }
    grid.push(row);
  }
  const iw = img.width;
  const ih = img.height;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u0 = (i / n) * iw;
      const u1 = ((i + 1) / n) * iw;
      const v0 = (j / n) * ih;
      const v1 = ((j + 1) / n) * ih;
      const p00 = grid[j][i];
      const p10 = grid[j][i + 1];
      const p01 = grid[j + 1][i];
      const p11 = grid[j + 1][i + 1];
      drawTri(ctx, img, [u0, v0], [u1, v0], [u0, v1], p00, p10, p01);
      drawTri(ctx, img, [u1, v0], [u1, v1], [u0, v1], p10, p11, p01);
    }
  }
  // Sombreado por orientación: la normal de la tarjeta contra el eje de vista.
  if (shade > 0) {
    const [, , nz] = rot3(0, 0, 1, rx, ry, rz);
    const k = (1 - Math.abs(nz)) * shade;
    if (k > 0.002) {
      ctx.beginPath();
      const g = grid;
      ctx.moveTo(g[0][0][0], g[0][0][1]);
      ctx.lineTo(g[0][n][0], g[0][n][1]);
      ctx.lineTo(g[n][n][0], g[n][n][1]);
      ctx.lineTo(g[n][0][0], g[n][0][1]);
      ctx.closePath();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(28,25,23,${k})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

// Un triángulo de la textura (s0,s1,s2) al triángulo de pantalla (d0,d1,d2).
function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  // Expandir apenas el triángulo destino para tapar las costuras de
  // antialiasing entre vecinos.
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7];
  };
  const e0 = grow(d0);
  const e1 = grow(d1);
  const e2 = grow(d2);

  // Afín que lleva s → d: resolver [a c e; b d f] con los tres pares.
  const [x0, y0] = s0;
  const [x1, y1] = s1;
  const [x2, y2] = s2;
  const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(den) < 1e-9) return;
  const solve = (v0, v1, v2) => [
    (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den,
    (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den,
    (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den,
  ];
  const [a, c, e] = solve(d0[0], d1[0], d2[0]);
  const [b, d, f] = solve(d0[1], d1[1], d2[1]);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.lineTo(e2[0], e2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  const minx = Math.max(0, Math.min(x0, x1, x2) - 2);
  const miny = Math.max(0, Math.min(y0, y1, y2) - 2);
  const maxx = Math.min(img.width, Math.max(x0, x1, x2) + 2);
  const maxy = Math.min(img.height, Math.max(y0, y1, y2) + 2);
  ctx.drawImage(img, minx, miny, maxx - minx, maxy - miny, minx, miny, maxx - minx, maxy - miny);
  ctx.restore();
}
