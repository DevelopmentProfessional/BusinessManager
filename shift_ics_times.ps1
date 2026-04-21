# PowerShell script to add 2 hours to DTSTART times in an .ics file (except all-day events)
$inputFile = "C:\Users\ISDP19659\Downloads\Jamaica 2026_dpinto005@gmail.com.ics"
$outputFile = "C:\Users\ISDP19659\Downloads\Jamaica 2026_dpinto005_shifted.ics"

# Read all lines
$lines = Get-Content $inputFile
$result = @()
foreach ($line in $lines) {
    if ($line -match '^(DTSTART(?:;TZID=[^:]+)?):(\d{8}T\d{4,6})(Z?)$') {
        $prefix = $matches[1]
        $dtstr = $matches[2]
        $z = $matches[3]
        # Parse date/time
        if ($dtstr.Length -eq 15) {
            $dt = [datetime]::ParseExact($dtstr, 'yyyyMMdd\THHmmss', $null)
            $newdt = $dt.AddHours(2)
            $newdtstr = $newdt.ToString('yyyyMMddTHHmmss')
        } elseif ($dtstr.Length -eq 13) {
            $dt = [datetime]::ParseExact($dtstr, 'yyyyMMdd\THHmm', $null)
            $newdt = $dt.AddHours(2)
            $newdtstr = $newdt.ToString('yyyyMMddTHHmm')
        } else {
            $newdtstr = $dtstr
        }
        $result += "${prefix}:${newdtstr}${z}"
    } else {
        $result += $line
    }
}
$result | Set-Content $outputFile -Encoding UTF8
Write-Output "Shifted calendar saved to $outputFile"