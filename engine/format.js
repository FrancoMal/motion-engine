// Formato de salida de la pieza que se está renderizando.
//
// Las escenas se escriben en un mundo de 1920x1080 (el guion original). La
// versión vertical (1080x1920, para reels e historias) no recorta ese mundo:
// lo re-diagrama. Una cámara vertical encuadra cada momento, y las escenas que
// en horizontal ponen tipografía y UI lado a lado las apilan cuando FORMAT es
// "v" (ver shared/vcam.js). render.mjs fija TRAZO_FORMAT antes de cargar la
// pieza, así cada módulo sabe el formato desde que se evalúa.

export const FORMAT = process.env.TRAZO_FORMAT === "v" ? "v" : "h";
export const IS_V = FORMAT === "v";
// Tamaño del lienzo de salida.
export const OUT_W = IS_V ? 1080 : 1920;
export const OUT_H = IS_V ? 1920 : 1080;
// Zona segura de Instagram en vertical: nada crítico en el ~14 % de arriba ni
// en el ~20 % de abajo (la tapan la interfaz de la app).
export const SAFE = IS_V ? { top: 269, bottom: 1536, left: 72, right: 1008 } : { top: 0, bottom: 1080, left: 0, right: 1920 };

// Fondo de pantalla de bloqueo: Samsung Galaxy S25 Ultra, 1440x3120 (QHD+,
// 19,5:9). Se diseña en un espacio de 1080x2340, la misma proporción (0,4615),
// y se dibuja escalado por `k`; así el diseño no depende de la resolución.
// No es un formato del mundo 1920x1080: las piezas de wallpaper lo usan
// directo. La interfaz de bloqueo tapa arriba hasta el 27 % (barra de
// estado, candado, reloj y fecha) y abajo desde el 80 % (desbloqueo, widget de
// música, llamada y cámara): la composición vive entre esas dos líneas, y la
// franja del reloj tiene que quedar oscura y quieta para que la hora se lea.
export const WALLPAPER = {
  w: 1440,
  h: 3120,
  // Espacio de diseño y factor de escala al lienzo de salida.
  design: { w: 1080, h: 2340 },
  k: 1440 / 1080,
  // Zonas en el espacio de diseño. Franjas conservadoras que cubren One UI y
  // MIUI: libre hasta el 27 % arriba y desde el 80 % abajo.
  safe: { top: Math.round(2340 * 0.27), bottom: Math.round(2340 * 0.8), left: 0, right: 1080 },
};
