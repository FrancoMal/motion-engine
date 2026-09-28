# Handoff · videos de Trazo Inicial

Lo que una sesión nueva necesita para seguir sin contexto previo. Complementa el
README (que describe el motor módulo por módulo); acá va el estado, las
convenciones y las trampas.

Rama de trabajo: `FrancoMal/videos-publicidad` (worktree en
`C:\Users\Usuario\orca\workspaces\NatalIA\videos-publicidad`). **Nunca push a master.**
Commits en español, explicando qué y por qué, autor Franco, sin coautores ni menciones
de IA, con `git commit -F <archivo>` (los `-m` en línea los bloquea un hook).

## Qué hay hecho (2026-09-26)

| Pieza | Código | Salida (`out/`, en .gitignore) | Estado |
|---|---|---|---|
| Funcionalidades 16:9 y 9:16 | `pieces/funcionalidades/` | `funcionalidades.mp4`, `-vertical.mp4` | aprobadas, con voz |
| Casos de uso 16:9 y 9:16 | `pieces/casos-de-uso/` | `casos-de-uso.mp4`, `-vertical.mp4` | aprobadas, con voz |
| Tutorial 16:9 (2:41) | `pieces/tutorial/` | `tutorial.mp4` (612 MB), `tutorial-web.mp4` (26 MB) | con voz, efectos y música |

Pendientes que ya están pedidos, en este orden:
1. Tres reels verticales (planificación, formularios, informes). Encargo del
   2026-09-26: primero el reel 1 solo, esperar OK, después 2 y 3, después las specs de
   audio de los tres juntas.
2. Re-render del tutorial: el código ya tiene corregidos 7 defectos de imagen (ver commit
   `ccbd953` y el resaltado de toque en `6209d64`). El mp4 en disco es el render viejo.
   Hay que re-renderizar (6 min), re-mezclar (`node mux.mjs tutorial`, 12 s) y rehacer la
   versión web. Los tiempos no cambiaron: los audios siguen valiendo.
3. Vertical del tutorial (recortes ampliados de la zona donde se toca, no la pantalla
   encogida). `LAYOUT` en `pieces/tutorial/frame.js` ya está parametrizado por formato.
4. Retrofit de las cuatro piezas aprobadas con efectos y música (no empezar sin pedido).

## Motor

Sin Remotion ni framework de video (decisión de Franco). Cada frame lo dibuja código en
canvas 2D (`@napi-rs/canvas`, Skia) y ffmpeg arma el mp4.

- `render.mjs <pieza> [--format v] [--from N --to N] [--out f.mp4] [--scale 0.5]
  [--still a,b | --still-story a,b] [--samples N] [--workers N]`. Stills a `out/stills/`.
- `engine/`: easing, springs, cámara 2.5D, texto (Manrope variable), paths, fx, grade por
  píxel, worker con motion blur por acumulación de sub-frames, `format.js` (`IS_V`,
  `OUT_W`, `OUT_H`, `SAFE`). `icons-data.js` tiene íconos de lucide extraídos de
  `G:\NatalIA\app\node_modules\lucide-react\dist\esm\icons` (la app de este worktree no
  tiene node_modules): si falta uno, se copia su `__iconNode` pasando círculos, líneas y
  rects a paths.
- `shared/`: sistema de las piezas publicitarias (frases cinéticas, punto que cruza
  costuras, placa final, re-temporizado `timewarp.js`, cámara vertical `vcam.js`).
- Piezas publicitarias: escritas en 450 frames de "historia" y re-temporizadas con un
  `WARP` por tramos en `index.js`. El tutorial en cambio se escribe directo en segundos
  (`pieces/tutorial/script.js`).
- Vertical de las publicitarias: `--format v` fija `TRAZO_FORMAT=v` antes de cargar; una
  cámara vertical (`pieces/*/vertical.js`) encuadra el mundo 1920x1080 y las escenas
  apilan con `IS_V` lo que en horizontal va lado a lado. Zona segura de Instagram:
  y 269 a 1536, x 72 a 1008.
- `qa.mjs <pieza>`: lecturas en tiempo de salida, grilla, colores de marca.

### El tutorial (modelo para piezas de interfaz)

- `app-ui.js`: componentes de la app redibujados en px CSS con sus medidas reales (Btn
  sm/md/lg = 36/46/54 de alto, Tag, AvatarN con el mismo hash de color, sidebar de 240,
  topbar de 86).
- `screens.js`: cada pantalla es `(ctx, estado) => { R, pageH, nav, fixed }`; `R` son rects
  con nombre (para apuntar el cursor y encuadrar). Textos literales verificados contra
  `app/src/app/...`; datos ficticios.
- `script.js`: tomas, cámara (`fit(rect, scroll)`), toques, resaltados, indicaciones, en
  segundos. `layoutOf(pantalla, estado)` mide los rects sin dibujar en pantalla.
- Los toques del guion (`CLICKS`) son la fuente de los cues de efectos.

## Audio

- Voz: `assets/vo/guion.md` (líneas, ids, tiempos) y `assets/vo/cues.json` (mismos
  números: `at`, `objetivo`, `maximo`, `duracion_s`). Voz ElevenLabs "Valeria",
  eleven_multilingual_v2, stability 0.5, similarity 0.75, style 0.1. La genera Franco:
  **nunca tocar API keys ni credenciales**. Ids existentes: func-01..08, casos-01..08,
  tuto-01..32.
- Efectos: `assets/sfx/spec.json` (catálogo sfx-01..07 con prompts en inglés, cues por pieza
  con `gain_db`, sección `musica`). Familia cálida: madera, marimba, papel, campanitas.
- Música: `assets/music/<pieza>.mp3`.
- Estimación de duración de una línea: 15 caracteres/s + 0,15 s por coma y 0,25 s por
  punto interno. Las líneas reales salen algo más cortas. Máximo de cada línea = hasta
  0,25 s antes de la siguiente; la última deja 0,6 s de cola.
- `node mux.mjs <pieza> [--format v] --check` valida contra los archivos reales;
  sin `--check` mezcla sobre `out/<pieza>.mp4` con `-c:v copy` (no re-renderiza).
  - Solo voz: loudnorm -16 LUFS de la mezcla.
  - Con efectos o música: tres capas renderizadas por separado en `build/mix/<pieza>/`
    (voz -16 LUFS; efectos a -1 dBFS de pico + `gain_db`; música a -30 LUFS con ducking
    de -8 dB calculado desde los tiempos de cada línea, 150 ms de ataque y 600 ms de
    relevo) y después sumadas. Resultado del tutorial: -16,2 LUFS, pico -1,6 dBFS.
- Verificación que usamos: correlación de cada wav/efecto contra su capa (desfase en ms),
  loudness con `ebur128`, y que el MD5 de la pista de video sea igual al del mudo.

## Convenciones de marca

- Paleta ámbar real de la app (`shared/brand.js`): acento `#c2410c`, papel `#faf6ef`,
  tinta `#1c1917`. Manrope en todo. Logo con su geometría original.
- Claim acordado: "Vos observás. Trazo Inicial redacta." Placa: logo, claim y
  trazoinicial.com. NatalIA no se nombra.
- Nada de rayas largas (em dash) ni itálicas de color en el texto propio.
- Sin métricas, porcentajes, testimonios ni promesas inventadas. Solo funciones que existen
  (verificar contra `app/src` antes de guionar). Nombres de chicos obviamente ficticios
  ("Alex Ejemplo", "Noa Ejemplo"…), nada de datos de la base real.
- Créditos: la app dice "1 informe = 1 crédito"; no mencionar los créditos de regalo.

## Trampas encontradas

- **Memoria:** con 14 workers el render vertical agotó la RAM y el sistema lo mató. Usar
  `--workers 6`. Renders largos: en mitades con `--from/--to` y unir con el concat de
  ffmpeg (`-c copy`), en primer plano (las tareas en segundo plano las puede matar el
  sistema si falta memoria).
- **Motion blur:** en piezas de interfaz, obturador corto (0,15) o el texto se lava en los
  zooms y aparecen copias escalonadas.
- **sfx-01 (toque):** el archivo generado trae el clic fuerte a los 145 ms. El catálogo
  tiene `recorte_inicio_s: 0.135`; la mezcla lo aplica. Siempre medir el transitorio de
  un efecto nuevo antes de mezclar (pico y arranque).
- **ffmpeg:** repartir un mismo efecto con `asplit` a cues separados por minutos, o sacar
  varias salidas de un mismo grafo, lo traba. Por eso cada capa se renderiza sola y cada
  cue es una entrada propia.
- **ffmpeg, cuelgue intermitente:** un `apad` sin límite antes de `atrim` a veces deja a
  ffmpeg girando sin escribir (pasó en los efectos de reel-formularios y de reel-hoy). La
  mezcla usa `apad=whole_dur=` y corta cada llamada a los 180 s: si vuelve a pasar,
  falla con un mensaje en vez de quedar colgada.
- **Orden de audio:** primero la voz (manda los tiempos), después efectos, después
  música; la música pierde siempre que pelea con la voz.
- **Tamaño:** el grano del grade hace que el mp4 de entrega pese mucho (el tutorial, 612
  MB). Para web: `-c:v libx264 -preset slow -crf 23 -vf hqdn3d=2:2:8:8 -c:a copy
  -movflags +faststart` (26 MB, sin pérdida visible).
- **Transiciones de página:** nunca dos pantallas superpuestas (la vieja se va, un instante
  de fondo, entra la nueva). Resaltados recortados a la ventana y atados a su toma.
- **Archivos CRLF:** muchos fuentes tienen fin de línea CRLF; al editar con scripts,
  normalizar a LF, reemplazar y volver a escribir CRLF.
- `out/stills` puede quedar "en uso" si la terminal está parada adentro: salir antes de
  borrarlo.
- La consigna original pedía, al cerrar: ruta absoluta de los entregables, mp4 en el
  .gitignore y borrar la basura de desarrollo de `out/` (solo entregables) y los arneses.
