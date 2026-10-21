# Secure Schemas PowerShell Wrapper: Applies RLS and role access revocation on testnet
param(
  [ValidateSet('testnet')][string]$Network = 'testnet'
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location (Split-Path -Parent $PSScriptRoot)

$envFile = '.env.v2.local'
if (-not (Test-Path $envFile)) {
  Write-Host "Missing $envFile" -ForegroundColor Red
  exit 1
}

$envMap = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
    $envMap[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$db = $envMap['DATABASE_URL_TESTNET']
if (-not $db) {
  $db = $envMap['DIRECT_URL_TESTNET']
}

if (-not $db) {
  Write-Host "Missing DATABASE_URL_TESTNET in $envFile" -ForegroundColor Red
  exit 1
}

# Ensure sslmode=require
if ($db -notmatch 'sslmode=') {
  $sep = if ($db -match '\?') { '&' } else { '?' }
  $db = $db + $sep + 'sslmode=require'
}

$sqlFile = Join-Path $PSScriptRoot 'secure-schemas.sql'
if (-not (Test-Path $sqlFile)) {
  Write-Host "Missing $sqlFile" -ForegroundColor Red
  exit 1
}

Write-Host "Securing schema v2_testnet: enabling RLS on all tables and revoking public access..." -ForegroundColor Cyan

$env:DATABASE_URL = $db
npx prisma db execute --file $sqlFile --url $db

if ($LASTEXITCODE -eq 0) {
  Write-Host "Schema v2_testnet successfully secured with Row Level Security." -ForegroundColor Green
} else {
  Write-Host "Failed to secure schema v2_testnet." -ForegroundColor Red
  exit $LASTEXITCODE
}
