#!/usr/bin/env pwsh
# show-failures.ps1 — Extract and display test failures from JSON reports

$reportsDir = Join-Path $PSScriptRoot "reports"

if (-not (Test-Path $reportsDir)) {
    Write-Host "No reports directory found. Run tests first." -ForegroundColor Yellow
    exit 1
}

$reports = Get-ChildItem -Path $reportsDir -Filter "stage*.json" | Sort-Object Name

if ($reports.Count -eq 0) {
    Write-Host "No test reports found." -ForegroundColor Yellow
    exit 0
}

$hasFailures = $false

foreach ($report in $reports) {
    $json = Get-Content $report.FullName | ConvertFrom-Json
    
    if ($json.tests) {
        $failures = $json.tests | Where-Object { $_.outcome -eq "failed" }
        
        if ($failures) {
            $hasFailures = $true
            Write-Host "`n=== $($report.Name) ===" -ForegroundColor Red
            
            foreach ($failure in $failures) {
                Write-Host "`nFAILED: $($failure.nodeid)" -ForegroundColor Red
                
                if ($failure.call.longrepr) {
                    Write-Host $failure.call.longrepr -ForegroundColor Gray
                }
            }
        }
    }
}

if (-not $hasFailures) {
    Write-Host "`n✓ All tests passed!" -ForegroundColor Green
}
