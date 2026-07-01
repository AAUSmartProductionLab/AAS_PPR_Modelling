# Start the FastAPI backend on http://localhost:8000
# Usage (from repo root):  ./scripts/run-backend.ps1
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot   # uvicorn must run from repo root so `api.main` resolves

$Python = "$RepoRoot/.venv/Scripts/python.exe"
if (-not (Test-Path $Python)) {
    throw "Virtual environment not found. Run ./scripts/setup.ps1 first."
}
if (-not (Test-Path "$RepoRoot/Generation/config.yaml")) {
    throw "Generation/config.yaml not found. Copy Generation/config.example.yaml and add your API keys."
}

Write-Host "Starting FastAPI on http://localhost:8000 (Ctrl+C to stop)..." -ForegroundColor Cyan
& $Python -m uvicorn api.main:app --reload --port 8000
