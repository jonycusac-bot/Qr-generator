# QR Dinámico — estado para continuar

Actualizado: 23 de octubre de 2026.
Carpeta de trabajo: `C:\Users\Usuario\Desktop\QR`.
Repositorio: https://github.com/jonycusac-bot/Qr-generator (rama main).
Web publicada: https://qr-generator-three-opal.vercel.app
Proyecto Vercel: qr-generator, equipo jonaans-projects.
Último despliegue funcional de la interfaz: dpl_8TzZ1tWRqtUMC1mtYUsKugcoY6Gu.

## Decisiones confirmadas
- Vercel: web React/Vite, API Express y redirecciones QR.
- Neon/PostgreSQL: instalaciones, destinos, perfiles e historial de escaneos.
- OneDrive/SharePoint (u otro enlace web accesible): documentación. Cambiar de proveedor solo requiere actualizar el destino y sus permisos.
- GitHub: código e historial. Microsoft 365 como posible destino futuro, sin migración acordada ahora.

## Qué funciona
El mismo QR conserva su URL pública `/r/codigo` y redirige al destino actual mediante HTTP 302 sin caché. Se ha demostrado cambiar A → B sin reimprimir el QR. El código aa-1k1r fue comprobado con su destino SharePoint; los permisos de Microsoft siguen siendo independientes.
Panel: clave compartida de demostración (PANEL_PASSWORD). La clave se introduce en la pantalla de inicio y solo se mantiene en memoria de esa página. Los QR son públicos; no piden la clave del panel. Los perfiles del equipo son descriptivos, no cuentas individuales.

## Trabajo implementado
- Eliminada la integración activa de Firebase/Firestore y su dependencia. Retirados SQLite y la pantalla de acceso obsoleta.
- Una sola API para panel y QR, sin guardados ficticios en el navegador ni alternativa local que oculte errores.
- Transacciones, cola por proceso y bloqueo de Postgres para conservar cambios simultáneos entre PC y Vercel. Respuestas de éxito solo después de confirmar la escritura.
- Se mantiene `qr_app_state` en JSONB, con el formato existente; los datos existentes no se borraron ni reinicializaron.
- Códigos QR únicos y permanentes, destinos HTTP/HTTPS válidos, validación y escape de HTML. Instalaciones pausadas/archivadas no redirigen.
- Estadísticas sin números aleatorios ni ubicaciones inventadas. No se trunca el historial de nuevos escaneos.
- Dependencias npm sincronizadas; eliminadas dependencias sin uso. Estadísticas cargadas por separado para reducir el JavaScript inicial.
- Pegatina QR ampliada dentro de su marco, manteniendo cuatro módulos blancos de seguridad.
- Cabecera: sin subtítulo ni etiqueta OneDrive/SharePoint; título reducido un 25 % respecto a la versión ampliada; pestañas más grandes y alineadas a la izquierda.
- Tarjetas: oculta la etiqueta técnica `/r/codigo`.
- Acceso: logo de Illusion, título QR Dinámico, texto breve y sin aviso rojo inicial; error solo después de intentar acceder.
- Retirado de la interfaz el botón Restaurar Datos de Demostración y su confirmación. La API interna de reset sigue existiendo detrás de la clave; no se ha invocado ni se utiliza para continuar.

## Archivos importantes
- `src/App.tsx`: acceso, navegación de vistas y diálogos.
- `src/components/Header.tsx`: cabecera.
- `src/components/ProjectList.tsx`: tarjetas y acciones.
- `src/context/AppContext.tsx`, `src/utils/api.ts`: datos del panel y errores de la API.
- `server.ts`, `state-store.ts`, `api/index.ts`: API unificada y persistencia Neon.
- `src/utils/qrGenerator.ts`: diseño y exportación del QR.
- `vercel.json`, `.vercelignore`: publicación.
- `migrations/001-state.sql`, `scripts/migrate.mjs`: esquema compatible.
- `demo/COMO_PROBAR.md`: guía A/B; `demo/QR-demostracion.png` y `demo/QR-aa-1k1r.png`: QR públicos de prueba.
- `public/demo/`: páginas A/B de ejemplo.

## Credenciales privadas — solo local/secretos Vercel
`.env.local`: DATABASE_URL, DATABASE_URL_UNPOOLED, PANEL_PASSWORD, VITE_QR_BASE_URL y posibles credenciales temporales de herramientas.
`.demo-access.txt`: dirección y clave del panel para el propietario.
`.vercel/`: vínculo local con Vercel.
Estos archivos NO deben añadirse a Git, a ZIP compartidos ni copiar sus valores al chat o documentación pública. Se mantienen en esta carpeta para continuar. VITE_QR_BASE_URL es una URL pública; las contraseñas y la base de datos jamás deben llevar prefijo VITE_.

## Verificación y arranque
Node.js 24 y npm. Ejecutar en esta carpeta:

```powershell
npm ci
npm test
npm run lint
npm run build
npm run db:check
npm start
```

Para desarrollar: `npm run dev`.
Para probar persistencia real sin alterar registros existentes: `npm run test:neon` (esquema temporal; requiere conexión directa y pooled). Pruebas de acceso con/sin clave incluidas en npm test.
No ejecutar `npm ci` mientras un servidor antiguo de esta carpeta mantenga bibliotecas nativas abiertas: detenerlo primero si Windows informa EPERM.
Primera instalación de una base nueva: `npm run db:migrate`; no es necesario recrear la base existente.

## Publicar cambios futuros
Tras verificar, guardar en Git y subir main. La sesión de Vercel de este PC está autorizada. El proyecto ya está vinculado en .vercel/:

```powershell
npx --yes vercel@latest deploy --prod --yes --scope jonaans-projects
```

Esperar READY y verificar la dirección pública. Utilizar el dominio estable qr-generator-three-opal.vercel.app para los QR de prueba; nunca localhost ni el dominio único de un despliegue. Para pegatinas definitivas conviene un dominio propio estable.

## Límites y asuntos para otro día
- Los registros exclusivos de Firestore o del antiguo navegador no se migraron automáticamente; tampoco se borró esa base remota. Si hacen falta, exportarlos y revisar duplicados antes de importar.
- La clave compartida sirve para la demo; cuentas individuales y permisos de empleados requerirían trabajo adicional.
- El estado JSONB completo sirve para el piloto. Si crece el volumen, separar tablas y consultas.
- El historial export-ai-studio-20261016 es una entrega antigua excluida de TypeScript y Vercel; no continuar desde esa copia.
- No hay otro cambio funcional solicitado pendiente: esperar la siguiente indicación del propietario.

## Mensaje para retomar
«Continuamos QR Dinámico en C:\Users\Usuario\Desktop\QR. Lee ESTADO_PROYECTO.md y comprueba git status antes de cambiar nada. Conserva la arquitectura Vercel + Neon y las credenciales privadas. No recrees ni restaures los datos de demostración. La web publicada es https://qr-generator-three-opal.vercel.app.»

## Verificación al cerrar esta sesión
Completadas correctamente: npm test (3 pruebas), npm run lint, npm run build y npm run test:neon. La prueba real confirmó datos de producción intactos. Revisados los archivos preparados para Git: no contienen las credenciales del entorno local.
