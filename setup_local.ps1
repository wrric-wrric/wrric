# WRRIC System - Local Development Setup Script
# Run this script to set up and run the wrric-system locally

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$WithDocker
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WRRIC System Local Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } 
    catch { return $false }
}

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-Command "git")) {
    Write-Host "ERROR: Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

if (-not $SkipBackend) {
    if (-not (Test-Command "python")) {
        Write-Host "ERROR: Python is not installed. Please install Python 3.10+ first." -ForegroundColor Red
        exit 1
    }
    
    $pythonVersion = python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
}

if (-not $SkipFrontend) {
    if (-not (Test-Command "node")) {
        Write-Host "ERROR: Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
        exit 1
    }
    
    $nodeVersion = node --version 2>&1
    Write-Host "  Found: Node.js $nodeVersion" -ForegroundColor Green
}

# PostgreSQL check (if not using Docker)
if (-not $WithDocker -and -not $SkipBackend) {
    if (-not (Test-Command "psql")) {
        Write-Host "WARNING: PostgreSQL not found in PATH. Make sure PostgreSQL is installed and running." -ForegroundColor Yellow
        Write-Host "  Alternatively, use -WithDocker flag to run with Docker." -ForegroundColor Yellow
    } else {
        Write-Host "  PostgreSQL found" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[2/6] Setting up project directories..." -ForegroundColor Yellow

$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }

# Create data directories
New-Item -ItemType Directory -Force -Path "$projectRoot\backend\data" | Out-Null
New-Item -ItemType Directory -Force -Path "$projectRoot\backend\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "$projectRoot\frontend\logs" | Out-Null

Write-Host "  Directories created" -ForegroundColor Green

# Setup Backend
if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "[3/6] Setting up Backend..." -ForegroundColor Yellow
    
    $backendDir = "$projectRoot\backend"
    Set-Location $backendDir
    
    # Copy env example if .env doesn't exist
    if (-not (Test-Path "$backendDir\.env")) {
        Copy-Item "$backendDir\.env.example" "$backendDir\.env"
        Write-Host "  Created .env from template (please edit with your settings)" -ForegroundColor Green
    } else {
        Write-Host "  .env already exists" -ForegroundColor Green
    }
    
    # Create virtual environment
    if (-not (Test-Path "$backendDir\venv")) {
        Write-Host "  Creating virtual environment..."
        python -m venv venv
    }
    
    # Activate virtual environment
    Write-Host "  Installing Python dependencies..."
    & "$backendDir\venv\Scripts\Activate.ps1"
    pip install --upgrade pip
    pip install -r requirements.txt
    
    Write-Host "  Backend setup complete" -ForegroundColor Green
    Set-Location $projectRoot
}

# Setup Frontend
if (-not $SkipFrontend) {
    Write-Host ""
    Write-Host "[4/6] Setting up Frontend..." -ForegroundColor Yellow
    
    $frontendDir = "$projectRoot\frontend"
    Set-Location $frontendDir
    
    Write-Host "  Installing Node.js dependencies..."
    npm install
    
    Write-Host "  Frontend setup complete" -ForegroundColor Green
    Set-Location $projectRoot
}

Write-Host ""
Write-Host "[5/6] Database Setup..." -ForegroundColor Yellow

if ($WithDocker) {
    Write-Host "  Starting PostgreSQL with Docker..."
    docker run -d --name wrric-postgres `
        -e POSTGRES_PASSWORD=postgres `
        -e POSTGRES_DB=wrric `
        -p 5432:5432 `
        postgres:15-alpine
    
    Write-Host "  PostgreSQL container started" -ForegroundColor Green
} else {
    Write-Host "  Please ensure PostgreSQL is running locally" -ForegroundColor Yellow
    Write-Host "  Database 'wrric' should exist (create if not: createdb wrric)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[6/6] Running Database Migrations..." -ForegroundColor Yellow

if (-not $SkipBackend) {
    Set-Location "$projectRoot\backend"
    & "$projectRoot\backend\venv\Scripts\Activate.ps1"
    
    # Run migrations
    alembic upgrade head
    
    Write-Host "  Migrations complete" -ForegroundColor Green
    Set-Location $projectRoot
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run the system:" -ForegroundColor White
Write-Host ""

if (-not $SkipBackend) {
    Write-Host "  BACKEND:" -ForegroundColor Yellow
    Write-Host "    cd backend" -ForegroundColor White
    Write-Host "    .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "    python main.py" -ForegroundColor White
    Write-Host "    (or: uvicorn main:app --reload --host 0.0.0.0 --port 8000)" -ForegroundColor White
    Write-Host ""
}

if (-not $SkipFrontend) {
    Write-Host "  FRONTEND:" -ForegroundColor Yellow
    Write-Host "    cd frontend" -ForegroundColor White
    Write-Host "    npm run dev" -ForegroundColor White
    Write-Host ""
}

Write-Host "  Access points:" -ForegroundColor Yellow
if (-not $SkipBackend) {
    Write-Host "    API:       http://localhost:8000" -ForegroundColor White
    Write-Host "    API Docs:  http://localhost:8000/docs" -ForegroundColor White
}
if (-not $SkipFrontend) {
    Write-Host "    Frontend:  http://localhost:3000" -ForegroundColor White
}
Write-Host ""
