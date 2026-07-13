$ErrorActionPreference = "Continue"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 5173
$log = Join-Path $project "vite-server-forever.log"

Set-Location -LiteralPath $project

if (-not (Test-Path -LiteralPath (Join-Path $project "web\main.js"))) {
  & npm.cmd run export:web *>> $log
}

while ($true) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    Start-Sleep -Seconds 5
    continue
  }

  "[$(Get-Date -Format s)] Starting local server" | Add-Content -LiteralPath $log
  & npm.cmd run dev -- --host 127.0.0.1 --port $port --strictPort *>> $log
  "[$(Get-Date -Format s)] Server stopped; retrying in 3 seconds" | Add-Content -LiteralPath $log
  Start-Sleep -Seconds 3
}
