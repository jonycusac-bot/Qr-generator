# Qr generator

Gestor de instalaciones con códigos QR dinámicos, etiquetas, perfiles de equipo y estadísticas.

## Pruebas locales

Requiere Node.js 22 o superior.

1. Copia `.env.example` como `.env.local`.
2. Sustituye `DATABASE_URL` por la cadena **Pooled connection** de Neon.
3. Ejecuta:

```sh
npm ci
npm run db:check
npm run dev
```

Abrir http://localhost:3000. El panel abre directamente, sin contraseña ni PIN.
Todos los perfiles tienen acceso completo. La selección de perfil sirve para asignaciones y filtros, y no verifica la identidad.
Los permisos de las carpetas OneDrive/SharePoint siguen siendo responsabilidad de Microsoft 365.

## Compilar y arrancar

```sh
npm test
npm run lint
npm run build
npm start
```

En Windows también se pueden usar `compilar.bat`, `iniciar.bat` y `actualizar-pc.bat`.
Con `DATABASE_URL`, tanto el PC como Vercel utilizan la misma base Neon. Sin esa variable, el PC conserva el modo local de emergencia en `data/db.json`.
Para probar desde un móvil, configurar como URL base la dirección del ordenador en la red. Ambos dispositivos deben poder acceder al puerto del servidor.

## Vercel

El frontend se publica desde `dist`; `api/index.ts` atiende `/api/*` y `/r/*`.
La única variable obligatoria es `DATABASE_URL`, usando la cadena **Pooled connection** de Neon con `sslmode=require`.
Sin base de datos la API devuelve 503. El panel puede mostrar datos de ejemplo o una copia del navegador, pero eso no activa las redirecciones en el servidor.
La aplicación crea automáticamente la tabla `qr_app_state` y serializa las operaciones para que Vercel y el PC no sobrescriban cambios simultáneos.
No hay claves de acceso al panel. Si se publica por Internet, cualquier visitante puede gestionar instalaciones y usuarios.

## Actualizar el PC

Después de publicar cambios en GitHub, abre la carpeta del proyecto en Windows y ejecuta `actualizar-pc.bat`. El script descarga los cambios, instala exactamente las dependencias, ejecuta las pruebas y recompila.

Nunca guardes `.env.local` ni la contraseña de Neon en GitHub.

