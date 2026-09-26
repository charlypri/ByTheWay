# Prueba de voz en móviles reales (#2)

Comprueba si la voz que trae el móvil vale para ByTheWay, o si hacen falta audios MP3 pregenerados. La página de prueba hace lo mismo que la app: dice el Anuncio (solo el título) y lee la Narración frase a frase.

**Página:** en local, con `npm run dev -- --host`, en `http://<IP del ordenador>:5173/ByTheWay/probe/voz/` (GitHub Pages solo publica la app).

## Con qué se prueba

Una pasada completa en cada uno. Cada pasada acaba con un informe.

1. Android, en Chrome.
2. iPhone, en Safari.
3. iPhone, con la página de prueba instalada: en Safari, *Compartir → Añadir a pantalla de inicio*, y ábrela desde el icono *Prueba de voz*. Hay que instalar esta página, no la app: la app instalada no puede abrir otras páginas.

Antes de empezar:

- Volumen alto, sin auriculares.
- En el iPhone, el interruptor de silencio **quitado** (en naranja no). Al final hay una prueba con él puesto.
- Wi-Fi o datos, da igual. Algunas voces vienen de la red y se nota en el informe.

## Pasos

Los pasos van en el orden de la página. Marca lo que corresponda en la página: el informe lo recoge.

1. **Voces de este móvil**
   - [ ] Hay al menos una voz en castellano y una en inglés.
   - [ ] Apunta en el comentario si alguna voz de la lista suena claramente mejor que la elegida. Para comparar, cámbiala en el desplegable y repite el Anuncio.
2. **Anuncio**
   - [ ] Toca *Oír en castellano* una sola vez. Marca cómo sonó esa primera vez: entera, con retraso, cortada al principio o nada.
   - [ ] Repite con *Oír en inglés*. Marca si se entiende bien.
3. **Anuncio diferido.** Es lo que más importa en el iPhone: en la app, el Anuncio suena sin que toques nada.
   - [ ] Toca *Preparar*, deja el móvil quieto y **no toques la pantalla**. A los 10 s debe sonar un aviso de dos notas y un título. Marca qué oíste.
   - [ ] Toca *Preparar y bloquear*, bloquea el móvil unos 10 s, desbloquéalo y vuelve a la página sin tocarla. A los 3 s debe sonar otro título. Marca si lo oíste.
4. **Narración**
   - [ ] Escucha en castellano al menos un minuto. ¿Escucharías así una historia de dos minutos?
   - [ ] Pulsa *Pausar*, espera unos segundos y pulsa *Seguir*. ¿Retoma en la frase donde estaba?
   - [ ] Escucha un poco en inglés. Si suena peor que en castellano, apúntalo en el comentario.
5. **Locución larga de una vez**
   - [ ] Toca *Empezar* y déjala terminar (algo más de un minuto). La página dice sola si se cortó.
6. **Pausa del navegador**
   - [ ] Toca *Empezar*. Marca si siguió donde se paró, volvió a empezar o se quedó muda.
7. **Pantalla apagada**
   - [ ] Toca *Empezar y bloquear*, bloquea el móvil unos 20 s y vuelve. La página mide si la voz siguió. Que se pare es lo esperado (ADR 0002). Lo importante es saber qué hace cada móvil.
8. **Solo en el iPhone, con el interruptor de silencio puesto**
   - [ ] Repite *Oír en castellano* y el paso 3 (*Preparar*). Apunta en el comentario si se oyen la voz y el aviso.
9. **Informe**
   - [ ] *Copiar informe* (o *Compartir*) y pégalo como comentario en el issue #2, con una línea del modelo del móvil y la versión del sistema.

## Cómo se decide

Se decidió antes de ver los resultados:

- **Web Speech se queda en la 0.1.0** salvo que, en el Android o en el iPhone, pase alguna de estas dos cosas:
  - no hay voz en castellano;
  - el Anuncio diferido no suena.
- **Si la calidad es regular** («Regular» o «Con esfuerzo»), se queda Web Speech y se abre una issue para estudiar los MP3 después.

La decisión queda en un ADR en `docs/adr/`.

## Resultado

Probado el 26 de septiembre de 2026 en Android (Chrome) e iPhone (Safari e instalada): todo bien. Se queda Web Speech ([ADR 0005](../adr/0005-voz-con-web-speech.md)).
