Set-Location (Split-Path -Parent $PSScriptRoot)
$k = Get-Clipboard -Raw
if ($k) { $k = $k.Trim() }
if (-not $k) { Write-Host 'The clipboard is empty. Copy the key in Supabase first, then run this again.' -ForegroundColor Red; exit 1 }
if ($k -match '^sb_publishable_') { Write-Host 'That is the PUBLISHABLE key. Use the copy icon in the Secret keys box.' -ForegroundColor Red; exit 1 }
$ok = ($k -match '^sb_secret_' -and $k.Length -gt 30) -or ($k -match '^eyJ' -and $k.Length -gt 100)
if (-not $ok) { Write-Host ('The clipboard starts with: ' + $k.Substring(0, [Math]::Min(10, $k.Length)) + ' (length ' + $k.Length + '). It is not a Supabase secret key.') -ForegroundColor Red; exit 1 }
$l = Get-Content .env.v2.local | Where-Object { $_ -notmatch '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' }
$l += ('SUPABASE_SERVICE_ROLE_KEY=' + $k)
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) '.env.v2.local'), $l)
Set-Clipboard -Value ' '
Write-Host ('Saved the secret key (length ' + $k.Length + ', starts with ' + $k.Substring(0,10) + '). Clipboard cleared.') -ForegroundColor Green
