Set-Location (Split-Path -Parent $PSScriptRoot)
function Fail($m) { Write-Host "STOP: $m" -ForegroundColor Red; exit 1 }
function Get-Ref($u) { if ($u -match 'postgres\.([a-z0-9]+):') { return $matches[1] } }
$appUrl = 'https://bizflow-pilot-v2.vercel.app'
$repoUrl = 'https://github.com/Solking-crpto/bizflow-pilot-v2'
$v1Ref = 'yqecpqjcjyazssobygac'
$scope = 'tochukwuonyiagha-2437'
$project = 'bizflow-pilot-v2'
$v1Proj = 'C:\Users\DELL\Hackathon\BizFlow Pilot\.vercel\project.json'
$file = '.env.v2.local'
if (-not (Test-Path $file)) { Fail "Missing $file" }
npx vercel link --yes --project $project --scope $scope | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Could not link to $project" }
if (-not (Select-String -Path .gitignore -Pattern '^\.vercel' -Quiet)) { Add-Content .gitignore "`n.vercel" }
if (Test-Path $v1Proj) {
  $a = (Get-Content $v1Proj | ConvertFrom-Json).projectId
  $b = (Get-Content '.vercel\project.json' | ConvertFrom-Json).projectId
  if ($a -eq $b) { Fail 'V2 is linked to the ORIGINAL Vercel project.' }
}
$vals = @{}
foreach ($l in Get-Content $file) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $vals[$matches[1]] = $matches[2].Trim().Trim('"') } }
$vals['NEXT_PUBLIC_APP_URL'] = $appUrl
$vals['NEXT_PUBLIC_REPO_URL'] = $repoUrl
if (-not $vals['SESSION_SECRET'] -or $vals['SESSION_SECRET'].Length -lt 32) { Fail 'SESSION_SECRET missing or shorter than 32 characters' }
$checks = @(@('DATABASE_URL_MAINNET','v2_mainnet'),@('DIRECT_URL_MAINNET','v2_mainnet'),@('DATABASE_URL_TESTNET','v2_testnet'),@('DIRECT_URL_TESTNET','v2_testnet'))
foreach ($c in $checks) {
  $v = $vals[$c[0]]
  if (-not $v) { Fail ($c[0] + ' is missing') }
  if ((Get-Ref $v) -eq $v1Ref) { Fail ($c[0] + ' points at the ORIGINAL app database.') }
  if ($v -notmatch ('schema=' + $c[1])) { Fail ($c[0] + ' must contain schema=' + $c[1]) }
  if ($v -notmatch 'connection_limit') { $vals[$c[0]] = $v + '&connection_limit=1' }
}
$skip = @('DRY_RUN','PUBLIC_SANDBOX')
foreach ($n in (@($vals.Keys) | Sort-Object)) {
  $v = $vals[$n]
  if ($skip -contains $n) { continue }
  if (-not $v) { Write-Host "skip  $n (empty)" -ForegroundColor Yellow; continue }
  $tmp = Join-Path $env:TEMP ('vv_' + [guid]::NewGuid().ToString('N') + '.txt')
  [System.IO.File]::WriteAllText($tmp, $v)
  npx vercel env rm $n production --yes 2>&1 | Out-Null
  $out = cmd /c "npx vercel env add $n production < `"$tmp`"" 2>&1
  $code = $LASTEXITCODE
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  if ($code -eq 0) { Write-Host "set   $n" -ForegroundColor Green }
  else { $last = ($out | Select-Object -Last 1) -as [string]; if ($last.Length -gt 100) { $last = $last.Substring(0,100) }; Write-Host "FAIL  $n  $last" -ForegroundColor Red }
}
foreach ($d in $skip) { npx vercel env rm $d production --yes 2>&1 | Out-Null }
Write-Host "`nProduction variables (names only):" -ForegroundColor Cyan
npx vercel env ls production
