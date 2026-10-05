# Especificación de frontend · ByTheWay v0.1.0

Qué hace la app, pantalla a pantalla, y qué reglas sigue. Los términos en **negrita** están definidos en el [glosario](../CONTEXT.md); las decisiones de fondo, en los [ADR](adr/). Donde este documento y un mock no coincidan, manda este documento. La dirección visual se decide con los mocks (#4) y completará la sección 10.

## 1. Alcance

**Entra en la v0.1.0**
- Mapa con los POIs del Editor, Modo seguimiento y zoom por velocidad.
- Anuncio automático al entrar en un POI; Narración a petición.
- Sesión de 12 h y estado Escuchado permanente.
- Castellano e inglés.
- PWA instalable que funciona sin red (salvo las teselas del mapa que no se hayan visto).
- Modo bolsillo.
- Simulador de paseo tras `?sim`: una ruta de ejemplo por el Retiro; para probar lugares de otra zona se arrastra la flecha hasta ellos.

**No entra**
- Funcionamiento con la pantalla bloqueada (ADR 0002).
- Rutas o colecciones que el usuario elija.
- Cuentas de usuario, sincronización o analítica.
- Subir un KML desde el móvil.
- Precarga de mapas offline.

## 2. Principios

1. **Se usa andando.** Todo lo importante se lee en medio segundo y se toca con el pulgar. Objetivos táctiles de al menos 44 px, y ninguna acción imprescindible en la mitad superior de la pantalla.
2. **La voz manda y no molesta.** El Anuncio es corto (solo el título) y nunca corta una Narración. El usuario decide cuándo escuchar la historia.
3. **El mapa responde siempre.** Las posiciones GPS no bloquean la interfaz. Mover el mapa con el dedo va a 60 fps y nunca lucha con la cámara.
4. **Nada sale del móvil.** Sin backend ni analítica: la posición solo se usa en el dispositivo.

## 3. Reglas de la guía

| Regla | Valor |
|---|---|
| Radio de acción | `LookAt.range` del KML, en metros (ADR 0001) |
| Radio efectivo mínimo | 15 m (el dato del Editor no se modifica) |
| Posiciones descartadas | precisión peor que 50 m |
| Confirmación de Entrada | 2 posiciones seguidas dentro del radio |
| Qué dice el Anuncio | solo el título del POI, en el idioma de la app |
| Varias Entradas a la vez | primero el POI de radio mayor |
| Anuncio durante una Narración | espera a que termine; se muestra "A continuación" con un sonido suave |
| Anuncio en cola cuando sales del radio | se descarta |
| Sesión | un POI anunciado no se vuelve a anunciar en las 12 h siguientes a su Anuncio |
| Escuchado | se marca al empezar la Narración; es permanente y el POI no se vuelve a anunciar nunca |
| Empezar de cero | un único botón en ajustes que vacía la Sesión y olvida los Escuchados, con confirmación |
| Radios anidados o solapados | cada POI se evalúa por separado |

Casos de referencia (se convierten en tests en el #6):
- **Salir y volver a entrar** en un POI anunciado hace 2 h: no hay Anuncio. Si fue hace 13 h, sí lo hay, salvo que esté Escuchado.
- **Parque de 1 km con una estatua de 20 m en su borde**, al entrar en ambos a la vez: primero el parque, luego la estatua (si sigues dentro de ella).
- **Narración de 2 minutos**, entras en otro POI y sales antes de que acabe: ese POI no se anuncia y podrá anunciarse al volver.
- **Recarga de la página** a mitad de paseo: la Sesión y los Escuchados se conservan.
- **Empezar de cero** tras un paseo completo: todos los POIs vuelven a estar por escuchar y se anuncian otra vez.
- **Narración escuchada en casa desde la ficha**: el POI ya es Escuchado y no se anunciará al pasar por él.

## 4. Pantallas

### 4.1 Inicio

Primera pantalla de cada arranque.

- **Contenido:** la marca, una frase que explica qué va a pasar ("Te avisaremos al pasar junto a cada lugar. Lleva la pantalla encendida."), un selector ES/EN y el botón **Empezar**.
- **Idioma por defecto:** castellano, sea cual sea el idioma del navegador. Si el usuario elige otro, se recuerda.
- **Empezar**, dentro del mismo toque: pide el permiso de ubicación, desbloquea la voz (iOS la exige desde un gesto), activa el Wake Lock y empieza a seguir la posición.
- Si hay una Sesión viva de menos de 12 h, el botón sigue diciendo "Empezar": la Sesión se conserva sin preguntar.

### 4.2 Mapa (pantalla principal)

- Mapa a pantalla completa, en Modo seguimiento al empezar.
- **Controles:**
  - **Recentrar**: solo visible fuera del Modo seguimiento; grande y en la zona del pulgar.
  - **Brújula**: indica el rumbo. Tocarla fija el norte arriba; volver a tocarla lo desbloquea.
  - **2D/3D**: cambia entre el mapa inclinado y el plano (sección 6).
  - **Ajustes**.
- **No se muestra la velocidad** del usuario: solo se usa para el zoom y la inclinación de la cámara.
- **Zona inferior:** la tarjeta del Anuncio o el reproductor (4.5 y 4.6). Si no hay ninguno de los dos, no se muestra nada: solo el mapa. No hay un panel de "próximo POI" al estilo navegador. Su altura se pasa a la cámara como `padding` para que el usuario nunca quede tapado.

### 4.3 Burbuja

- **Tocar un POI** abre una burbuja anclada a él con su título y su distancia. Sigue al POI cuando el mapa se mueve.
- **Tocar la burbuja** abre la ficha.
- **Tocar el mapa fuera** cierra la burbuja.
- El POI seleccionado muestra su círculo de radio.

### 4.4 Ficha

Hoja inferior que se abre desde la burbuja o desde la tarjeta del Anuncio.

- **Contenido:** título, distancia, estado ("Escuchado" si procede), el aviso "Solo en castellano" si no hay traducción, la Descripción completa y **▶ Escuchar**.
- **Descripción:** se muestra tal cual la escribió el Editor, partida en párrafos solo para leerla. No se reconocen partes: el "Por cierto" no recibe ningún tratamiento especial.
- **Sin descripción:** "Este lugar aún no tiene descripción." El botón Escuchar lee solo el título.
- **Acciones arriba:** ▶ Escuchar (o Pausar/Seguir y Parar mientras suena) va justo debajo del título y la distancia, antes del texto, para no tener que bajar hasta el final.
- **Se cierra** deslizando hacia abajo o con Cerrar. Mientras está abierta, el Modo seguimiento se pausa, y se reanuda al cerrarla si no se movió el mapa.

### 4.5 Tarjeta del Anuncio

Aparece al anunciarse un POI. Como toda tarjeta de un POI, muestra la distancia en vivo hasta él.

- **Contenido:** "Estás aquí" o la distancia, el título, **▶ Escuchar** y **Leer**, que abre la ficha.
- **Duración:** se mantiene mientras el usuario está dentro del radio y 30 s después de salir. Se puede descartar deslizándola.
- Si llega un nuevo Anuncio, sustituye a la tarjeta anterior.

### 4.6 Reproductor

Sustituye a la tarjeta mientras hay una Narración.

- **Contenido:** título, progreso (frase actual sobre el total), **Pausar/Seguir** y **Parar**.
- **Pausar** para al final de la frase en curso y **Seguir** retoma desde el principio de esa frase (sección 7).
- **Cola:** si hay Anuncios pendientes, se muestra "A continuación: *título*" y suena un aviso breve (no hablado) cada vez que se añade uno.
- **Al terminar**, el reproductor desaparece y la cola sigue: se anuncia el siguiente POI si el usuario sigue dentro de su radio.

### 4.7 Ajustes

Contenido de la pantalla:
- **Idioma:** ES/EN. Cambia a la vez la interfaz, el contenido, la voz y las etiquetas del mapa.
- **Voz:** la elegida automáticamente, con la lista de las disponibles para el idioma actual.
- **Modo bolsillo.**
- **Empezar de cero.** Pide confirmación: "Se volverán a anunciar todos los lugares, también los que ya escuchaste."
- No hay ajuste de tema: el oscuro es automático (sección 5).

### 4.8 Modo bolsillo

- Pantalla negra, sin elementos brillantes, con un único texto tenue: "Toca dos veces para salir".
- La guía sigue funcionando: Anuncios hablados y Narraciones en curso.
- Un Anuncio no enciende la pantalla. Al salir se ve la tarjeta.

### 4.9 Estados vacíos y errores

| Situación | Qué se ve |
|---|---|
| Permiso de ubicación denegado | Mapa sin posición y un aviso fijo: "Sin tu ubicación no podemos avisarte. Actívala en los ajustes del navegador." Los POIs se pueden explorar y escuchar a mano. |
| GPS sin precisión suficiente | Marcador de posición en gris con su círculo de precisión. No hay Entradas hasta que mejore. |
| Sin voz disponible | Aviso en inicio: "Este navegador no puede leer en voz alta." La app funciona como guía de lectura. |
| Sin red al arrancar, con datos en caché | Funciona normal. Si faltan teselas, el mapa muestra un fondo neutro con los POIs. |
| Sin red y sin datos en caché | "Necesitamos conexión la primera vez para descargar los lugares." y un botón Reintentar. |
| Lejos de todos los POIs (más de 5 km) | Un aviso discreto con la distancia al más cercano y un botón para ir a verlo en el mapa. |

## 5. Mapa

- **SDK:** TomTom Maps SDK JS (`@tomtom-org/maps-sdk`), que usa MapLibre GL por debajo. El worker de MapLibre se empaqueta aparte y se registra con `setWorkerUrl`.
- **Estilo:** el mapa estándar con color, `standardLight`. Pasa a `standardDark`, junto con toda la interfaz, si el sistema pide tema oscuro o si es de noche en la posición del usuario (del atardecer al amanecer, calculado con la fecha y las coordenadas). Se revisa como mucho una vez por minuto. Etiquetas del mapa en el idioma de la app.
- **POIs:** `CustomGeoJSONModule`, con un icono por estado:

  | Estado | Significado | Tratamiento |
  |---|---|---|
  | por escuchar | nunca anunciado ni escuchado | el icono de más contraste |
  | anunciado | en la Sesión | marca visible, sin llegar a apagarse |
  | escuchado | Narración empezada alguna vez | atenuado, con ✓ |
  | sonando | Narración en curso | acento, dibujado encima del resto |

- **Agrupación** por debajo de z14 (La Rioja frente a Madrid). Tocar un grupo acerca el zoom hasta separarlo.
- **Etiquetas** de los POIs a partir de z16, de 14–15 px y con halo marcado para leerse sobre el mapa con color. Son opcionales: desaparecen si colisionan.
- **Iconos** grandes (unos 30–34 px), legibles también con el mapa inclinado.
- **Círculos de radio** en el POI seleccionado y en los de radio ≥ 200 m, dibujados con turf.
- **Usuario:** flecha azul con rumbo y círculo de precisión azul.

## 6. Modo seguimiento

| Tramo | Velocidad | Zoom |
|---|---|---|
| A pie | < 6 km/h | 18 |
| Bici | 6–25 km/h | 16,5 |
| Urbano | 25–60 km/h | 15 |
| Carretera | > 60 km/h | 13,5 |

- **Cambio de tramo** con histéresis de ±1,5 km/h y transición suave (≈ 900 ms, *ease-out*).
- **Orientación:** norte arriba a pie. Rumbo arriba a partir de 15 km/h, y vuelta al norte por debajo de 12 km/h. En rumbo arriba, el usuario se coloca en el tercio inferior para ver lo que viene. La brújula fija el norte arriba a cualquier velocidad.
- **Rumbo:** `coords.heading` si existe y hay movimiento; si no, se calcula entre posiciones consecutivas.
- **3D:** a pie la cámara se inclina 55° con edificios en 3D; en bici o coche pasa a plano para ver más lejos. El botón 2D/3D fija la opción contraria a la que se ve, a cualquier velocidad, hasta que se vuelva a tocar.
- **Salir y volver:** arrastrar, hacer zoom o girar el mapa con los dedos abandona el Modo seguimiento, que no vuelve solo. **Recentrar** lo recupera con una animación de 600 ms.

## 7. Voz

- **Motor**, detrás de la interfaz `Narrador`:
  - **En castellano:** audios MP3 con la voz neuronal Elvira (es-ES), uno por frase (ADR 0006). Los genera el despliegue con `npm run voice` y la app los descarga al usarlos. Si falta el audio de una frase (frase nueva, sin red o fallo al generarla), esa frase la lee Web Speech.
  - **En inglés:** siempre Web Speech (ADR 0005).
- **Voz:** en castellano, Elvira. En ajustes se puede elegir también una voz del móvil. Entre las del móvil gana el locale exacto (es-ES, en-GB, en-US) y luego la calidad aparente; las voces Eloquence de iOS (Eddy, Flo, Grandma…) van al final.
- **Narración:** el título, seguido de la Descripción partida en frases, con una locución por frase. Así se evita el corte de Chrome a los ~15 s y el progreso es preciso.
- **Pausar/Seguir:** con un audio, pausa a media frase y sigue donde estaba. Con Web Speech, pausar cancela la frase en curso y seguir la repite desde el principio, porque `speechSynthesis.pause()` no es fiable en Android.
- **Desbloqueo:** en el toque de Empezar, una locución silenciosa y un audio de silencio (iOS).
- **Se detiene** al cerrar la página. Con la pantalla bloqueada no hay garantías (ADR 0002).

## 8. Datos

- **Carga:** los ficheros `data/<conjunto>.<es|en>.kml` del repo se descargan al arrancar, cada 30 min y al volver a la app si pasaron más de 30 min (ADR 0004). La lista de ficheros es `data/index.json`, que genera el despliegue. Un fichero sin `.es` o `.en` delante de `.kml` no se carga.
- **Varios ficheros** del mismo idioma se suman. Si un POI aparece en dos, gana el del fichero que va antes por orden alfabético.
- **Sin red o con un fichero roto:** se usa la última versión buena de cada fichero, guardada en el dispositivo. Si un fichero falla, los demás se cargan igual.
- **Emparejamiento:** por coordenadas, con tolerancia ≤ 1 m (ADR 0003). El castellano define qué POIs existen; el inglés solo aporta los textos.
- **Identidad del POI:** sus coordenadas redondeadas a 5 decimales. La Sesión y los Escuchados se guardan con esa clave.
- **Datos imperfectos:** se aceptan descripciones vacías, POIs de un solo párrafo y puntos de test. Una descripción con formato HTML se muestra como texto. Un POI sin vista guardada tiene un radio de 30 m. No hay informe para el Editor.
- **Versión nueva:** se aplica en cuanto no hay una Narración en curso, sin interrumpir nada.

## 9. Idiomas y textos

- **Idiomas:** castellano e inglés, con un único ajuste. No se usan cadenas sueltas en el código: todas salen de un diccionario ES/EN.
- **Tono:** frases cortas, en minúscula inicial, con verbos que dicen lo que pasa ("Escuchar", "Recentrar", "Empezar de cero"). Los errores explican qué ha pasado y qué hacer, sin disculpas.
- **Formatos:** las distancias se redondean a 5 m por debajo de 1 km ("120 m") y con un decimal por encima ("1,2 km" / "1.2 km").

| Clave | ES | EN |
|---|---|---|
| empezar | Empezar | Start |
| escuchar | Escuchar | Listen |
| pausar / seguir / parar | Pausar / Seguir / Parar | Pause / Resume / Stop |
| recentrar | Recentrar | Recenter |
| a continuación | A continuación | Up next |
| escuchado | Escuchado | Heard |
| solo en castellano | Solo en castellano | Spanish only |
| modo bolsillo | Modo bolsillo | Pocket mode |
| empezar de cero | Empezar de cero | Start over |

## 10. Sistema visual

- **Dirección elegida (#4):** la base es la C (Mínima): interfaz clara, el mapa manda y los botones del mapa son pequeños y discretos. De la B (Navegador) se toman las tarjetas, los ajustes, los marcadores de estado y el marcador del usuario. Referencia: `mocks/final/`.
- **Tipografía:** Noto Sans para el texto (es la de las etiquetas del mapa de TomTom) y Figtree en los títulos de las tarjetas y en las cifras. Las dos son libres, de Google Fonts.
- **Escala tipográfica** (16 px de base): 13 · 15 · 16 · 20 · 26 · 34.
- **Color** (paleta de la B): grafito para las tarjetas, rojo `#DF1B12` para lo que suena ahora, ámbar para anunciado, gris para escuchado y azul `#1F6FEB` para el usuario, Recentrar y el foco. Requisitos:
  - contraste AA en todo el texto;
  - los estados de los POIs se distinguen también por forma o marca, no solo por color;
  - el acento de "sonando" es único en la pantalla.
- **Iconos del mapa:** los mismos sobre el mapa claro y el oscuro. En modo oscuro solo cambian los colores de etiquetas, grupos y radios.
- **Movimiento:** solo para explicar un cambio (la tarjeta entra, el reproductor se transforma, la cámara recentra). Con `prefers-reduced-motion` las transiciones pasan a ser instantáneas.

## 11. Accesibilidad

- Contraste AA, foco visible y orden de tabulación lógico.
- Botones con nombre accesible.
- La tarjeta del Anuncio usa `aria-live="polite"`, para que un lector de pantalla también la anuncie.
- La app funciona con el texto al 200 %: la ficha hace scroll y ningún texto se corta.
- `<html lang>` sigue al idioma de la app.

## 12. Rendimiento

| Métrica | Objetivo |
|---|---|
| JS inicial (gzip) | ≤ 350 KB, incluido MapLibre, que con el SDK ya ocupa 315 KB. Lo comprueba la CI (`npm run size`). La burbuja, la ficha, los paneles, los avisos, los ajustes y el Modo bolsillo se cargan a demanda. Solo se publica la app: el mock final y la prueba de voz se abren en local con `npm run dev` |
| Primera pintura del mapa en 4G | < 2,5 s |
| Coste de una posición GPS | < 4 ms de trabajo en el hilo principal (distancias a 120 POIs y una actualización de fuente) |
| Pintado de los POIs | la fuente del mapa solo se actualiza cuando cambia un estado, no en cada posición |
| Batería | `watchPosition` con `enableHighAccuracy` y `maximumAge` de 1 s; sin temporizadores activos en el Modo bolsillo |

## 13. PWA y offline

- **Instalación:** manifest con nombre "ByTheWay", iconos y color de tema. Se puede usar desde el navegador o instalada.
- **Service worker:** precarga la app (la lista exacta de ficheros la genera el build). Una versión nueva de la app se instala en segundo plano y se usa al volver a abrirla. Los KML van primero a la red y, sin ella, a la última copia, para que una versión nueva llegue en menos de 30 min. Las tipografías y los audios de la voz se guardan al usarlos; los audios no caducan, porque su nombre es el hash de su texto. Sin red, lo ya escuchado suena con Elvira y el resto con la voz del móvil. Las teselas y estilos de TomTom no se precargan; solo quedan en la caché del navegador las ya vistas.
- **Wake Lock:** se pide al empezar y se re-adquiere en `visibilitychange`.

## 14. Limitaciones conocidas

- **Pantalla bloqueada:** con el móvil bloqueado no hay posiciones ni Anuncios nuevos (ADR 0002).
- **Voz en iOS:** Safari solo expone las voces básicas; las mejoradas no están disponibles para la web. Por eso el castellano usa audios pregenerados (ADR 0006).
- **Voz Elvira:** edge-tts usa el servicio de *Leer en voz alta* de Edge sin un acuerdo oficial. Si Microsoft lo corta, las frases nuevas se leen con la voz del móvil hasta cambiar de motor.
- **Rumbo a baja velocidad:** a pie es ruidoso, por eso se mantiene el norte arriba.

## 15. Pendiente de decidir

Nada por ahora. La voz se decidió en los ADR 0005 y 0006.

## 16. Trazabilidad

| Sección | Issues |
|---|---|
| 3 · Reglas | #6 |
| 4 · Pantallas | #8, #10, #11 |
| 5 · Mapa | #8 |
| 6 · Modo seguimiento | #9 |
| 7 · Voz | #2, #7, #30 |
| 8 · Datos | #5 |
| 12 y 13 · Rendimiento, PWA y offline | #12 |
