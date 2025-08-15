param(
    [int[]]$Ports = @(5000,5001,5002),
    [switch]$DisableLock,
    [switch]$ShowWindows
)

Write-Host "Starting PaddleOCR servers on ports: $($Ports -join ', ')" -ForegroundColor Cyan

$python = Join-Path $PSScriptRoot 'paddle_ocr_venv\Scripts\python.exe'
$server = Join-Path $PSScriptRoot 'paddle_ocr_server.py'

if (-not (Test-Path $python)) {
    Write-Error "Python executable not found: $python"
    exit 1
}
if (-not (Test-Path $server)) {
    Write-Error "Server script not found: $server"
    exit 1
}

$logsDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

$procs = @()
foreach ($p in $Ports) {
    # Set env vars for this child process (each Start-Process copies current env)
    $env:OCR_PORT = "$p"
    $env:OCR_DISABLE_LOCK = if ($DisableLock) { '1' } else { '0' }

    $outLog = Join-Path $logsDir ("ocr_${p}.out.log")
    $errLog = Join-Path $logsDir ("ocr_${p}.err.log")

    $winStyle = if ($ShowWindows) { 'Minimized' } else { 'Hidden' }
    $proc = Start-Process -FilePath $python `
        -ArgumentList "`"$server`"" `
        -PassThru `
        -WindowStyle $winStyle `
        -WorkingDirectory (Split-Path $PSScriptRoot -Parent) `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog

    $procs += $proc
    Start-Sleep -Milliseconds 300
}

Write-Host "Launched processes:" -ForegroundColor Green
$procs | ForEach-Object { Write-Host ("PID={0} | Port={1}" -f $_.Id, $Ports[$procs.IndexOf($_)]) }

Write-Host "Logs dir: $logsDir" -ForegroundColor Yellow
Write-Host "Tip: In the browser console, set localStorage['OCR_PORTS'] = '" + ($Ports -join ',') + "' to enable port pool round-robin." -ForegroundColor Yellow
Write-Host "Check listening ports: netstat -ano | findstr :$($Ports[0]) ; or Test-NetConnection 127.0.0.1 -Port $($Ports[0])" -ForegroundColor Yellow
