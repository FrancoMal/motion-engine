// Estado compartido del sub-frame en curso, visible para las escenas.
//
// El worker lo prepara antes de cada sub-frame. Las escenas lo importan para
// dibujar en la capa emisiva (brillo) y para leer datos que otra escena
// exporta en el mismo frame (por ejemplo la máscara de un derrame).

export const env = {
  // Frame de salida que se está armando y tiempo exacto del sub-frame.
  frame: 0,
  t: 0,
  // Escala de render (1 = tamaño nominal, 0.5 = preview).
  scale: 1,
  // Lienzo de salida sin escalar (1920x1080 u 1080x1920 en vertical).
  outW: 1920,
  outH: 1080,
  // Contexto de la capa emisiva del sub-frame (lo fija el worker).
  emitCtx: null,
  // Datos que las escenas se pasan entre sí dentro del mismo sub-frame.
  shared: {},
};

// Dibuja algo también en la capa emisiva. Lo que se pinta acá se acumula como
// el color y, al terminar el frame, se desenfoca, se tiñe de ámbar y se suma en
// modo screen: es el brillo de los segmentos, la punta de la lapicera, los
// puntos sobre fondo oscuro. `fn(ctx)` recibe un ctx con la MISMA
// transformación que el ctx principal tenía al llamar a emit.
export function emit(mainCtx, fn) {
  const e = env.emitCtx;
  if (!e) return;
  env.emitted = true;
  e.save();
  e.setTransform(mainCtx.getTransform());
  e.globalAlpha = mainCtx.globalAlpha;
  fn(e);
  e.restore();
}
