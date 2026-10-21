Set-Location (Split-Path -Parent $PSScriptRoot)
$m=@{}; foreach ($l in Get-Content .env.v2.local) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $m[$matches[1]]=$matches[2].Trim().Trim('"') } }
$h = @{ apikey = $m['SUPABASE_SERVICE_ROLE_KEY'] }
foreach ($b in @($m['EVIDENCE_BUCKET_TESTNET'], $m['EVIDENCE_BUCKET_MAINNET'])) {
  if (-not $b) { Write-Host 'Missing a bucket name in .env.v2.local' -ForegroundColor Red; continue }
  $body = (@{ id = $b; name = $b; public = $false } | ConvertTo-Json -Compress)
  try { Invoke-RestMethod -Method Post -Uri ($m['SUPABASE_URL'] + '/storage/v1/bucket') -Headers $h -ContentType 'application/json' -Body $body | Out-Null; Write-Host "created private bucket $b" -ForegroundColor Green }
  catch { Write-Host "could not create $b : $($_.Exception.Message)" -ForegroundColor Yellow }
}
Write-Host 'Buckets now in the project:'
Invoke-RestMethod -Uri ($m['SUPABASE_URL'] + '/storage/v1/bucket') -Headers $h | Select-Object name, public
