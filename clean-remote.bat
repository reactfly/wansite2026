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
echo  Limpando Servidor Remoto (Clean Start)
echo ========================================
echo.

REM Apagar cache de chaves SSH
echo Removendo cache SSH...
for /f "delims=" %%i in ('reg query "HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\SshHostKeys" 2^>nul') do (
    set "key=%%i"
    if "!key!" neq "" (
        if "!key:*82.25=!" neq "!key!" (
            reg delete "HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\SshHostKeys" /v "!key:~-30!" /f 2>nul
        )
    )
)

echo Conectando ao servidor para limpar...
(
    echo cd %REMOTE_PATH%
    echo pwd
    echo rm -rf *
    echo rm -f .htaccess .env .server.pid
    echo echo "Limpeza concluida"
    echo exit
) | %PLINK% -ssh -hostkey "ssh-ed25519 255 SHA256:ukhGkLOieKdLSPoJa49qnryHpi8tDLYMIlszEc//2pc" -pw %PASSWORD% -P %PORT% %USER%@%HOST%

echo.
echo ✅ Servidor limpo com sucesso!
echo.
pause
