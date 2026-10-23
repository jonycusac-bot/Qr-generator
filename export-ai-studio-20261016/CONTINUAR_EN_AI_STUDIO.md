# Continuación del gestor QR en AI Studio

## Objetivo del usuario
Mantener el repositorio propio y probar la aplicación con Vercel + Neon. La posible migración a Microsoft 365 queda para más adelante. Continuar sobre la aplicación existente sin reconstruir su interfaz.

## Estado real al exportar (16/10/2026)
- React + Vite + TypeScript, servidor Express en server.ts.
- database.ts usa node:sqlite, NO Postgres. El servidor conserva estado y sesiones en memoria y persiste en SQLite.
- Neon CLI 8.7.2 y plugin neon-postgres 2.3.0 se instalaron en el PC de origen. Estas instalaciones globales no se transportan en este ZIP.
- El plugin incluye skills y MCP https://mcp.neon.tech/mcp. No se comprobó una llamada MCP autenticada.
- Proyecto Neon existente: proud-forest-44476300 (Qr-Code Generator).
- Organización: org-super-feather-28573664.
- Rama: production, ID br-small-hill-b5x2s5h3; región aws-us-east-2; Postgres 18.
- neon deploy terminó correctamente: "No changes — branch production already matches the policy", "Utilized services: Postgres", "Pulled 3 Neon variables into .env.local".
- Variables descargadas en origen: DATABASE_URL, DATABASE_URL_UNPOOLED, NEON_BRANCH. Sus valores privados NO se incluyen en este paquete.
- neon.ts se conserva tal como está; no activar Auth, Storage, Functions, Realtime o AI Gateway sin necesidad o petición.
- npm run build pasó: 2323 módulos, Vite completó y esbuild generó dist/server.cjs. Aviso por bundle mayor de 500 kB.
- No se ha implementado ni verificado todavía una conexión de la aplicación con Neon. No está desplegada en Vercel.

## Trabajo pendiente autorizado
1. Leer https://neon.com/.well-known/agent-skills/neon/SKILL.md y la skill neon-postgres; inspeccionar antes de cambiar.
2. Preservar configuración existente. Usar npm (hay bun.lock histórico, pero Bun no está instalado en origen). No crear otro proyecto Neon.
3. Configurar credenciales en secretos del entorno, nunca en código ni variables VITE_ públicas. Solicitar al usuario DATABASE_URL y DATABASE_URL_UNPOOLED por el mecanismo privado disponible, sin pegarlas en el chat.
4. Adaptar database.ts y server.ts a Postgres con un driver adecuado al runtime. La skill actual recomienda pg para Express/Node y Vercel Fluid compute, y attachDatabasePool en Vercel. Revisar documentación actual antes de implementar.
5. Versionar el esquema/migraciones; usar conexión directa para migraciones y pooled para tráfico de la aplicación.
6. Evitar trasladar simplemente el estado global de Express a Vercel: múltiples instancias pueden perder cambios. Consultar datos y sesiones persistentes por petición, y usar transacciones para escrituras relacionadas. Evitar borrar y reescribir tablas completas con una copia antigua de memoria.
7. Conservar funcionalidades: instalaciones, usuarios, autenticación propia, sesiones, historial de destinos, escaneos y redirecciones /r/:shortCode. No sustituir autenticación por Neon Auth sin petición.
8. Empezar con datos ficticios. No importar datos locales privados automáticamente. Los ficheros de data/ del PC no están incluidos.
9. Revisar las claves de demostración incluidas en el servidor antes de cualquier publicación pública y configurar credenciales privadas apropiadas.
10. Ejecutar npm run lint, npm run test:db (adaptándolo si corresponde) y npm run build. Iniciar la aplicación y probar login, creación/edición de instalación, redirección QR, registro de escaneo, sesiones y persistencia tras reiniciar. Reportar resultados reales, fallos y pendientes.
11. Preparar Vercel cuando Neon funcione. La publicación pública requiere revisar antes las credenciales de demo y confirmar el destino.

## Archivos incluidos
Código src/, recursos public/, server.ts, database.ts y su prueba, configuraciones de compilación, package.json/package-lock.json, neon.ts y documentación. .env.example es solo una plantilla.

## Exclusiones
.env.local, .env, .neon, credenciales CLI/MCP, data/, node_modules/, dist/, .git/ y ZIP antiguos. No se exportan cuentas, sesiones, datos locales ni configuración global de Codex.

## Arranque local del código actual
Node >=22.13 (recomendado 24), npm ci y npm run dev. El servidor crea SQLite y carga ejemplos si no hay datos locales. Para producción: npm run build y npm start con NODE_ENV=production. El entorno destino debe soportar Express y node:sqlite mientras no se implemente Postgres.
