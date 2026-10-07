$ErrorActionPreference = 'Stop'
Write-Host "Running project checks..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Syntax checks passed." -ForegroundColor Green
