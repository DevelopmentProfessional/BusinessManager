# PowerShell script to shift all event times in an .ics file by -2 hours

$inputPath = "$env:USERPROFILE\Downloads\Jamaica 2026_dpinto005@gmail.com.ics"
$outputPath = "$env:USERPROFILE\Downloads\Jamaica 2026_fixed.ics"

function Shift-Time($dt) {
    if ($dt -match '(\d{8}T\d{6})Z') {
        $date = [datetime]::ParseExact($matches[1], "yyyyMMdd'T'HHmmss", $null)
        return ($date.AddHours(-2).ToString("yyyyMMdd'T'HHmmss") + "Z")
    } elseif ($dt -match '(\d{8}T\d{6})') {
        $date = [datetime]::ParseExact($matches[1], "yyyyMMdd'T'HHmmss", $null)
        return $date.AddHours(-2).ToString("yyyyMMdd'T'HHmmss")
    } else {
        return $dt
    }
}

Get-Content $inputPath | ForEach-Object {
    if ($_ -match '^(DTSTART.*:)(\d{8}T\d{6}Z)$') {
        "$($matches[1])$(Shift-Time $matches[2])"
    } elseif ($_ -match '^(DTEND.*:)(\d{8}T\d{6}Z)$') {
        "$($matches[1])$(Shift-Time $matches[2])"
    } elseif ($_ -match '^(DTSTART.*:)(\d{8}T\d{6})$') {
        "$($matches[1])$(Shift-Time $matches[2])"
    } elseif ($_ -match '^(DTEND.*:)(\d{8}T\d{6})$') {
        "$($matches[1])$(Shift-Time $matches[2])"
    } else {
        $_
    }
} | Set-Content $outputPath

Write-Host "Done! Fixed file saved as $outputPath"