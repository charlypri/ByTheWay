# Pruebas de campo en móviles reales (#14)

Comprueba la app entera en un Android y en un iPhone antes de la 0.1.0. Primero en casa con el simulador, luego con un paseo real por el Retiro. Los términos (Entrada, Anuncio, Narración, Sesión, Escuchado…) son los de [CONTEXT.md](../../CONTEXT.md). Las reglas están en la [especificación](../spec-frontend.md).

**App:** https://charlypri.github.io/ByTheWay/ (con el simulador: https://charlypri.github.io/ByTheWay/?sim)

## Antes de empezar

- **Móviles:** Android con Chrome e iPhone con Safari. En cada uno, la app en el navegador y también instalada:
  - Android: menú ⋮ → *Añadir a pantalla de inicio* o *Instalar app*.
  - iPhone: *Compartir → Añadir a pantalla de inicio*.
- **Versión:** en *Ajustes*, abajo, se ve la versión y el commit. Apúntalos en cada informe. Si publico un arreglo durante las pruebas, cierra la app del todo (también del selector de apps), vuelve a abrirla y comprueba que el commit ha cambiado. Puede hacer falta abrirla dos veces.
- **Puntos de prueba:** mientras dura el #14, el dataset tiene dos:
  - *Punto de test*, con 20 km de radio. Cubre todo Madrid, así que será el primer Anuncio casi siempre.
  - *Punto de test Delicias*, con 50 m, cerca de casa.

  Se quitan al cerrar la fase.

## Parte A: en casa, con el simulador

El simulador solo funciona en el navegador: la app instalada no admite `?sim`. Abre `…/ByTheWay/?sim` y toca el chip *Simulador* arriba a la izquierda.

1. **Inicio**
   - [ ] La primera vez sale en castellano, aunque el móvil esté en inglés.
   - [ ] *Empezar* pide la ubicación una sola vez y la pantalla de inicio se va.
   - [ ] Cambia a EN en el inicio, recarga: se acuerda del idioma. Vuelve a ES.
2. **Anuncio y Narración** (en el simulador: *A pie*, reloj *4×*)
   - [ ] Al entrar en un lugar suena su título sin tocar nada, y sale la tarjeta con *Estás aquí*.
   - [ ] *Escuchar* lee la Descripción. En el reproductor, *Pausar* y *Seguir* retoman en la misma frase, y *Parar* lo cierra.
   - [ ] Mientras suena una Narración, al entrar en otro lugar suena un aviso breve y aparece *A continuación: …*. La voz no se interrumpe.
   - [ ] Al terminar la Narración se anuncia el siguiente, si sigues dentro de su radio.
   - [ ] La tarjeta desaparece unos 30 s después de salir del radio. También se puede descartar deslizándola.
3. **Mapa y ficha**
   - [ ] Tocar un lugar abre la burbuja con título y distancia. Tocar la burbuja abre la ficha.
   - [ ] La ficha se cierra deslizando hacia abajo, y el mapa vuelve a seguirte si no lo moviste.
   - [ ] Los lugares escuchados salen atenuados con ✓, y los anunciados en ámbar.
4. **Modo seguimiento, zoom y 3D**
   - [ ] *A pie*: mapa inclinado en 3D, norte arriba, muy cerca (zoom 18).
   - [ ] *En bici*: se aleja un poco y pasa a plano, con el rumbo arriba.
   - [ ] *En coche*: se aleja más.
   - [ ] Cada cambio es suave, sin saltos.
   - [ ] Arrastra el mapa con el dedo: deja de seguirte y aparece *Recentrar*, que te devuelve.
   - [ ] La brújula fija el norte arriba y la segunda vez lo suelta. *3D* cambia entre inclinado y plano.
5. **Ajustes**
   - [ ] Cambiar el idioma cambia a la vez los textos, la voz y las etiquetas del mapa. **Apunta los nombres del mapa de TomTom que sigan en inglés estando en castellano**, con una captura.
   - [ ] La lista de voces ofrece las del idioma actual. Si eliges otra, se oye en el siguiente Anuncio.
   - [ ] *Empezar de cero* pide confirmación. Luego los lugares vuelven a anunciarse.
6. **Sesión tras recargar**
   - [ ] Tras un par de Anuncios y una Narración, recarga la página. Los anunciados siguen en ámbar, el escuchado con ✓, y no se vuelven a anunciar al pasar.
7. **Modo bolsillo**
   - [ ] Se abre desde *Ajustes*: pantalla negra con *Toca dos veces para salir*.
   - [ ] Con el simulador andando, los Anuncios se siguen oyendo y la pantalla no se enciende.
   - [ ] Al salir con doble toque se ve la tarjeta del último Anuncio.
8. **Pantalla encendida (Wake Lock)**
   - [ ] Con la app abierta y sin tocar nada, la pantalla no se apaga en 3 minutos, aunque el móvil la apague a los 30 s.
9. **Tema de noche**, después de las 20:00 más o menos
   - [ ] La app y el mapa pasan a oscuro solos, aunque el móvil esté en tema claro.
10. **Sin red**, con la app instalada
    - [ ] Ábrela una vez con red y ciérrala.
    - [ ] Pon el modo avión y ábrela: arranca, se ven los lugares y el mapa ya visto, y puedes abrir una ficha y escucharla.

## Parte B: paseo real por el Retiro

Unos 30–45 min, con la app **instalada** en cada móvil (o uno por paseo) y el GPS real.

- [ ] **Al salir de casa**, apunta la batería de cada móvil. En Android, además, el contador de datos móviles de Chrome (*Ajustes → Red → Uso de datos*). En el iPhone, *Ajustes → Datos móviles → Safari* o la app.
- [ ] **Entradas y Anuncios:** entra en varios lugares, puertas y estatuas. Suena el título al entrar, no antes ni mucho después. Apunta los que se anuncian lejos (más de 20–30 m fuera del radio) o no se anuncian.
- [ ] **Precisión:** si la flecha se pone gris (GPS débil), apunta dónde y cuánto dura.
- [ ] **Zoom y saltos del GPS** (lo que más interesa):
  - Andando o parado, ¿el mapa se aleja solo como si fueras en bici o en coche?
  - Si pasa, apunta la hora y dónde estabas.
  - Para verlo en directo, abre `?sim` en el navegador, toca *Usar mi GPS* en el panel del simulador y mira la línea de abajo: precisión, velocidad calculada y zoom.
- [ ] **Rumbo:** a pie el norte se queda arriba. La flecha apunta hacia donde vas, sin girar sola estando parado.
- [ ] **Cola:** escucha una Narración mientras andas y entra en otro lugar. Comprueba que el Anuncio espera y luego suena, o se descarta si ya saliste.
- [ ] **Modo bolsillo en el bolsillo:** 10 minutos con el móvil en el bolsillo y la pantalla encendida en Modo bolsillo. ¿Se oyen los Anuncios? ¿Se calienta el móvil?
- [ ] **Pantalla bloqueada** (para saberlo, no es un fallo): bloquea el móvil al entrar en un lugar. Lo esperado es que no suene nada (ADR 0002).
- [ ] **Al volver**, apunta la batería y los datos otra vez.

## Parte C: cerca de casa

- [ ] Pasa por *Punto de test Delicias* (50 m) andando, y otra vez en bici o en coche si puedes. Apunta si el Anuncio suena a tiempo a cada velocidad.

## Cómo pasarme lo que encuentres

Un comentario en el issue #14 por móvil, con este formato:

```
Móvil: <modelo>, <Android xx / iOS xx>, <Chrome / Safari / instalada>
Versión: <la de Ajustes>
Batería: <inicio> → <fin> en <minutos>. Datos: <MB>

Fallos:
1. Qué hice: …
   Qué esperaba: …
   Qué pasó: …
   (captura o vídeo si puedes)

Casillas sin marcar: 2.4, 5.1…
```

Qué se arregla antes de la 0.1.0 y qué pasa a issue:

- **Se arregla antes de la 0.1.0:** lo que rompe el paseo (no avisa o avisa mal, la voz no suena, no arranca sin red, se cuelga, el zoom salta sin motivo) y lo que se arregle en poco rato.
- **Pasa a una issue para después:** textos, colores, pulido y los nombres de TomTom en inglés si no dependen de la app.
