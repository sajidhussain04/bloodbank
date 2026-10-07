$ErrorActionPreference = 'Stop'

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Jhar Jeevan Blood Bank - Supabase" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed. Install Node.js 22+ and reopen PowerShell."
}

$nodeVersion = node --version
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

if (-not (Test-Path ".env")) {
  Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
  Copy-Item ".env.example" ".env"
  Write-Host "IMPORTANT: open .env and fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD and JWT_SECRET." -ForegroundColor Yellow
  notepad ".env"
  Read-Host "Press Enter after you have saved .env"
}

$envText = Get-Content ".env" -Raw
foreach ($name in @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD", "JWT_SECRET")) {
  if ($envText -notmatch "(?m)^$name=.+$") {
    throw "$name is missing from .env"
  }
}

Write-Host "Installing/updating npm dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Running syntax checks..." -ForegroundColor Yellow
npm test

Write-Host "Starting Blood Bank server..." -ForegroundColor Green
Write-Host "Open http://localhost:5000/ in your browser." -ForegroundColor Cyan
Write-Host "Admin: http://localhost:5000/admin-login.html" -ForegroundColor Cyan
Write-Host "Health: http://localhost:5000/api/health" -ForegroundColor Cyan

npm run dev
