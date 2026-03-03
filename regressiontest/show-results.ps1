# show-results.ps1 - Print a concise summary of the last regression test run.

$reportsDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) "reports"

foreach ($stage in @("stage1", "stage2", "stage4")) {
    $file = Join-Path $reportsDir "$stage.json"
    if (-not (Test-Path $file)) { continue }

    $data = Get-Content $file | ConvertFrom-Json
    $s = $data.summary
    $passed  = if ($s.passed)  { $s.passed }  else { 0 }
    $failed  = if ($s.failed)  { $s.failed }  else { 0 }
    $error_  = if ($s.error)   { $s.error }   else { 0 }
    $xfailed = if ($s.xfailed) { $s.xfailed } else { 0 }
    $skipped = if ($s.skipped) { $s.skipped } else { 0 }
    $total   = if ($s.total)   { $s.total }   else { 0 }

    $color = if ($failed -gt 0 -or $error_ -gt 0) { "Red" } else { "Green" }
    Write-Host ""
    Write-Host "  [$stage]  passed=$passed  failed=$failed  error=$error_  xfailed=$xfailed  skipped=$skipped  / $total total" -ForegroundColor $color

    # Print each failure with its error message
    $failures = $data.tests | Where-Object { $_.outcome -eq "failed" }
    foreach ($t in $failures) {
        Write-Host ""
        Write-Host "    FAIL: $($t.nodeid)" -ForegroundColor Red
        $msg = $t.call.longrepr
        # Trim to first 40 lines to keep it readable
        $lines = ($msg -split "`n") | Select-Object -First 40
        foreach ($line in $lines) {
            Write-Host "      $line" -ForegroundColor DarkRed
        }
    }
}

Write-Host ""
