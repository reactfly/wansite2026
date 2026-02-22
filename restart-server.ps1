param(
    [string]$SshHost = "82.25.67.148",
    [string]$User = "u146190565", 
    [string]$Password = "Ayl@2026##",
    [int]$Port = 65002
)

$plink = "C:\Program Files\PuTTY\plink.exe"

# First, update the key by sending 'y' to accept new key
Write-Host "Updating SSH host key (accepting new key)..."
"y" | & $plink -ssh -pw $Password -P $Port "${User}@${SshHost}" "exit" 2>&1 | Out-Null

Start-Sleep -Milliseconds 500

# Now restart the server
Write-Host "Restarting Node.js server..."
& $plink -ssh -pw $Password -P $Port "${User}@${SshHost}" "cd ~/domains/wanbitha.com.br/public_html && bash simple-start.sh" 2>&1

Write-Host "Server restart initiated."
