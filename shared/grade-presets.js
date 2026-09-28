// Presets de grade atados a los tokens ámbar (tratamiento final 2.7) y su
// mezcla. Las transiciones mezclan presets por COBERTURA del elemento que
// cambia el campo (área del iris, posición del barrido), nunca solo por tiempo:
// cada pieza calcula esos pesos en su timeline.

import { lerp } from "../engine/math.js";
import { mixHex } from "../engine/math.js";

export const PRESETS = {
  papel: {
    tone: { shadow: "#3b1d10", shadowAmt: 0.05, highlight: "#fff3e3", highlightAmt: 0.03, contrast: 0.02 },
    vignette: 0.1,
    vignetteColor: "#d9c7ad",
    grain: 0.026,
    emissive: 0.12,
  },
  acento: {
    tone: { highlight: "#fde9d3", highlightAmt: 0.04 },
    vignette: 0.16,
    vignetteColor: "#7c2d12",
    grain: 0.032,
    emissive: 0.3,
  },
  noche: {
    tone: { shadow: "#2a150c", shadowAmt: 0.06, contrast: 0 },
    vignette: 0.24,
    vignetteColor: "#0c0a09",
    grain: 0.04,
    emissive: 1,
  },
  crema: {
    tone: { shadow: "#3b1d10", shadowAmt: 0.05, highlight: "#fff3e3", highlightAmt: 0.03, contrast: 0.02 },
    vignette: 0.12,
    vignetteColor: "#f3c9a0",
    grain: 0.028,
    emissive: 0.2,
  },
};

// weights: { papel, acento, noche, crema } (se normalizan). extras: { ca,
// grainBump }. Devuelve los parámetros de engine/grade.js finish().
export function blend(weights, extras = {}) {
  const keys = Object.keys(PRESETS);
  let sum = 0;
  for (const k of keys) sum += weights[k] ?? 0;
  if (sum <= 0) return blend({ papel: 1 }, extras);
  const wv = keys.map((k) => (weights[k] ?? 0) / sum);
  const num = (f) => keys.reduce((a, k, i) => a + wv[i] * f(PRESETS[k]), 0);
  // Colores: mezcla acumulada en OKLab por peso.
  const colorMix = (f) => {
    let acc = null;
    let accW = 0;
    keys.forEach((k, i) => {
      if (wv[i] <= 0) return;
      const c = f(PRESETS[k]);
      if (!c) return;
      if (!acc) acc = c;
      else acc = mixHex(acc, c, wv[i] / (accW + wv[i]));
      accW += wv[i];
    });
    return acc;
  };
  const dominant = keys[wv.indexOf(Math.max(...wv))];
  const T = PRESETS[dominant].tone;
  return {
    tone: {
      shadow: colorMix((p) => p.tone.shadow) ?? T.shadow,
      shadowAmt: num((p) => p.tone.shadowAmt ?? 0),
      highlight: colorMix((p) => p.tone.highlight) ?? T.highlight,
      highlightAmt: num((p) => p.tone.highlightAmt ?? 0),
      contrast: num((p) => p.tone.contrast ?? 0),
    },
    vignette: num((p) => p.vignette),
    vignetteColor: colorMix((p) => p.vignetteColor),
    grain: num((p) => p.grain) * (extras.grainBump ?? 1),
    emissive: num((p) => p.emissive),
    ca: extras.ca ?? 0,
  };
}

export { lerp };
