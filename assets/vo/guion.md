# Guion de locución · Trazo Inicial

Voz en off de todas las piezas de motion graphics: las tres horizontales (funcionalidades,
casos de uso y el tutorial, con sus versiones verticales cuando las hay) y los cinco reels
verticales de Instagram (planificación, formularios, informes, el criterio es tuyo y
probalo con tu sala). Cada línea tiene un id estable: el
audio de esa línea va en `assets/vo/<id>.wav` (por ejemplo `assets/vo/func-01.wav`). El
pipeline (`mux.mjs`) lee esos archivos y los ubica según `assets/vo/cues.json`, que
tiene los mismos tiempos que las tablas de abajo.

## Para generar

- Una línea por archivo, sin silencios largos al principio ni al final (menos de 0,15 s).
- Texto: exactamente el de la columna **Texto a locutar**, con su puntuación (las comas y
  los puntos marcan las pausas).
- Voz: femenina, cálida, profesional, acento rioplatense con voseo natural. Ritmo pausado,
  sin apuro: cada línea tiene que sonar a alguien que conoce una sala de jardín, no a un
  anuncio gritado.
- Mismo voice ID y mismos ajustes en todas las líneas, para que todas las piezas suenen
  a la misma persona. Como punto de partida: stability alrededor de 0,5, similarity
  alrededor de 0,75, style bajo.
- Formato: WAV, 44,1 o 48 kHz, mono o estéreo (el pipeline normaliza el volumen al
  mezclar).
- Pronunciación a cuidar: el voseo lleva el acento al final (observás, marcás, tocás,
  leés, ajustás, editás, revisás). "Trazo Inicial" en dos palabras, con énfasis parejo.

## Duración de las piezas

Son las de los renders, a 30 fps:

- **Funcionalidades:** 36,33 s (1090 frames).
- **Casos de uso:** 33,50 s (1005 frames).

Las versiones horizontal (16:9) y vertical (9:16) duran exactamente lo mismo, así que
las dos llevan los mismos audios en los mismos momentos.

Cómo leer las tablas:

- **Entra:** el segundo en el que arranca la línea, puesto sobre lo que se ve en ese
  momento.
- **Objetivo:** la duración prevista a ritmo pausado (unos 15 caracteres por segundo,
  con las pausas de comas y puntos).
- **Máximo:** lo que la línea puede durar sin pisar la siguiente (deja 0,25 s de aire).
  En la última línea de cada pieza, sin salirse del video: quedan al menos 0,6 s de
  placa sola al final.

**Si un audio pasa su máximo, la animación se ajusta al audio**, no al revés: se alarga
esa escena y se vuelven a renderizar los cuatro videos. `node mux.mjs <pieza> --check`
avisa antes de mezclar si alguna línea pisa a la siguiente o se cae fuera del video.

## Pieza 1 · Funcionalidades (36,33 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| func-01 | 0,5 | 4,7 | 5,55 | "Subís tu planificación." La planificación se vuelve el formulario con las áreas de la sala. | Subís tu planificación y Trazo Inicial arma el formulario de tu sala. |
| func-02 | 6,3 | 3,9 | 4,65 | "Tocás. Marcás. Seguís." Una sugerencia, tres alumnos que se suman de una vez. | Vos marcás lo que observás, para varios alumnos a la vez. |
| func-03 | 11,2 | 4,2 | 4,85 | "Área por área." La barra de progreso de la redacción y el informe terminado. | Con eso, Trazo Inicial redacta cada informe, área por área. |
| func-04 | 16,3 | 4,8 | 4,95 | "Una instrucción." La edición en lote con el antes y el después, y el aviso "Aplicado a 12 informes." | Con una instrucción editás varios informes, y revisás antes de aplicar. |
| func-05 | 21,5 | 4,3 | 4,45 | "Contale tu idea." El chat de planificación y tres planificaciones que aparecen. | Contale tu idea y te propone secuencias, unidades y proyectos. |
| func-06 | 26,2 | 3,7 | 3,95 | El celular con la notificación "Ya están listos tus 12 informes." | Podés cerrar la app: te avisamos cuando estén listos. |
| func-07 | 30,4 | 2,7 | 2,95 | Placa final: el logo se dibuja y se entinta el claim. | Vos observás. Trazo Inicial redacta. |
| func-08 | 33,6 | 1,6 | 2,13 | Placa final con trazoinicial.com. | Trazo Inicial punto com. |

## Pieza 2 · Casos de uso (33,50 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| casos-01 | 0,4 | 3,7 | 3,85 | "Cierra el período." La línea Inicial, Medio, Final que se completa. | Cierra el período, y cada alumno necesita su informe. |
| casos-02 | 4,5 | 3,8 | 3,95 | "Toda la sala." La sala entera, cada alumno con sus observaciones marcadas. | Toda la sala, con lo que fuiste observando de cada uno. |
| casos-03 | 8,7 | 3,3 | 3,65 | "Los informes del finde." La pila de informes bajo la lámpara. Después de esta línea queda un silencio a propósito, hasta el toque de Generar. | Esos informes que se juntan para el fin de semana. |
| casos-04 | 12,6 | 4,9 | 6,15 | "El borrador ya está." Tocás Generar y las marcas de cada hoja se vuelven renglones. | Tocás Generar, y cada borrador ya está, a partir de lo que marcaste. |
| casos-05 | 19,0 | 2,4 | 4,05 | "Leés. Ajustás." Se abre un informe, se lee y se cambia una palabra. | Lo leés y ajustás lo que haga falta. |
| casos-06 | 23,3 | 3,8 | 4,05 | El resumen de la sala, CERRADO y la carpeta que se descarga. | Y la sala entera, en una carpeta lista para descargar. |
| casos-07 | 27,6 | 2,7 | 2,95 | Placa final: el logo se dibuja y se entinta el claim. | Vos observás. Trazo Inicial redacta. |
| casos-08 | 30,8 | 1,6 | 2,10 | Placa final con trazoinicial.com. | Trazo Inicial punto com. |

Si preferís un solo audio para el cierre, `func-07` y `casos-07` pueden ser el mismo wav
copiado con los dos nombres (lo mismo con `func-08` y `casos-08`). Duran igual en las
dos piezas.

## Pieza 3 · Tutorial: cómo crear los informes (2:41)

Duración: 161,00 s (4830 frames). Es un tutorial, no una publicidad: la voz explica
qué tocar, con el mismo nombre que tiene el botón en pantalla. Cada paso arranca
con "Paso uno", "Paso dos"... para que se siga sin mirar. Misma voz y ajustes que
las otras piezas (Valeria). En los botones que se nombran (Crear sala, Editar lista,
Generar informes, Empezar) conviene que se entienda que es el nombre del botón:
dicho claro, sin enfatizar de más.

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| tuto-01 | 0,8 | 4,6 | 7,05 | Título: "Cómo crear los informes de tu sala". | Así se crean los informes de tu sala en Trazo Inicial, paso a paso. |
| tuto-02 | 8,1 | 2,4 | 2,65 | Paso 1. Inicio, sin salas todavía: el cursor va a «Crear primera sala». | Paso uno: tocá Crear primera sala. |
| tuto-03 | 11 | 3,8 | 4,75 | Crear nueva sala: se escriben Nombre, Sección y Docente. | Completá el nombre de la sala, la sección y el docente. |
| tuto-04 | 16 | 3,9 | 4,35 | Jardín: «Crear el primero», nombre del jardín, «Guardar jardín». | Si es la primera vez, creá también tu jardín y guardalo. |
| tuto-05 | 20,6 | 2 | 7,35 | Toque en «Crear sala»; la sala queda creada. | Por último, tocá Crear sala. |
| tuto-06 | 28,2 | 2 | 2,95 | Paso 2. En la sala, «Editar lista» de Alumnos. | Paso dos: tocá Editar lista. |
| tuto-07 | 31,4 | 4,6 | 5,15 | «Agregar alumno», Nombre y Apellido, se guarda el primer alumno. | Tocá Agregar alumno, escribí el nombre y el apellido, y guardalo. |
| tuto-08 | 36,8 | 2,9 | 6,45 | La lista se completa con los seis alumnos. | Repetí con cada uno hasta completar la sala. |
| tuto-09 | 43,5 | 2,2 | 2,25 | Paso 3. Toque en «Nuevo período». | Paso tres: tocá Nuevo período. |
| tuto-10 | 46 | 3,2 | 4,75 | Se elige «Medio». | Elegí si es el período Inicial, Medio o Final. |
| tuto-11 | 51 | 3,5 | 3,95 | Opciones por indicador: 3. | Elegí cuántas opciones de logro querés por indicador. |
| tuto-12 | 55,2 | 3,8 | 3,85 | El PDF se arrastra a la zona del documento evaluativo. | Subí tu documento pedagógico evaluativo, en PDF o Word. |
| tuto-13 | 59,3 | 5 | 5,95 | Se resalta la zona de Planificación del período. | Si solo tenés la planificación, Trazo Inicial puede redactarlo desde ahí. |
| tuto-14 | 65,5 | 3,1 | 5,35 | «Generar Formulario» y el aviso "Generando formulario…". | Tocá Generar formulario y esperá a que termine. |
| tuto-15 | 71,1 | 3,9 | 4,15 | Paso 4. Resumen: 4 áreas, 12 indicadores, 36 sugerencias. | Paso cuatro: revisá las áreas que detectó Trazo Inicial. |
| tuto-16 | 75,5 | 4 | 4,05 | Se abre un indicador con sus sugerencias. | Podés editar, agregar o borrar indicadores y sugerencias. |
| tuto-17 | 79,8 | 2,9 | 3,05 | Se destilda Educación Física: "No evaluar". | Y destildar las áreas que no vas a evaluar. |
| tuto-18 | 83,1 | 2,9 | 4,75 | «Confirmar y crear formularios». | Después confirmá para crear los formularios. |
| tuto-19 | 88,1 | 2,8 | 3,75 | Paso 5. Formulario: se elige a Alex en la lista. | Paso cinco: elegí un alumno de la lista. |
| tuto-20 | 92,1 | 5,2 | 5,45 | Se tocan sugerencias en dos indicadores. | En cada indicador, tocá la sugerencia que mejor describe lo que observaste. |
| tuto-21 | 97,8 | 2,4 | 3,95 | Se escribe una nota personal. | Si querés, sumá una nota personal. |
| tuto-22 | 102 | 3,1 | 3,35 | «Siguiente sección»: pasa a Prácticas del Lenguaje. | Con Siguiente sección pasás a la próxima área. |
| tuto-23 | 105,6 | 1,8 | 2,95 | Los alumnos pasan a "listo" uno por uno. | Completá así a cada alumno. |
| tuto-24 | 108,8 | 5,2 | 7,65 | Se resalta la entrada «General». | Atajo: en General marcás una misma sugerencia para varios alumnos a la vez. |
| tuto-25 | 116,7 | 2,3 | 3,65 | Paso 6. Toque en «Generar informe». | Paso seis: tocá Generar informe. |
| tuto-26 | 120,6 | 4,2 | 4,55 | Se resalta "1 informe = 1 crédito"; «Seleccionar todos». | Cada informe usa un crédito de tu saldo. Elegí los alumnos. |
| tuto-27 | 125,4 | 3 | 3,75 | «Generar informes (6)» y «Empezar» en el diálogo. | Tocá Generar informes y confirmá con Empezar. |
| tuto-28 | 129,4 | 3,7 | 9,95 | Pantalla de progreso: 0/6 a 6/6. | Podés cerrar la app: te avisamos cuando estén listos. |
| tuto-29 | 139,6 | 3,4 | 4,35 | Paso 7. Resumen del período; toque en el ojo de Alex. | Paso siete: tocá el ojo para abrir cada informe. |
| tuto-30 | 144,2 | 2,7 | 2,75 | El informe abierto; se resalta «Editar». | Si hace falta, tocá Editar y ajustalo. |
| tuto-31 | 147,2 | 4,2 | 7,15 | «Descargar .docx» y después «Descargar carpeta». | Descargalo en Word, o bajá la carpeta con todos los informes. |
| tuto-32 | 154,6 | 3,3 | 5,8 | Cierre: logo, claim y trazoinicial.com. | Listo. Vos observás, Trazo Inicial redacta. |

## Reels verticales (Instagram)

Tres reels de marketing, no de tutorial: frases cortas que acompañan lo que se ve, con
energía cálida y sin apuro. Misma voz y ajustes (Valeria). Los reels van a 100 BPM: si
podés, que las frases no se estiren; si una termina antes, mejor (queda aire). Los
cierres (plan-06, form-06, info-05, crit-05, hoy-05) son el mismo audio que func-07:
basta con copiar ese wav con cada id.

### Reel 1 · Planificación (23,73 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| plan-01 | 0,4 | 2,1 | 2,35 | Gancho y chat: la idea se escribe en el compositor. | Contale tu idea a Trazo Inicial, |
| plan-02 | 3 | 1,7 | 1,95 | Se tocan "5 años", "2 semanas" y "Continuar". | elegí un par de opciones, |
| plan-03 | 5,2 | 2,1 | 3,15 | "Generar planificaciones": estallan las tres tarjetas. | y tenés la planificación lista. |
| plan-04 | 8,6 | 2,9 | 3,55 | "Editala a tu gusto.": se pide la visita al vivero y aparece. | La editás a tu gusto, con solo pedírselo. |
| plan-05 | 12,4 | 4,9 | 7,25 | Biblioteca, "Agregar", Planificación del período y el informe con la huerta. | Y la sumás al período, para que tus actividades lleguen a los informes. |
| plan-06 | 19,9 | 2,7 | 3,23 | Placa final con Google Play. | Vos observás. Trazo Inicial redacta. |

### Reel 2 · Formularios (21,33 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| form-01 | 0,3 | 1,9 | 1,95 | La hoja PDF cae en la zona de carga. | Subís tu documento pedagógico |
| form-02 | 2,5 | 2,7 | 2,75 | "Generar Formulario" y "Sale el formulario." | y sale el formulario, listo para usar. |
| form-03 | 5,5 | 3,2 | 3,35 | Revisá las áreas: 4 áreas, 12 indicadores, 36 sugerencias. | Con sus áreas, sus indicadores y sugerencias. |
| form-04 | 9,1 | 1,5 | 2,05 | Se tocan sugerencias; los alumnos pasan a listo. | Marcás lo que observás, |
| form-05 | 11,4 | 2,4 | 5,85 | "Generar informes (6)" y el progreso hasta 6/6. | y generás todos los informes juntos. |
| form-06 | 17,5 | 2,7 | 3,23 | Placa final con Google Play. | Vos observás. Trazo Inicial redacta. |

### Reel 3 · Informes (19,53 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| info-01 | 0,3 | 2,5 | 2,75 | "Generar informes (6)" y se reparten los seis. | Generás los informes de toda la sala, |
| info-02 | 3,3 | 3 | 3,35 | Editar en lote: "Mencionar el proyecto de la huerta". | y si querés cambiar algo, lo pedís una vez: |
| info-03 | 6,9 | 2,6 | 3,15 | El cambio en verde, "Aplicar a 6 informes", "Aplicado". | revisás el cambio y lo aplicás a todos. |
| info-04 | 10,3 | 2,7 | 5,15 | El informe de Alex: "Editar", se corrige una palabra, "Guardar". | O corregís uno a mano, cuando quieras. |
| info-05 | 15,7 | 2,7 | 3,23 | Placa final con Google Play. | Vos observás. Trazo Inicial redacta. |

### Reel 4 · El criterio es tuyo (23,13 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| crit-01 | 0,3 | 3 | 3,65 | "Lo que vos observás.": se toca la sugerencia en el formulario de Alex. | Lo que observás de cada alumno lo marcás vos, |
| crit-02 | 4,2 | 2,7 | 3,95 | "De ahí sale el informe.": las dos observaciones vuelan a sus oraciones. | y el informe se redacta a partir de eso. |
| crit-03 | 8,4 | 4 | 4,55 | "Revisás y elegís.": vista previa en verde, se desmarca a Sasha, "Aplicar a 2 informes". | Los cambios los revisás antes, y elegís a cuáles aplicar. |
| crit-04 | 13,2 | 5 | 5,85 | "La última palabra es tuya.": "Editar", una palabra cambiada, "Guardar", "Descargar .docx". | La última palabra es tuya: lo corregís y lo descargás cuando está listo. |
| crit-05 | 19,3 | 2,7 | 3,23 | Placa final con Google Play. | Vos observás. Trazo Inicial redacta. |

### Reel 5 · Probalo con tu sala (20,90 s)

| Id | Entra (s) | Objetivo (s) | Máximo (s) | En pantalla | Texto a locutar |
|---|---|---|---|---|---|
| hoy-01 | 0,3 | 2,9 | 3,65 | "Tu sala, tus alumnos.": se crea Sala Girasol y se cargan los seis. | Probalo con tu sala: cargás a tus alumnos, |
| hoy-02 | 4,2 | 2,7 | 3,35 | "Subís lo que ya tenés.": el PDF cae en el período, "Generar Formulario". | subís el documento que tu jardín ya usa, |
| hoy-03 | 7,8 | 3,3 | 3,95 | "Marcás y generás.": una sugerencia, tres alumnos, "Generar informes (3)". | marcás lo que observás, y generás tus informes. |
| hoy-04 | 12 | 3,1 | 3,75 | "3 informes, gratis.": salen los tres informes, "tenés 3 disponibles". | Los primeros tres son gratis, y sin tarjeta. |
| hoy-05 | 16 | 2,7 | 4,3 | Placa final con Google Play y "3 informes gratis · sin tarjeta". | Vos observás. Trazo Inicial redacta. |

## Por qué dice lo que dice

Cada línea se apoya en algo que la app hace hoy (verificado en el código):

- **Formulario:** lo arma Trazo Inicial a partir del documento de la sala.
- **Vista general:** la docente marca una sugerencia para varios alumnos a la vez.
- **Redacción:** los informes se redactan área por área a partir de lo marcado.
- **Edición en lote:** no guarda nada hasta que se aplica.
- **Planificación:** propone secuencias, unidades y proyectos.
- **Aviso:** es la frase real de la app, "te avisamos cuando termine".
- **Carpeta:** se descarga la de la sala entera.
- **El criterio es tuyo (reel 4):** la docente marca, revisa la vista previa de la edición en lote (las propuestas llegan todas marcadas y ella desmarca las que no quiere), corrige a mano y descarga. No se dice que el texto no se toca solo: después de generar hay una pasada automática de redacción (`services/informe_cleanup.py`). Lo que es de ella es qué se dice de cada alumno, el criterio y la última palabra; cómo está escrito lo resuelve la herramienta.
- **"3 informes gratis, sin tarjeta" (reel 5):** es la afirmación con más riesgo de todas, así que va con sus referencias.
  - La pantalla de registro lo dice textual: "Empezá con 3 informes gratis. Sin tarjeta." (`app/src/app/registro/page.tsx`, líneas 404 y 431).
  - `backend/routers/creditos.py`, línea 44: `SIGNUP_BONUS_BASE = 3`, con el comentario "cr. al crear cuenta (NO 5, baja decidida 2026-05)". Ahí está el origen de la contradicción entre la landing y el README: eran 5 y se bajaron a 3 en mayo de 2026.
  - Los créditos se acreditan al crear la cuenta por el trigger SQL `handle_new_profile_signup_bonus`, como `balance_promo` con `reason = signup_bonus`. El cuerpo del trigger vive en Supabase, no en las migraciones del repo; en el repo lo respaldan el docstring de `creditos.py`, el fallback `_get_or_create_creditos` (mismos valores: `balance_promo = 3`, `signup_bonus`, bucket `promo`) y el test `test_get_creditos_auto_creates_row_with_3_free_credits` (`backend/tests/test_creditos.py`, línea 46).
  - El alta pide solo email y contraseña, o Google (`supabase.auth.signUp` en el registro). Para generar se exige email confirmado y saldo (`require_verified_user`, `backend/auth.py`, línea 182), nunca un medio de pago.
  - MercadoPago solo aparece en `CreditOrder`: la compra explícita de créditos (`POST /me/creditos/comprar`, `creditos.py`, línea 189) y su webhook. No en el alta.
- **Tutorial:** cada paso y cada botón están verificados contra las pantallas reales. "Cada informe usa un crédito" es el texto de la app (1 informe = 1 crédito). Redactar el documento desde la planificación es la opción "Generar" del paso de documentos.

No hay tiempos, porcentajes ni promesas de ahorro. NatalIA no se nombra. El cierre es el
claim acordado: "Vos observás. Trazo Inicial redacta."
