$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$parts = Get-ChildItem -Path '.mt5_bundle' -Filter 'part_*.b64' | Sort-Object Name
if (-not $parts) { throw 'MT5 payload parts not found in .mt5_bundle' }

$base64 = ($parts | ForEach-Object { Get-Content $_.FullName -Raw }) -join ''
$zip = Join-Path $root 'mt5_payload.zip'
[IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String($base64))
Expand-Archive -Path $zip -DestinationPath $root -Force
Remove-Item $zip -Force
Write-Host 'MT5 integration installed into this Deltalytix checkout.' -ForegroundColor Green
Write-Host 'Next: open MT5_DEPLOY.md and configure services/mt5-bridge/.env'
