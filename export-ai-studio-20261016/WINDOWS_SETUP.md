# Guía de Instalación en Windows con Cloudflare Tunnel

Esta guía te permitirá desplegar el sistema **Illusion Dynamic QR** en un PC con Windows en tu empresa, accesible desde cualquier teléfono móvil del mundo mediante tu propio dominio y con certificado SSL (HTTPS) gratuito.

---

## Requisitos Previos

1. **PC con Windows** (Windows 10, 11 o Windows Server) con conexión a Internet continua.
2. **Node.js LTS** instalado ([nodejs.org](https://nodejs.org/)).
3. **Cuenta gratuita en Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com/)).
4. **Dominio web** gestionado en Cloudflare (ej: `tuempresa.es`).

---

## Paso 1: Descargar y preparar la aplicación en el PC

1. Descomprime los archivos del proyecto en tu carpeta:
   `"C:\Qr illusion"`
2. Abre la consola **PowerShell** o **CMD** como Administrador y navega hasta la carpeta:
   ```powershell
   cd "C:\Qr illusion"
   ```
3. Instala las dependencias y compila para producción (o simplemente haz doble clic en `compilar.bat`):
   ```powershell
   npm install
   npm run build
   ```
4. Prueba que arranca ejecutando (o doble clic en `iniciar.bat`):
   ```powershell
   npm start
   ```
   Deberás ver: `[Server] Dynamic QR App running on http://0.0.0.0:3000`.
   Abre en tu navegador `http://localhost:3000` para comprobar que carga. Pulsa `Ctrl + C` para detenerlo.

---

## Paso 2: Crear el Túnel en Cloudflare (Sin abrir puertos en el Router)

1. Inicia sesión en [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. En el menú lateral izquierdo ve a **Networks** > **Tunnels**.
3. Haz clic en **Create a Tunnel** (o *Add a Tunnel*).
4. Elige el tipo de conector: **Cloudflared**.
5. Ponle un nombre identificativo, por ejemplo: `pc-oficina-illusion`.
6. En la siguiente pantalla, selecciona **Windows**. Cloudflare te mostrará un comando con un instalador y un token parecido a este:
   ```cmd
   winget install --id Cloudflare.cloudflared
   cloudflared.exe service install eyJh...
   ```
7. Abre **PowerShell como Administrador** en el PC de la empresa, pega ese comando y pulsa Enter.
   *Esto instalará Cloudflare como servicio oficial de Windows en segundo plano.*
8. En el panel web de Cloudflare, pulsa **Next**.
9. En la pestaña **Public Hostnames**, añade tu dirección:
   - **Subdomain**: `qr`
   - **Domain**: `tuempresa.es` (quedará `qr.tuempresa.es`)
   - **Type**: `HTTP`
   - **URL**: `localhost:3000`
10. Haz clic en **Save tunnel**.

¡Listo! A partir de este momento, cualquier persona en el mundo que entre a `https://qr.tuempresa.es` se conectará de forma cifrada y segura a tu PC de la oficina.

---

## Paso 3: Configurar el servicio permanente en Windows (Auto-arranque)

Para que el servidor Node.js se inicie automáticamente si el PC se apaga o reinicia:

1. En PowerShell como Administrador:
   ```powershell
   npm install -g pm2 pm2-windows-service
   ```
2. Instala el servicio de Windows ejecutando:
   ```powershell
   pm2-service-install
   ```
   (Presiona Enter en las preguntas por defecto).
3. Inicia la aplicación con PM2 desde la carpeta del proyecto:
   ```powershell
   cd "C:\Qr illusion"
   pm2 start dist/server.cjs --name "illusion-qr"
   pm2 save
   ```
4. Ahora, aunque se reinicie el ordenador tras una actualización de Windows, la aplicación arrancará sola sin necesidad de que nadie inicie sesión.

---

## Paso 4: Copia de Seguridad Automática a OneDrive (Blindaje de Datos)

Toda la base de datos se guarda en un solo archivo: `C:\Qr illusion\data\db.json`.

Para tener copias de seguridad continuas y automáticas en el OneDrive de la empresa:

1. Crea un script en PowerShell llamado `backup-qr.ps1`:
   ```powershell
   $Origen = "C:\Qr illusion\data\db.json"
   $Destino = "$env:USERPROFILE\OneDrive - TuEmpresa\Backups_QR\db_backup_" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".json"
   New-Item -ItemType Directory -Force -Path (Split-Path $Destino)
   Copy-Item -Path $Origen -Destination $Destino -Force
   ```
2. En el **Programador de tareas de Windows**, crea una tarea diaria (por ejemplo a las 23:00) que ejecute:
   - Programa: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\Qr illusion\backup-qr.ps1"`

Así tendrás siempre una copia histórica en la nube de Microsoft sin depender del disco duro del PC.

---

## Paso 5: Fijar el dominio en el panel de la aplicación

1. Abre la aplicación en `https://qr.tuempresa.es`.
2. Al generar o ver una pegatina, pulsa en **Configurar Dominio Base de Redirección** e introduce:
   `https://qr.tuempresa.es`
3. A partir de ese momento, todas las pegatinas e imágenes PNG que descargues o imprimas llevarán grabado tu dominio corporativo definitivo.
