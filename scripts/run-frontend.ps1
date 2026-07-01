# Start the Vite dev server on http://localhost:5173
# Usage (from repo root):  ./scripts/run-frontend.ps1
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$UiDir = "$RepoRoot/ui"

if (-not (Test-Path "$UiDir/node_modules")) {
    Write-Host "node_modules missing - running npm install..." -ForegroundColor Yellow
    Push-Location $UiDir
    npm install
    Pop-Location
}

Write-Host "Starting Vite dev server on http://localhost:5173 (Ctrl+C to stop)..." -ForegroundColor Cyan
Write-Host "The /api proxy forwards to the backend on http://localhost:8000 - start it too." -ForegroundColor Yellow
Push-Location $UiDir
npm run dev
Pop-Location
