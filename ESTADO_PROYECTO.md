# Illusion QR Generator — punto de continuación

Fecha: 16 de octubre de 2026

## Objetivo

Aplicación para crear códigos QR dinámicos asociados a carpetas de OneDrive/SharePoint. El QR contiene una dirección permanente de Illusion y el servidor redirige al enlace actual de OneDrive. Así se puede cambiar el enlace de destino sin volver a imprimir el QR.

## Entorno

- PC Windows: `C:\Users\Usuario\Desktop\QR-Nuevo`
- Servidor local: `http://192.168.1.171:3000`
- Base de datos: Neon PostgreSQL mediante `DATABASE_URL` en `.env.local`
- Repositorio: `jonycusac-bot/Qr-generator`

## Estado confirmado

- El repositorio está clonado correctamente en el PC.
- `npm run db:check` confirma conexión con Neon (`neondb`).
- `npm start` inicia la aplicación en `http://0.0.0.0:3000`.
- El iPhone puede acceder al servidor local desde la misma Wi-Fi.
- El enlace de OneDrive/SharePoint funciona directamente en el móvil.
- La redirección dinámica usa `/r/:shortCode` y HTTP 302 sin página intermedia.
- La generación de QR usa módulos cuadrados, alineados a píxel y margen blanco de seguridad.

## Problema pendiente

Al abrir una dirección dinámica desde el iPhone aparece “Instalación No Encontrada”. La conexión móvil-servidor funciona, pero el `shortCode` incluido en la URL no coincide con un proyecto disponible en el estado cargado desde Neon.

La interfaz abrevia visualmente la URL con puntos suspensivos. No debe escribirse una versión supuesta del código.

## Primera comprobación de la próxima sesión

1. Iniciar con `npm start`.
2. Abrir `http://localhost:3000/api/projects` en el PC.
3. Buscar “Prueba Neon”.
4. Copiar exactamente el campo `shortCode`.
5. Probar en el iPhone: `http://192.168.1.171:3000/r/<shortCode-completo>`.
6. Si el proyecto no aparece en `/api/projects`, corregir la sincronización entre el navegador y Neon.

## Precauciones

- No borrar ni recrear proyectos antes de comprobar el `shortCode`.
- No seleccionar “Directo OneDrive” si se quiere conservar el QR dinámico.
- Mientras se use `192.168.1.171`, PC e iPhone deben estar en la misma Wi-Fi.
- Para acceso externo será necesario un dominio HTTPS público o un despliegue temporal.
