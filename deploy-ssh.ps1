param(
  [Parameter(Mandatory = $true)]
  [string]$SshHost,

  [Parameter(Mandatory = $true)]
  [string]$User,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [Parameter(Mandatory = $true)]
  [string]$RemotePath,

  [int]$Port = 22,

  [string]$HostKey = 'ssh-ed25519 255 SHA256:ukhGkLOieKdLSPoJa49qnryHpi8tDLYMIlszEc//2pc',

  [string]$PostDeployCommand = ''
)

$ErrorActionPreference = 'Stop'

$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'

if (!(Test-Path $pscp) -or !(Test-Path $plink)) {
  throw 'PuTTY tools (pscp/plink) nao encontrados.'
}

$items = @(
  'admin',
  'api',
  'assets',
  'imagens',
  'uploads',
  'index.html',
  'site-dynamic.js',
  'server.js',
  'package.json',
  'package-lock.json',
  'posts.json'
)

$existingItems = @()
foreach ($item in $items) {
  if (Test-Path $item) {
    $existingItems += $item
  }
}

if ($existingItems.Count -eq 0) {
  throw 'Nenhum arquivo para deploy encontrado.'
}

$commonArgs = @('-batch', '-ssh', '-P', $Port.ToString(), '-l', $User, '-pw', $Password)
if ($HostKey) {
  $commonArgs += @('-hostkey', $HostKey)
}

Write-Host ("[deploy] Enviando arquivos para {0}@{1}:{2}" -f $User, $SshHost, $RemotePath)
& $pscp @commonArgs -r @existingItems ("{0}:{1}/" -f $SshHost, $RemotePath)
if ($LASTEXITCODE -ne 0) {
  throw "Falha no envio via pscp (exit $LASTEXITCODE)."
}

Write-Host '[deploy] Arquivos enviados com sucesso. Skipping npm install (not available on remote server).'
Write-Host '[deploy] Deploy finalizado com sucesso.'
