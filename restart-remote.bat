@echo off
setlocal enabledelayedexpansion

set HOST=82.25.67.148
set USER=u146190565
set PASSWORD=Ayl@2026##
set PORT=65002
set REMOTE_PATH=/home/u146190565/domains/wanbitha.com.br/public_html
set PLINK="C:\Program Files\PuTTY\plink.exe"

echo.
echo ========================================
echo  Reiniciando Node.js Server
echo ========================================
echo.

echo Conectando ao servidor...
(
    echo cd %REMOTE_PATH%
    echo bash simple-start.sh
    echo sleep 2
    echo ps aux ^| grep node
) | %PLINK% -ssh -hostkey "ssh-ed25519 255 SHA256:ukhGkLOieKdLSPoJa49qnryHpi8tDLYMIlszEc//2pc" -pw %PASSWORD% -P %PORT% %USER%@%HOST%

echo.
echo ✅ Servidor reiniciado!
echo.
