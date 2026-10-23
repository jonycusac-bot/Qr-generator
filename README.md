# QR Generator

Gestor de instalaciones con QR dinámicos, etiquetas y estadísticas.

## Arquitectura
- Vercel: frontend React/Vite y servidor Express (`api/index.ts`).
- Neon/PostgreSQL: instalaciones, destinos, perfiles e historial de escaneos.
- OneDrive/SharePoint: documentación y permisos de acceso a los documentos. La aplicación guarda enlaces, no sincroniza archivos ni concede permisos de Microsoft.
- GitHub: código, historial y actualizaciones.

El panel y las redirecciones `/r/:shortCode` utilizan la misma API y los mismos datos. No se utiliza Firebase/Firestore. El almacenamiento del navegador solo conserva preferencias de perfil y dirección base; no se considera una base de datos ni confirma guardados.

## Ejecutar en Windows
Node.js 22 o superior (recomendado 24), npm.

1. `npm ci`.
2. Configura `.env.local` siguiendo `.env.example`: `DATABASE_URL` pooled para la aplicación y `DATABASE_URL_UNPOOLED` directa para las migraciones.
3. Primera instalación: `npm run db:migrate`. Es compatible con la tabla existente y no borra registros.
4. `npm run db:check`.
5. `npm run dev`, o `npm run build` y `npm start`.
6. Abre http://localhost:3000. Para el móvil en la misma Wi-Fi, utiliza la dirección LAN del PC y permite el acceso al puerto 3000.

Sin conexión a Neon, la API de datos devuelve 503 y el panel muestra el error. No crea instalaciones ficticias ni confirma cambios que no se hayan guardado.

## Publicar en Vercel
Importa este repositorio y configura `DATABASE_URL` y `PANEL_PASSWORD` como secretos privados del servidor. Configura `VITE_QR_BASE_URL` con la dirección HTTPS pública estable (esta dirección no es un secreto). Nunca uses prefijos `VITE_` para credenciales. `vercel.json` publica `dist` y dirige `/api/*` y `/r/*` a Express. Para la primera base nueva, ejecuta previamente la migración con una conexión directa.

Usa un dominio HTTPS estable en los QR definitivos. Los códigos existentes son permanentes; puede cambiarse su destino sin reimprimirlos. Los destinos deben ser HTTP/HTTPS; los códigos duplicados se rechazan. Instalaciones pausadas o archivadas no redirigen. Los errores de base de datos no se ocultan con un almacenamiento alternativo.

La demo pública protege la API de gestión mediante `PANEL_PASSWORD`. La clave se introduce en el panel y solo se mantiene en memoria durante esa sesión de la página. Los enlaces `/r/*` siguen siendo públicos y no piden esta clave. Los perfiles del equipo son descriptivos, no cuentas individuales. Sin `PANEL_PASSWORD`, Vercel rechaza las operaciones de gestión. En desarrollo local sin esta variable se permite el acceso de pruebas.

## Datos existentes
Se mantiene la tabla `qr_app_state` y su formato JSONB para conservar las instalaciones y los QR existentes. Las escrituras se confirman antes de responder. Una cola local y un bloqueo transaccional de Postgres evitan sobrescrituras entre solicitudes e instancias. Las lecturas no reescriben el estado si no cambia. Esta estructura está pensada para el piloto; un volumen elevado de escaneos requerirá separar tablas y consultas.

No se borran datos remotos de Firestore ni archivos anteriores de `data/`. Los registros que solo existan en Firestore o en el navegador no se importan automáticamente a Neon: hay que exportarlos, revisar duplicados por ID/código y hacer una importación controlada. No pulsar «Restaurar Datos de Demostración» para migrar; esa acción sustituye los datos de Neon por ejemplos.

El panel refresca los datos cada 30 segundos y al recuperar el foco. Los guardados se reflejan al confirmarlos el servidor. Las estadísticas no incluyen cifras de relleno.

## Verificación
- `npm test`: CRUD, códigos únicos y permanentes, destino actualizado, escaneos concurrentes, archivo/pausa y errores de lectura/guardado sin falsas confirmaciones.
- `npm run lint`: comprobación TypeScript del código activo.
- `npm run build`: compilación para producción.
- `npm run test:neon`: prueba real contra Neon con datos ficticios en un esquema temporal. Verifica persistencia y que el estado de producción no cambie; elimina solo su propio esquema de prueba.

El ZIP y la carpeta `export-ai-studio-20261016` son una entrega histórica; no forman parte de la aplicación activa ni del despliegue Vercel. No subir `.env.local`, credenciales ni datos privados a GitHub.

## Demo publicada

Panel: https://qr-generator-three-opal.vercel.app

QR de ejemplo: https://qr-generator-three-opal.vercel.app/r/demo-dinamico

La clave del panel está en el archivo local privado .demo-access.txt, excluido de Git y de Vercel. Consulta demo/COMO_PROBAR.md para la demostración A/B. Los QR de localhost deben regenerarse con la dirección HTTPS pública.

