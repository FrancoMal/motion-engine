# Workflow de este repo

Este repo tiene un workflow **distinto** al de Trazo Inicial, a propósito. Allá el motor
era un medio para entregar piezas de marketing y las reglas eran conservadoras. Acá el
motor **es el producto**, y la idea es expandirlo.

## Diferencias con Trazo Inicial

| | Trazo Inicial | Acá |
|---|---|---|
| Commits de IA | Prohibido, sólo humanos | Permitido directo a `main` |
| Rama de trabajo | Ramas, nunca `master` | `main` directo; ramas sólo para experimentos grandes |
| Piezas | Contenido del producto | Ejemplos y portfolio del motor |
| Alcance | Sólo lo que pide el producto | Cualquier formato o pieza nueva |

**La primera fila es una decisión de Franco, no mía.** Queda escrita así porque es lo que
hace útil un repo de herramienta —iterar rápido— pero se cambia en una línea si prefiere
el modelo de Trazo Inicial.

## Regla que no se negocia

**Las salidas no se versionan.** Ni `out/`, ni `build/`, ni los wav, ni los mp3, ni los
mp4. Se regeneran desde el código. Un repo de motor que arrastra gigabytes de renders deja
de ser clonable.

Lo que **sí** se versiona de una pieza con audio son sus especificaciones: el guion, los
cues y el spec de efectos. Con eso se reconstruye el audio entero.

## Agregar una pieza nueva

1. `pieces/<nombre>/script.js` — qué pasa y cuándo, en segundos. Es el guion.
2. `pieces/<nombre>/frame.js` — cómo se dibuja un cuadro dado un instante.
3. Si es una familia de variantes, la base común va en `pieces/<nombre>-comun/` y cada
   variante sólo cambia parámetros. Así una familia se ve como una familia.
4. `node render.mjs <nombre> --from 0 --to 60 --workers 6` para iterar sobre un tramo
   corto antes de renderizar los cientos de cuadros.
5. Mirar frames reales antes de declarar que está listo. Una pieza que "debería" verse
   bien no se verifica sola.

## Agregar un formato nuevo

Se agrega una entrada en `engine/format.js` con resolución y zonas seguras. **Las zonas
seguras se miden sobre una captura real del destino**, no se estiman: son las franjas que
la interfaz tapa. El reloj de una pantalla de bloqueo y la UI de Instagram se comen más
pantalla de la que uno cree.

Si el nuevo formato comparte proporción con uno existente, la composición se reusa tal
cual y sólo cambian los píxeles. Pasó con 1080×2340 → 1440×3120: misma proporción, cero
rediseño.

## Trabajar el audio

El audio es una capa aparte y **nunca** re-renderiza la imagen.

1. Escribir el guion y los cues.
2. `node mux.mjs <pieza> --check` con los archivos reales en disco. El check contra
   duraciones estimadas no prueba nada.
3. `node mux.mjs <pieza>` para mezclar.
4. Verificar con ffprobe que hay pista de audio y que la duración no se movió.

## Al cerrar una tanda

- Borrar los mp4 truncados de renders que se cortaron. Pesan creíble y no abren.
- Limpiar los bancos de desarrollo que no sean entregables ni bancos de prueba estables.
- Si se aprendió algo que vuelva a morder —un límite de memoria, una trampa de un codec,
  un comportamiento raro de una API— anotarlo en `HANDOFF.md`. Ese archivo existe para que
  el motor no dependa de que una sesión siga viva.

## Mensajes de commit

Imperativo, en castellano, explicando **qué** y **por qué** cuando el por qué no es obvio.
El cuerpo sirve más que el título: dentro de seis meses lo que no se va a entender es la
decisión, no el cambio.
