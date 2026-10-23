@echo off
title Illusion QR - Servidor Local
echo ========================================================
echo Iniciando servidor Illusion QR en http://localhost:3000
echo ========================================================
cd /d "%~dp0"
call npm start
pause
