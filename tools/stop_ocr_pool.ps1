param(
    [int[]]$Ports = @(),
    [switch]$All
)

Write-Host "Stopping PaddleOCR server processes..." -ForegroundColor Cyan

# Helper: collect PIDs by listening port via Get-NetTCPConnection (if available), then fall back to netstat
function Get-PidsByPorts([int[]]$ports) {
    $pids = New-Object System.Collections.Generic.HashSet[int]
    if ($ports.Count -eq 0) { return @() }
    try {
        if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
            foreach ($p in $ports) {
                try {
                    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
                    foreach ($c in $conns) { if ($c.OwningProcess) { [void]$pids.Add([int]$c.OwningProcess) } }
                } catch {}
            }
        } else {
            # Fallback: netstat parsing
            $output = netstat -ano | Select-String -Pattern ( ($ports | ForEach-Object { ":$_" }) -join "|" )
            foreach ($line in $output) {
                if ($line -match "\s+(\d+)$") { [void]$pids.Add([int]$Matches[1]) }
            }
        }
    } catch {}
    return [int[]]$pids
}

# Helper: collect PIDs by command line matching paddle_ocr_server.py
function Get-PidsByCommand() {
    $pids = New-Object System.Collections.Generic.HashSet[int]
    try {
        $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "paddle_ocr_server\.py" }
        foreach ($p in $procs) { [void]$pids.Add([int]$p.ProcessId) }
    } catch {}
    return [int[]]$pids
}

$targets = @()
if ($All) {
    $targets = Get-PidsByCommand
} else {
    $targets = Get-PidsByPorts $Ports
    # also include any python processes running the server (defensive)
    $targets += Get-PidsByCommand
    $targets = $targets | Select-Object -Unique
}

if (-not $targets -or $targets.Count -eq 0) {
    Write-Host "No target OCR server processes found." -ForegroundColor Yellow
    exit 0
}

foreach ($procId in $targets) {
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "Stopped PID=$procId" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to stop PID=$procId : $_"
    }
}

Write-Host "Done." -ForegroundColor Cyan
