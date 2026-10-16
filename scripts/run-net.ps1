param([Parameter(Mandatory=$true)][ValidateSet('mainnet','testnet')][string]$Network,[Parameter(ValueFromRemainingArguments=$true)][string[]]$Cmd)
Set-Location (Split-Path -Parent $PSScriptRoot)
foreach ($l in Get-Content .env.v2.local) { if ($l -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2].Trim().Trim('"') } }
$s = $Network.ToUpper()
$env:DATABASE_URL = (Get-Item ("Env:DATABASE_URL_" + $s)).Value
$env:DIRECT_URL = (Get-Item ("Env:DIRECT_URL_" + $s)).Value
$env:NEXT_PUBLIC_NETWORK_MODE = $Network
$a = (Get-Item ("Env:AUDIT_ANCHOR_ADDRESS_" + $s) -ErrorAction SilentlyContinue).Value
if ($a -match '^0x[0-9a-fA-F]{40}$') { $env:AUDIT_ANCHOR_ADDRESS = $a }
& $Cmd[0] $Cmd[1..($Cmd.Length-1)]
