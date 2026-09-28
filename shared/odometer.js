// Contador de rodillo: cada dígito que cambia rueda hacia arriba en 5 f con
// snap. Se usa para "9 / 12" → "12 / 12", "sección N de 7", "Planificaciones
// · 3". Los contadores muestran estados plausibles de la UI, nunca métricas.

import { setType, glyphs } from "../engine/text.js";
import { clamp } from "../engine/math.js";
import { spr, SPR } from "./system.js";

// steps: [[frame, texto], ...] ordenados. Antes del primer frame muestra el
// primer texto. El texto puede mezclar dígitos y otros caracteres: solo ruedan
// las posiciones que cambian.
export function odometer(ctx, t, x, baseline, steps, { size = 26, weight = 700, color = "#1c1917", align = "left", roll = 5, alpha = 1 } = {}) {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) if (t >= steps[i][0]) idx = i;
  const cur = steps[idx][1];
  const prev = idx > 0 ? steps[idx - 1][1] : cur;
  const tc = steps[idx][0];
  const k = idx > 0 ? clamp(spr(t, tc, SPR.snap), 0, 1.2) : 1;
  const style = { size, weight, tracking: 0 };
  // Cifras tabulares: todas las posiciones con el ancho del "0".
  setType(ctx, style);
  const dw = ctx.measureText("0").width;
  const widthOf = (s) => Array.from(s).reduce((a, ch) => a + (/\d/.test(ch) ? dw : ctx.measureText(ch).width), 0);
  const wCur = widthOf(cur);
  let cx = align === "center" ? x - wCur / 2 : align === "right" ? x - wCur : x;
  const cap = glyphs(ctx, "0", style).cap;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  const a = Array.from(cur);
  // Alinear a la derecha los dos textos para comparar dígito por dígito.
  const b = Array.from(prev.padStart(cur.length, " ")).slice(-cur.length);
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    const w = /\d/.test(ch) ? dw : ctx.measureText(ch).width;
    setType(ctx, style);
    if (ch !== b[i] && k < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 2, baseline - cap * 1.35, w + 4, cap * 1.7);
      ctx.clip();
      const off = (1 - k) * cap * 1.4;
      if (b[i] !== " ") ctx.fillText(b[i], cx + (w - ctx.measureText(b[i]).width) / 2, baseline - (cap * 1.4 - off));
      ctx.fillText(ch, cx + (w - ctx.measureText(ch).width) / 2, baseline + off);
      ctx.restore();
    } else {
      ctx.fillText(ch, cx + (w - ctx.measureText(ch).width) / 2, baseline);
    }
    cx += w;
  }
  ctx.restore();
  return wCur;
}
