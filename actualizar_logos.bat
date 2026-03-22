@echo off
setlocal

echo Actualizando lista de logos...

:: 1. Ejecutar el script de PowerShell para convertir imágenes a Base64
powershell -ExecutionPolicy Bypass -File "convert_to_b64.ps1"

:: 2. Transformar logos_temp.txt a logos_list.js
echo const LOGOS_LIST = [ > logos_list.js
powershell -Command "$content = Get-Content 'logos_temp.txt'; $logos = @(); foreach ($line in $content) { if ($line -match '(.+)\|(.+)\|(.+)') { $name = $matches[1]; $mime = $matches[2]; $data = $matches[3]; $logos += \"    { name: `\"$name`\", data: `\"data:$mime;base64,$data`\" }\" } }; echo ($logos -join \",`n\");" >> logos_list.js
echo ]; >> logos_list.js

echo.
echo ¡Listo! Se han procesado los logos y se actualizó "logos_list.js".
echo Ahora podés refrescar la página en el navegador.
echo.
pause
