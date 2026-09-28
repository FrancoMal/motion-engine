# motion-engine

Motor de motion graphics **por código**. No edita video: calcula el color de cada píxel de
cada cuadro, y le pasa los cuadros crudos a ffmpeg por una tubería.

**23.384 líneas de código propio. Una sola dependencia externa.**

```json
{ "dependencies": { "@napi-rs/canvas": "1.0.9" } }
```

Esa dependencia da una superficie para dibujar en 2D — la misma API que tiene cualquier
navegador. Todo lo demás está escrito acá: las curvas de easing, los resortes, la cámara
en perspectiva, el motion blur, el grado de color, la tipografía cinética.

No hay After Effects, no hay plantillas, no hay framework de video.

## Por qué existe

Este motor nació para hacer piezas de marketing y terminó siendo una herramienta general.
El primer intento fue con Remotion (el estándar de la industria, React que renderiza
frames). Se descartó a pedido: la idea era escribir el renderizador, no depender de uno.

La apuesta salió bien. Al no haber una herramienta intermedia, todo es un parámetro:
cambiar la duración de una pieza, su resolución o su formato no implica rehacerla.

## Cómo funciona

```
pieces/<nombre>/script.js     qué pasa y cuándo (el guion, en segundos)
pieces/<nombre>/frame.js      cómo se dibuja un cuadro dado un instante
         │
         ▼
render.mjs                    reparte los cuadros entre N workers
         │
         ▼
engine/worker.mjs             dibuja cada cuadro, acumula sub-muestras de motion blur
         │
         ▼
ffmpeg (h264_nvenc)           recibe los cuadros crudos por stdin y comprime en GPU
         │
         ▼
out/<nombre>.mp4
```

Nunca se escriben PNG intermedios al disco. Los cuadros viajan por una tubería.

### El motor

| Módulo | Líneas | Qué resuelve |
|---|---|---|
| `paths.js` | 361 | Formas vectoriales: dibujado progresivo, transformación entre formas |
| `grade.js` | 292 | Color final píxel por píxel: viñeta, grano, bloom, sangrado |
| `ease.js` | 250 | Curvas de movimiento: cubic-bezier propias, resortes analíticos, anticipación y overshoot |
| `camera.js` | 201 | Cámara 2.5D con perspectiva real y paralaje |
| `math.js` | 160 | Utilidades geométricas y de interpolación |
| `text.js` | 159 | Tipografía glifo por glifo, medición exacta de ancho, peso variable |
| `worker.mjs` | 93 | Worker de render y acumulación de motion blur |
| `fx.js` | 86 | Efectos compuestos |
| `icons-data.js` | 76 | Íconos vectoriales |
| `format.js` | 36 | Formatos de salida y zonas seguras por formato |
| `env.js` | 36 | Detección de entorno y rutas |

### Formatos

`format.js` define resolución y **zonas seguras** por formato. Las zonas seguras no son
decorativas: son las franjas que la interfaz de destino tapa (la UI de Instagram, el reloj
de la pantalla de bloqueo) y la composición las respeta.

| Formato | Resolución | Uso |
|---|---|---|
| horizontal | 1920×1080 | Web, YouTube |
| vertical | 1080×1920 | Reels, Stories, Shorts |
| wallpaper | 1440×3120 | Fondo de pantalla de bloqueo (19,5:9) |

Agregar un formato es agregar una entrada. La misma pieza se renderiza en cualquiera.

## Uso

```bash
npm install

# renderizar una pieza completa
node render.mjs <pieza> --workers 6

# renderizar un tramo (útil para iterar sin esperar todo)
node render.mjs <pieza> --from 120 --to 300 --workers 6

# validar que el audio entra donde dice el guion, sin mezclar
node mux.mjs <pieza> --check

# mezclar voz + efectos + música sobre el video ya renderizado
node mux.mjs <pieza>

# revisión automática de la pieza
node qa.mjs <pieza>
```

### Requisitos

- Node 20 o superior
- ffmpeg en el PATH o en `C:\ffmpeg\bin\ffmpeg.exe`
- GPU NVIDIA para `h264_nvenc` (opcional: sin GPU cae a codificación por CPU, más lenta)

### Rendimiento y memoria

Referencia en una RTX 4070 Ti: **~0,2 s por cuadro** a 1080×1920. Una pieza de 15 s
(450 cuadros) se renderiza en alrededor de minuto y medio.

**Usar `--workers 6`.** Con 14 workers el proceso muere por falta de memoria del sistema
(no de VRAM). Si un render se corta a la mitad deja un mp4 con peso creíble que ni
siquiera abre (`moov atom not found`): **borrarlo antes de relanzar**, o alguien lo va a
confundir con un entregable.

## Audio

`mux.mjs` es una capa separada que **no vuelve a renderizar la imagen** (`-c:v copy`).
Sumar locución, efectos o música cuesta segundos y la duración no se mueve ni un cuadro.

Tres capas con jerarquía fija:

- **Voz** a −16 LUFS. Manda.
- **Efectos** con ganancia propia por cue, alrededor de 20 dB debajo de la voz.
- **Música** a −30 LUFS, con ducking de −8 dB mientras habla la voz.

Los audios no se versionan (se regeneran), pero **sus especificaciones sí**:

- `assets/vo/guion.md` — el texto exacto de cada línea, con su id, momento y duración máxima
- `assets/vo/cues.json` — dónde entra cada línea, validable contra el mp4 real
- `assets/sfx/spec.json` — catálogo de efectos, sus cues y ganancias, y el pedido de música

`mux.mjs --check` compara la duración real de cada wav contra el hueco disponible y frena
si alguna línea se pisa con la siguiente o se cae del final.

### Trampa conocida

Un archivo de efecto tiene que **empezar con su transitorio**, con menos de 10 ms de
silencio adelante. Si el pico está 150 ms adentro, el golpe suena cuatro cuadros tarde y
se nota. Recortar el silencio del frente sí; recortar la cola no, porque la caída natural
de una nota *es* el sonido.

## Piezas

Cada pieza vive en `pieces/<nombre>/`. Las que empiezan con `_` son bancos de prueba del
motor, no entregables. Las que terminan en `-comun` son base compartida entre variantes:
por eso una familia de piezas se siente una familia y no siete cosas distintas.

El historial de este motor son 10 videos de producto (tres piezas horizontales con sus
verticales, cinco reels y un tutorial narrado de 2:41) y 7 fondos de pantalla animados.

## Estructura

```
engine/     el motor: easing, paths, cámara, grade, texto, blur
pieces/     una carpeta por pieza: script.js (cuándo) + frame.js (cómo)
shared/     utilidades compartidas entre piezas
assets/
  fonts/    tipografías (Manrope variable + su licencia OFL)
  brand/    logos y recursos gráficos
  vo/       guion y cues de locución (los wav se regeneran)
  sfx/      spec de efectos (los wav se regeneran)
  music/    camas musicales (se regeneran)
out/        salidas. No se versiona.
build/      respaldos y temporales. No se versiona.
```

Ver `HANDOFF.md` para el detalle de mantenimiento y las trampas encontradas.
