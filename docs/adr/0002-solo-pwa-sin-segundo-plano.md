# La 0.1.0 es solo PWA y no funciona con la pantalla bloqueada

Queríamos que la guía siguiera narrando con el móvil bloqueado, pero una PWA no recibe posiciones GPS ni puede lanzar audio nuevo con la página oculta: ni en iOS Safari ni de forma fiable en Android Chrome. Solo un contenedor nativo (p. ej. Capacitor con geolocalización en segundo plano) lo resuelve. Para la 0.1.0 elegimos el 100% web, sin tiendas ni builds nativos, y aceptamos que la guía solo funciona con la pantalla encendida.

## Consequences

- Hay que mitigar el consumo y la incomodidad de llevar la pantalla encendida (Screen Wake Lock, modo de pantalla atenuada).
- Que no haya disparos con la pantalla bloqueada es una limitación conocida, no un bug.
- El código debe mantener el acceso a la posición y al audio detrás de interfaces propias, para poder envolverlo después en un contenedor nativo sin reescribir la lógica.
