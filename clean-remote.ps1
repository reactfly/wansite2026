param(
    [string]$SshHost = "82.25.67.148",
    [string]$User = "u146190565",
    [string]$Password = "Ayl@2026##",
    [int]$Port = 65002,
    [string]$RemotePath = "/home/u146190565/domains/wanbitha.com.br/public_html"
)

$plink = "C:\Program Files\PuTTY\plink.exe"

Write-Host "🗑️  Limpando servidor remoto..."

# Limpar hosts keys cache
Remove-ItemProperty -Path "HKCU:\Software\SimonTatham\PuTTY\SshHostKeys" -Name "*82.25*" -ErrorAction SilentlyContinue | Out-Null

# Esperar um pouco
Start-Sleep -Milliseconds 500

# Comandos para limpar
$cleanCommands = @(
    "cd $RemotePath",
    "rm -rf * .htaccess .env .server.pid 2>/dev/null",
    "echo 'Servidor limpo'"
)

$scriptContent = $cleanCommands -join "; "

Write-Host "Conectando ao servidor..."

$output = & $plink -ssh -pw $Password -P $Port "${User}@${SshHost}" $scriptContent 2>&1 | Out-String

Write-Host $output

Start-Sleep -Milliseconds 500

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Servidor limpo com sucesso"
} else {
    Write-Warning "⚠️  Aviso ao limpar (pode ser normal se arquivos já não existiam)"
}
