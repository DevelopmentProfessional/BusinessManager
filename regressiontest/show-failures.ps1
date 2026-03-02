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
$totalPassed = 0
$totalFailed = 0
$totalSkipped = 0

foreach ($report in $reports) {
    $json = Get-Content $report.FullName | ConvertFrom-Json
    
    if ($json.summary) {
        $totalPassed += $json.summary.passed
        $totalFailed += $json.summary.failed
        $totalSkipped += $json.summary.skipped
    }
    
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

Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Passed:  $totalPassed" -ForegroundColor Green
Write-Host "Failed:  $totalFailed" -ForegroundColor $(if ($totalFailed -gt 0) { "Red" } else { "Gray" })
Write-Host "Skipped: $totalSkipped" -ForegroundColor Yellow

if (-not $hasFailures) {
    Write-Host "`n✓ All tests passed!" -ForegroundColor Green
}
