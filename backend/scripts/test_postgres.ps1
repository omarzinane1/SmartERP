param([string[]]$Labels = @(), [int]$Port = 55439)

# A separate local PostgreSQL cluster, never the application's development DB.
$ErrorActionPreference = 'Stop'
$backendPath = Split-Path -Parent $PSScriptRoot
$clusterPath = Join-Path $backendPath '.test-postgres'
$dataPath = Join-Path $clusterPath 'data'
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$passwordPath = Join-Path $clusterPath 'password.txt'
New-Item -ItemType Directory -Path $clusterPath -Force | Out-Null
if (-not (Test-Path -LiteralPath $passwordPath)) {
    [IO.File]::WriteAllText($passwordPath, [guid]::NewGuid().ToString('N'))
}
if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
    & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U smarterp_test --auth=scram-sha-256 --pwfile=$passwordPath --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL test cluster initialization failed.' }
}
$oldEnvironment = @{}
foreach ($key in @('DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT')) {
    $oldEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
$started = $false
try {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -l (Join-Path $clusterPath 'server.log') -o "-h 127.0.0.1 -p $Port" -w start
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the isolated PostgreSQL test server.' }
    $started = $true
    $env:DB_NAME = 'postgres'
    $env:DB_USER = 'smarterp_test'
    $env:DB_PASSWORD = [IO.File]::ReadAllText($passwordPath)
    $env:DB_HOST = '127.0.0.1'
    $env:DB_PORT = [string]$Port
    & (Join-Path $backendPath '.venv\Scripts\python.exe') (Join-Path $backendPath 'manage.py') test @Labels --noinput --verbosity 1
    $testExitCode = $LASTEXITCODE
} finally {
    foreach ($key in $oldEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $oldEnvironment[$key], 'Process')
    }
    if ($started) { & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -m fast -w stop }
}
exit $testExitCode
