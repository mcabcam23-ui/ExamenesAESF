@echo off
echo Iniciando servidor en http://localhost:8080
echo Abre el navegador en esa direccion para usar la app.
echo Pulsa Ctrl+C para detener.
cd /d "%~dp0"
start http://localhost:8080
python -m http.server 8080
