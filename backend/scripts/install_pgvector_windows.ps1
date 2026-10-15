$ErrorActionPreference = 'Stop'
# Run elevated after building official pgvector v0.8.7 with PGROOT PostgreSQL 17.
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../.test-postgres/pgvector-src')).Path
$pgRoot = (Resolve-Path -LiteralPath 'C:\Program Files\PostgreSQL\17').Path
if ((Get-Content -LiteralPath (Join-Path $sourceRoot 'vector.control') -Raw) -notmatch "default_version = '0.8.7'") { throw 'Unexpected pgvector source version' }
if (Test-Path -LiteralPath (Join-Path $pgRoot 'share/extension/vector.control')) { throw 'Extension already installed; review before replacing' }
Copy-Item -LiteralPath (Join-Path $sourceRoot 'vector.dll') -Destination (Join-Path $pgRoot 'lib/vector.dll')
Copy-Item -LiteralPath (Join-Path $sourceRoot 'vector.control') -Destination (Join-Path $pgRoot 'share/extension/vector.control')
Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'sql') -Filter 'vector--*.sql' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $pgRoot 'share/extension')
}
Set-Content -LiteralPath (Join-Path $PSScriptRoot '../.test-postgres/pgvector-installed.log') -Value 'pgvector 0.8.7 installed for PostgreSQL 17'
