<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6ba2ccfc-01fd-4451-bb1d-c3ebcb0e42fc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Base de datos SQLite

Requiere Node.js 22.13 o superior (recomendado: Node.js 24). Ejecuta npm run dev, o npm run build y npm start para producción.

El servidor crea data/app.sqlite automáticamente e importa data/db.json una sola vez, conservando instalaciones, usuarios, escaneos, historial y credenciales. El JSON original no se modifica. A partir de entonces, la fuente de datos es SQLite. Las sesiones también se guardan para sobrevivir a reinicios. Si el JSON no se puede leer, el arranque falla para evitar sustituir datos por ejemplos.

Diseñado para una instancia del servidor en el PC de la empresa. Todos los dispositivos deben acceder a esa misma instancia. Para usar varias instancias habría que adaptar el almacenamiento compartido. Guarda la carpeta data en un disco persistente. Para realizar una copia de seguridad, detén el servidor y copia data/app.sqlite junto con cualquier archivo app.sqlite-wal y app.sqlite-shm que exista.

Verificación: npm run lint, npm run test:db y npm run build.
