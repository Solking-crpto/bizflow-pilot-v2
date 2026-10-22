Set-Location (Split-Path -Parent $PSScriptRoot)
Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
npm run dev
