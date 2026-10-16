param([ValidateSet('mainnet','testnet')][string]$Network)
Set-Location (Split-Path -Parent $PSScriptRoot)
$f = '.env.v2.local'
if (-not (Test-Path $f)) { Write-Host "Missing $f" -ForegroundColor Red; exit 1 }
foreach ($l in Get-Content $f) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2].Trim().Trim('"') } }
$suffix = $Network.ToUpper()
$db = (Get-Item ("Env:DATABASE_URL_" + $suffix) -ErrorAction SilentlyContinue).Value
$dr = (Get-Item ("Env:DIRECT_URL_" + $suffix) -ErrorAction SilentlyContinue).Value
if (-not $db -or -not $dr) { Write-Host "Missing DATABASE_URL_$suffix or DIRECT_URL_$suffix in $f" -ForegroundColor Red; exit 1 }
$want = "schema=v2_" + $Network
if ($db -notmatch $want -or $dr -notmatch $want) { Write-Host "URLs must contain $want" -ForegroundColor Red; exit 1 }
$env:DATABASE_URL = $db; $env:DIRECT_URL = $dr
npx prisma db push
