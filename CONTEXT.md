# Bytheway

Guía turístico virtual para el móvil: anuncia en voz alta los lugares curados a medida que el usuario se acerca a ellos, y los narra si el usuario lo pide. Por convención editorial, cada narración termina con un "Por cierto…", la anécdota que da nombre a la aplicación.

## Language

### Contenido

**Punto de interés (POI)**:
Lugar curado por el Editor, con posición, título, Descripción y Radio de acción. Su identidad es su posición: las versiones de un mismo POI en distintos idiomas comparten coordenadas.
_Avoid_: lugar, marcador, spot, placemark (placemark es solo su representación en KML)

**Radio de acción**:
Distancia en metros alrededor de un POI dentro de la cual se considera que el usuario está en ese POI. Los radios de distintos POIs pueden solaparse o contenerse (un parque de 1 km que contiene estatuas de 20 m), y cada POI se evalúa de forma independiente.
_Avoid_: rango, geofence, distancia de disparo

**Descripción**:
Texto único del POI, tal como lo escribe el Editor, que se lee en la Narración. Por convención editorial suele terminar con un párrafo que empieza por "Por cierto," (en inglés, "By the way,"), pero la aplicación no lo divide en partes.
_Avoid_: contenido, ficha, resumen

### Personas

**Editor**:
Persona que cura los POIs en Google Earth y los exporta a KML, un fichero por idioma.
_Avoid_: curador, administrador

### Uso

**Entrada**:
Momento en que el usuario pasa a estar dentro del Radio de acción de un POI, confirmado por posiciones GPS consecutivas. Es lo único que puede provocar un Anuncio.
_Avoid_: disparo, trigger

**Anuncio**:
El título de un POI dicho en voz alta, acompañado de una tarjeta desde la que se puede lanzar su Narración. La aplicación lo lanza sola tras una Entrada. Nunca interrumpe una Narración: espera a que termine.
_Avoid_: reproducción automática, alerta, notificación

**Narración**:
Lectura en voz alta de la Descripción completa de un POI. Solo empieza cuando el usuario la pide, desde la tarjeta del Anuncio o desde la ficha del POI.
_Avoid_: reproducción manual, audio, locución

**Sesión**:
Conjunto de POIs anunciados en las últimas 12 horas. Mientras un POI está en la Sesión, una nueva Entrada no lo vuelve a anunciar. Cada POI sale de la Sesión 12 horas después de su Anuncio, o antes si el usuario decide Empezar de cero.
_Avoid_: visita, recorrido

**Escuchado**:
Estado de un POI cuya Narración el usuario ha empezado alguna vez. Un POI escuchado no vuelve a anunciarse, pero se puede volver a narrar a mano desde su ficha. Solo deja de estarlo si el usuario decide Empezar de cero.
_Avoid_: visto, visitado, completado

**Empezar de cero**:
Acción del usuario que vacía la Sesión y olvida todos los Escuchados, de modo que cada POI vuelve a anunciarse como si fuera la primera visita.
_Avoid_: reiniciar sesión, borrar escuchados, resetear

**Modo seguimiento**:
Estado del mapa en el que la cámara sigue la posición del usuario y ajusta el zoom a su velocidad. Se abandona en cuanto el usuario mueve el mapa con el dedo y solo se recupera con "Recentrar".
_Avoid_: modo navegación, follow-me

**Modo bolsillo**:
Pantalla negra, con el mínimo brillo, que mantiene la guía activa mientras el móvil va en el bolsillo con la pantalla encendida.
_Avoid_: modo ahorro, pantalla apagada
