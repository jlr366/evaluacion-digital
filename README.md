# Plataforma - Examen

## Producción vs Local

Este proyecto es una aplicación estática que usa Firebase como backend.

- En producción, `firebase-config.js` conecta al proyecto `examen-aws` en Firebase.
- En local, `firebase-config.js` detecta `localhost`/`127.0.0.1` y conecta a emuladores de Firestore y Storage.

## Configuración local

1. Instalar Firebase CLI si no está instalado:

   `npm install -g firebase-tools`

2. Iniciar el servidor de archivos desde la carpeta `plataforma`:

   `python -m http.server 8000`

3. Iniciar emuladores locales desde la carpeta `plataforma`:

   `firebase emulators:start --only firestore,storage`

4. Abrir en el navegador:

   `http://localhost:8000/examen.html?id=demo_examen_plataforma&preview=1`

## Notas

- El backend local está representado por los emuladores de Firebase.
- En producción real, el código sigue usando Firestore/Storage de `examen-aws`.
- Si quieres probar el flujo completo de PDF e imágenes localmente, usa el servidor HTTP + emuladores.

## Impresión de exámenes

- La aplicación permite generar PDFs de los exámenes desde la interfaz (botón de imprimir/exportar).
- Estos PDFs pueden usarse en los manuales del curso o en materiales promocionales (flyers, ofertas, etc.).
- Para pruebas locales de generación de PDF con imágenes incluidas, asegúrate de ejecutar el servidor HTTP y los emuladores (véase la sección "Configuración local").

Nota: la generación de PDF recupera imágenes desde Storage; si trabajas en local usa el emulador de Storage o configura CORS en tu bucket de Firebase cuando pruebes contra el entorno real.
