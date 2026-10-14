Set-Location (Split-Path -Parent $PSScriptRoot)
function Fail($m) { Write-Host "STOP: $m" -ForegroundColor Red; exit 1 }
function Get-Ref($u) { if ($u -match 'postgres\.([a-z0-9]+):') { return $matches[1] } }
$appUrl  = 'https://bizflow-pilot-v2.vercel.app'
$repoUrl = 'https://github.com/Solking-crpto/bizflow-pilot-v2'
$v1Ref   = 'yqecpqjcjyazssobygac'
$src = '.env.mainnet.local'
if (-not (Test-Path $src)) { Fail 'Missing .env.mainnet.local' }
if (-not (Test-Path '.vercel\project.json')) { Fail 'Run: npx vercel link --yes --project bizflow-pilot-v2 first' }
if (-not (Select-String -Path .gitignore -Pattern '^\.vercel' -Quiet)) { Add-Content .gitignore "`n.vercel" }
$vals = @{}
foreach ($l in Get-Content $src) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $vals[$matches[1]] = $matches[2].Trim().Trim('"') } }
$vals['NEXT_PUBLIC_NETWORK_MODE'] = 'mainnet'
$vals['NEXT_PUBLIC_APP_URL']  = $appUrl
$vals['NEXT_PUBLIC_REPO_URL'] = $repoUrl
$vals['PAYMENT_PROVIDER']     = 'direct'
if (-not $vals['TREASURY_PRIVATE_KEY']) { Fail 'TREASURY_PRIVATE_KEY is missing' }
if (-not $vals['OWNER_PASSCODE'])       { Fail 'OWNER_PASSCODE is missing' }
$mainRef = Get-Ref $vals['DIRECT_URL']
if (-not $mainRef) { Fail 'Could not read the database reference' }
if ($mainRef -eq $v1Ref) { Fail 'DIRECT_URL points at the ORIGINAL app database. V2 needs its own.' }
if ($vals['DIRECT_URL'] -notmatch 'schema=') { Fail 'DIRECT_URL needs a ?schema=v2_mainnet parameter' }
foreach ($k in 'DATABASE_URL','DIRECT_URL') {
  if ($vals[$k] -and $vals[$k] -notmatch 'connection_limit') {
    $sep = '?'; if ($vals[$k] -match '\?') { $sep = '&' }
    $vals[$k] = $vals[$k] + $sep + 'connection_limit=1'
  }
}
$names = 'NEXT_PUBLIC_NETWORK_MODE','NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_REPO_URL','PAYMENT_PROVIDER','DATABASE_URL','DIRECT_URL','ARC_MAINNET_RPC_URL','ARC_MAINNET_RPC_FALLBACKS','ARC_MAINNET_EXPLORER_URL','ARC_MAINNET_USDC_ADDRESS','AUDIT_ANCHOR_ADDRESS','TREASURY_PRIVATE_KEY','VENDOR_WALLET_ADDRESS','MAX_MAINNET_PAYMENT_USDC','MIN_RESERVE_USDC','DB_TIMEOUT_MS','OWNER_PASSCODE','LLM_PROVIDER','GOOGLE_API_KEY','ANTHROPIC_API_KEY','AGENT_MODE','AUTO_APPROVE_LIMIT_USDC','MAX_DAILY_AUTONOMOUS_USDC','CRON_SECRET'
foreach ($n in $names) {
  $v = $vals[$n]
  if (-not $v) { Write-Host "skip  $n (empty in file)" -ForegroundColor Yellow; continue }
  $tmp = Join-Path $env:TEMP ('vv_' + [guid]::NewGuid().ToString('N') + '.txt')
  [System.IO.File]::WriteAllText($tmp, $v)
  npx vercel env rm $n production --yes 2>&1 | Out-Null
  $out = cmd /c "npx vercel env add $n production < `"$tmp`"" 2>&1
  $code = $LASTEXITCODE
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  if ($code -eq 0) { Write-Host "set   $n" -ForegroundColor Green }
  else { $last = ($out | Select-Object -Last 1) -as [string]; if ($last.Length -gt 100) { $last = $last.Substring(0,100) }; Write-Host "FAIL  $n  $last" -ForegroundColor Red }
}
npx vercel env rm DRY_RUN production --yes 2>&1 | Out-Null
Write-Host "`nProduction variables on Vercel (names only):" -ForegroundColor Cyan
npx vercel env ls production
