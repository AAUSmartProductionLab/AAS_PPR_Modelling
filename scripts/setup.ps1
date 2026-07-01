# One-time setup: Python venv + dependencies + UI dependencies.
# Usage (from repo root):  ./scripts/setup.ps1
$ErrorActionPreference = 'Stop'

# Resolve repo root (parent of this scripts/ folder) regardless of cwd.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
Write-Host "Repo root: $RepoRoot" -ForegroundColor Cyan

# --- Python backend ---
if (-not (Test-Path "$RepoRoot/.venv")) {
    Write-Host "Creating virtual environment (.venv)..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
& "$RepoRoot/.venv/Scripts/python.exe" -m pip install --upgrade pip
& "$RepoRoot/.venv/Scripts/python.exe" -m pip install -r requirements.txt

# --- Config check ---
if (-not (Test-Path "$RepoRoot/Generation/config.yaml")) {
    Write-Warning "Generation/config.yaml not found. Copy Generation/config.example.yaml to Generation/config.yaml and add your API keys."
}

# --- UI frontend ---
Write-Host "Installing UI dependencies (npm install)..." -ForegroundColor Cyan
Push-Location "$RepoRoot/ui"
npm install
Pop-Location

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Start the backend:  ./scripts/run-backend.ps1" -ForegroundColor Green
Write-Host "Start the frontend: ./scripts/run-frontend.ps1" -ForegroundColor Green
