// Worker de render: recibe números de frame, devuelve el frame terminado en RGB.
//
// Motion blur por acumulación temporal con obturador de cola: el frame f
// promedia N sub-frames repartidos en [f - s, f], donde s = shutter en
// fracciones de frame (0.5 = 180°, 0.75 = 270°, 1 = 360°). Con la ventana hacia
// atrás, el frame de contacto muestra el objeto en el contacto y su estela
// detrás, que es como se ve un impacto. Lo que se mueve rápido se desenfoca
// solo, en la dirección y la cantidad correctas, incluidas rotaciones, escalas
// y la cámara.
//
// Cada sub-frame tiene además una capa emisiva (env.emit) que se acumula igual
// y se convierte en brillo en el pase final.

import { parentPort, workerData } from "node:worker_threads";
import { createCanvas } from "@napi-rs/canvas";
import { accumulate, finish } from "./grade.js";
import { env } from "./env.js";

const { pieceUrl, scale, samplesOverride, gradeOff } = workerData;
const piece = (await import(pieceUrl)).default;

const W = Math.round(piece.width * scale);
const H = Math.round(piece.height * scale);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const emCanvas = createCanvas(W, H);
const emCtx = emCanvas.getContext("2d");
const acc = new Uint16Array(W * H * 4);
const emAcc = new Uint16Array(W * H * 4);

function drawAt(f, t) {
  env.frame = f;
  env.t = t;
  env.scale = scale;
  env.outW = piece.width;
  env.outH = piece.height;
  env.shared = {};
  env.emitted = false;
  emCtx.setTransform(1, 0, 0, 1, 0, 0);
  emCtx.clearRect(0, 0, W, H);
  env.emitCtx = emCtx;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, piece.width, piece.height);
  piece.draw(ctx, t);
  ctx.restore();
}

function renderFrame(f) {
  const m = (piece.motion && piece.motion(f)) || {};
  let n = samplesOverride ?? m.samples ?? 16;
  const shutter = m.shutter ?? 0.5;
  if (shutter <= 0) n = 1;
  acc.fill(0);
  emAcc.fill(0);
  let emUsed = false;
  const prof = { draw: 0, read: 0, em: 0, finish: 0 };
  for (let s = 0; s < n; s++) {
    const t = n === 1 ? f : f + ((s + 0.5) / n - 1) * shutter;
    const a = performance.now();
    drawAt(f, t);
    const b = performance.now();
    accumulate(acc, canvas.data());
    const c = performance.now();
    if (env.emitted) {
      accumulate(emAcc, emCanvas.data());
      emUsed = true;
    }
    const d = performance.now();
    prof.draw += b - a;
    prof.read += c - b;
    prof.em += d - c;
  }
  const g = gradeOff ? {} : (piece.grade && piece.grade(f)) || {};
  const e = performance.now();
  const out = finish(acc, n, W, H, { ...g, seed: f, grainSize: (g.grainSize ?? 1) * scale, scale }, emUsed ? emAcc : null);
  prof.finish = performance.now() - e;
  if (process.env.PROFILE) console.log(`f${f} n${n} draw ${prof.draw.toFixed(0)} read ${prof.read.toFixed(0)} em ${prof.em.toFixed(0)} finish ${prof.finish.toFixed(0)} ms`);
  return out;
}

parentPort.on("message", (msg) => {
  if (msg.type === "frame") {
    const t0 = performance.now();
    const rgb = renderFrame(msg.frame);
    parentPort.postMessage({ type: "done", frame: msg.frame, ms: performance.now() - t0, rgb }, [rgb.buffer]);
  }
});
parentPort.postMessage({ type: "ready", W, H });
