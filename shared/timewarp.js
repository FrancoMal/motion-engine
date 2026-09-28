// Re-temporización: un mapa del frame de SALIDA al frame de HISTORIA.
//
// Las escenas están escritas en frames de historia (el guion original de 15 s).
// Para que las piezas se entiendan no alcanza con bajar la velocidad global:
// eso vuelve lentos los movimientos y deja igual de cortas las lecturas. El
// mapa estira cada tramo por separado. Los golpes y las transiciones corren a
// velocidad casi real; las lecturas y las capturas de UI se abren para que den
// tiempo a leer y entender, sin congelarse (la micro-animación sigue viva, solo
// más lenta).
//
// Se define por tramos contiguos [inicio, fin, frames de salida]. Entre tramos
// la pendiente cambia de forma suave: los puntos de quiebre se unen con una
// Hermite cúbica monótona (Fritsch–Carlson), así no hay saltos de velocidad en
// lo que se está moviendo cuando cambia el ritmo.
//
// El motion blur se ajusta solo: el worker muestrea sub-frames en tiempo de
// salida y cada uno pasa por el mapa, así un tramo lento tiene menos estela.

export function timewarp(segments) {
  // Nodos: frame de salida acumulado → frame de historia.
  const F = [0];
  const T = [segments[0][0]];
  for (const [a, b, out] of segments) {
    if (Math.abs(a - T[T.length - 1]) > 1e-9) throw new Error(`timewarp: tramo no contiguo en ${a}`);
    F.push(F[F.length - 1] + out);
    T.push(b);
  }
  const n = F.length;
  // Pendientes (dt/dF) con Fritsch–Carlson para mantener la monotonía.
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((T[i + 1] - T[i]) / (F[i + 1] - F[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      // Media armónica ponderada: suave y sin pasarse.
      const w1 = 2 * (F[i + 1] - F[i]) + (F[i] - F[i - 1]);
      const w2 = (F[i + 1] - F[i]) + 2 * (F[i] - F[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  const total = F[n - 1];

  // Frame de historia para un frame de salida (acepta fraccionales).
  function t(f) {
    if (f <= 0) return T[0] + (f - 0) * m[0];
    if (f >= total) return T[n - 1] + (f - total) * m[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (F[mid] <= f) lo = mid;
      else hi = mid;
    }
    const h = F[hi] - F[lo];
    const u = (f - F[lo]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * T[lo] + (u3 - 2 * u2 + u) * h * m[lo] + (-2 * u3 + 3 * u2) * T[hi] + (u3 - u2) * h * m[hi];
  }

  // Pendiente local (frames de historia por frame de salida).
  const slope = (f) => (t(f + 0.25) - t(f - 0.25)) / 0.5;

  // Inversa: primer frame de salida que llega a un frame de historia.
  function out(story) {
    let lo = -1;
    let hi = total + 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (t(mid) < story) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  return { t, out, slope, frames: Math.round(total), segments };
}

// Envuelve una pieza escrita en frames de historia y devuelve la pieza
// re-temporizada. `breathe` agrega una respiración de escala muy lenta a todo
// el cuadro (período de 8 s, ±0,6 %) para que las lecturas largas no queden
// como una foto fija.
export function retime(base, warp, { breathe = 0.006, period = 240 } = {}) {
  const W = base.width;
  const H = base.height;
  return {
    ...base,
    duration: warp.frames,
    storyDuration: base.duration,
    warp,
    draw(ctx, f) {
      const t = warp.t(f);
      if (breathe) {
        const s = 1 + breathe * Math.sin((2 * Math.PI * f) / period);
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
      }
      base.draw(ctx, t);
    },
    motion(f) {
      return base.motion ? base.motion(Math.round(warp.t(f))) : undefined;
    },
    grade(f) {
      return base.grade ? base.grade(Math.round(warp.t(f))) : undefined;
    },
  };
}
