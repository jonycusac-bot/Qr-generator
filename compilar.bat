@echo off
title Illusion QR - Compilacion
echo ========================================================
echo [1/2] Instalando dependencias necesarias...
echo ========================================================
cd /d "%~dp0"
call npm install

echo.
echo ========================================================
echo [2/2] Compilando la aplicacion para produccion...
echo ========================================================
call npm run build

echo.
echo ========================================================
echo COMPILACION COMPLETADA CORRECTAMENTE
echo Ahora puedes ejecutar 'iniciar.bat' o usar PM2.
echo ========================================================
pause
