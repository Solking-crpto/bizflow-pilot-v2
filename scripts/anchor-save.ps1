param([Parameter(Mandatory=$true)][ValidateSet('mainnet','testnet')][string]$Network,[switch]$Deploy)
Set-Location (Split-Path -Parent $PSScriptRoot)
$m = @{}
foreach ($l in Get-Content .env.v2.local) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $m[$matches[1]] = $matches[2].Trim().Trim('"') } }
$S = $Network.ToUpper()
$rpc = $m['ARC_' + $S + '_RPC_URL']
$varName = 'AUDIT_ANCHOR_ADDRESS_' + $S
$orig = '0x2b18fe9d3a63710da242092571744520ea8effe0'
$skip = @('0x061f5c70d68a246b654724c0f9595f3a14cf9b0b','0x3600000000000000000000000000000000000000',$orig)
foreach ($k in 'VENDOR_WALLET_ADDRESS','ADMIN_WALLET_ADDRESS') { if ($m[$k]) { $skip += $m[$k].ToLower() } }
function Has-Code($a) { try { $r = Invoke-RestMethod -Method Post -Uri $rpc -ContentType 'application/json' -Body (@{jsonrpc='2.0';id=1;method='eth_getCode';params=@($a,'latest')} | ConvertTo-Json -Compress); return ($r.result.Length -gt 4) } catch { return $false } }
$text = ''
if ($Deploy) {
  $script = 'scripts/deployAnchor' + (Get-Culture).TextInfo.ToTitleCase($Network) + '.ts'
  $text = (& powershell -ExecutionPolicy Bypass -File .\scripts\run-net.ps1 -Network $Network npx tsx $script --yes 2>&1 | Out-String)
  Write-Host $text
} else {
  $f = 'docs\TESTNET_DEPLOYMENT.json'
  if ($Network -eq 'mainnet') { $f = 'docs\MAINNET_DEPLOYMENT.json' }
  if (-not (Test-Path $f)) { Write-Host "No $f found. Run again with -Deploy." -ForegroundColor Yellow; exit 1 }
  $age = (Get-Date) - (Get-Item $f).LastWriteTime
  if ($age.TotalHours -gt 12) { Write-Host "$f was last written $([int]$age.TotalHours) hours ago, so it is not a new deployment. Run again with -Deploy." -ForegroundColor Yellow; exit 1 }
  $text = Get-Content $f -Raw
}
$c = @([regex]::Matches($text,'0x[0-9a-fA-F]{40}(?![0-9a-fA-F])') | ForEach-Object { $_.Value } | Sort-Object -Unique | Where-Object { $skip -notcontains $_.ToLower() })
$good = @($c | Where-Object { Has-Code $_ })
if ($good.Count -eq 1) {
  $a = $good[0]
  $l = Get-Content .env.v2.local | Where-Object { $_ -notmatch ('^\s*' + $varName + '\s*=') }
  $l += ($varName + '=' + $a)
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) '.env.v2.local'), $l)
  Write-Host "saved $varName = $a (contract code confirmed on $Network)" -ForegroundColor Green
} elseif ($good.Count -eq 0) {
  Write-Host 'No contract address with on-chain code was found in that output.' -ForegroundColor Red
  if ($c.Count) { Write-Host ('Addresses seen without contract code: ' + ($c -join ', ')) }
} else {
  Write-Host ('More than one contract found: ' + ($good -join ', ') + ' . Paste the deploy output to me.') -ForegroundColor Yellow
}
