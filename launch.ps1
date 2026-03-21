# ============================================================
#  BUSINESSMANAGER -- UNIFIED LAUNCHER
#  Starts internal app and/or client portal with a GUI.
#  Run from the project root (BusinessManager folder).
# ============================================================

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

# -- Colours (match app brand palette) ----------------------------------------
$clrBg       = [System.Drawing.Color]::FromArgb(249, 250, 251)
$clrCard     = [System.Drawing.Color]::White
$clrPrimary  = [System.Drawing.Color]::FromArgb(79,  70,  229)
$clrGreen    = [System.Drawing.Color]::FromArgb(5,   150, 105)
$clrSuccess  = [System.Drawing.Color]::FromArgb(34,  197, 94)
$clrDanger   = [System.Drawing.Color]::FromArgb(239, 68,  68)
$clrWarning  = [System.Drawing.Color]::FromArgb(245, 158, 11)
$clrText     = [System.Drawing.Color]::FromArgb(17,  24,  39)
$clrMuted    = [System.Drawing.Color]::FromArgb(107, 114, 128)
$clrLogBg    = [System.Drawing.Color]::FromArgb(17,  24,  39)
$clrLogText  = [System.Drawing.Color]::FromArgb(209, 213, 219)
$clrDarkBtn  = [System.Drawing.Color]::FromArgb(75,  85,  99)
$clrHdrSub   = [System.Drawing.Color]::FromArgb(199, 210, 254)

# -- Process tracking ----------------------------------------------------------
$script:procs = @{
    InternalBackend  = $null
    InternalFrontend = $null
    ClientBackend    = $null
    ClientFrontend   = $null
}

# -- Python detection ----------------------------------------------------------
function Find-Python {
    function Test-Py {
        param($exe, $extraArgs)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { return $false }
        $null = & $exe @extraArgs -c "import sys; sys.exit(0)" 2>&1
        return ($LASTEXITCODE -eq 0)
    }
    if (Test-Path ".\.venv\Scripts\python.exe") {
        $v = (Resolve-Path ".\.venv\Scripts\python.exe").Path
        if (Test-Py $v @()) { return @{ exe = $v; args = @() } }
    }
    if (Test-Py "py" @("-3"))    { return @{ exe = "py";     args = @("-3") } }
    if (Test-Py "python" @())    { return @{ exe = "python"; args = @() } }
    return $null
}

$script:py = Find-Python

# -- Helpers -------------------------------------------------------------------
function Is-Running($key) {
    $p = $script:procs[$key]
    if ($null -eq $p) { return $false }
    try { return (-not $p.HasExited) } catch { return $false }
}

function Any-Running {
    foreach ($k in $script:procs.Keys) { if (Is-Running $k) { return $true } }
    return $false
}

function Write-Log($msg, $color) {
    if ($null -eq $color) { $color = $clrLogText }
    $script:logBox.SelectionStart  = $script:logBox.TextLength
    $script:logBox.SelectionLength = 0
    $script:logBox.SelectionColor  = $color
    $script:logBox.AppendText("$(Get-Date -Format 'HH:mm:ss')  $msg`n")
    $script:logBox.ScrollToCaret()
}

function Kill-Proc($key) {
    $p = $script:procs[$key]
    if ($null -ne $p) {
        try {
            $children = Get-WmiObject Win32_Process -ErrorAction SilentlyContinue |
                Where-Object { $_.ParentProcessId -eq $p.Id }
            foreach ($c in $children) {
                try { Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
            }
            if (-not $p.HasExited) {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
        $script:procs[$key] = $null
    }
}

# -- Service launchers ---------------------------------------------------------
function Start-InternalBackend {
    if (Is-Running "InternalBackend") { Write-Log "Internal backend already running." $clrWarning; return }
    if ($null -eq $script:py)         { Write-Log "Python not found -- cannot start backend." $clrDanger; return }
    $exe  = $script:py.exe
    $args = ($script:py.args + @("-m","uvicorn","backend.main:app","--reload","--host","127.0.0.1","--port","8000")) -join " "
    $p = Start-Process "cmd.exe" -ArgumentList "/k title [Internal Backend] && $exe $args" `
         -WorkingDirectory $scriptDir -PassThru -WindowStyle Minimized
    $script:procs["InternalBackend"] = $p
    Write-Log "Internal backend started  ->  http://localhost:8000" $clrSuccess
}

function Start-InternalFrontend {
    if (Is-Running "InternalFrontend") { Write-Log "Internal frontend already running." $clrWarning; return }
    $p = Start-Process "cmd.exe" -ArgumentList "/k title [Internal Frontend] && npm run dev:frontend" `
         -WorkingDirectory $scriptDir -PassThru -WindowStyle Minimized
    $script:procs["InternalFrontend"] = $p
    Write-Log "Internal frontend started  ->  https://localhost:5173" $clrSuccess
}

function Start-ClientBackend {
    if (Is-Running "ClientBackend") { Write-Log "Client API already running." $clrWarning; return }
    if ($null -eq $script:py)       { Write-Log "Python not found -- cannot start client API." $clrDanger; return }
    $exe  = $script:py.exe
    $args = ($script:py.args + @("-m","uvicorn","main:app","--reload","--host","127.0.0.1","--port","8001")) -join " "
    $clientDir = Join-Path $scriptDir "client-api"
    $p = Start-Process "cmd.exe" -ArgumentList "/k title [Client API] && $exe $args" `
         -WorkingDirectory $clientDir -PassThru -WindowStyle Minimized
    $script:procs["ClientBackend"] = $p
    Write-Log "Client API started  ->  http://localhost:8001" $clrSuccess
}

function Start-ClientFrontend {
    if (Is-Running "ClientFrontend") { Write-Log "Client portal already running." $clrWarning; return }
    $portalDir = Join-Path $scriptDir "client-portal"
    $p = Start-Process "cmd.exe" -ArgumentList "/k title [Client Portal] && npm run dev" `
         -WorkingDirectory $portalDir -PassThru -WindowStyle Minimized
    $script:procs["ClientFrontend"] = $p
    Write-Log "Client portal started  ->  http://localhost:5174" $clrSuccess
}

function Stop-All {
    Kill-Proc "InternalBackend"
    Kill-Proc "InternalFrontend"
    Kill-Proc "ClientBackend"
    Kill-Proc "ClientFrontend"
    Write-Log "All services stopped." $clrWarning
}

# -- UI helpers ----------------------------------------------------------------
function New-Label($text, $x, $y, $w, $h, $font, $fore) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text      = $text
    $l.Location  = New-Object System.Drawing.Point($x, $y)
    $l.Size      = New-Object System.Drawing.Size($w, $h)
    $l.Font      = $font
    $l.ForeColor = $fore
    $l.BackColor = [System.Drawing.Color]::Transparent
    return $l
}

function New-Btn($text, $x, $y, $w, $h, $bg, $fg) {
    if ($null -eq $fg) { $fg = [System.Drawing.Color]::White }
    $b = New-Object System.Windows.Forms.Button
    $b.Text      = $text
    $b.Location  = New-Object System.Drawing.Point($x, $y)
    $b.Size      = New-Object System.Drawing.Size($w, $h)
    $b.BackColor = $bg
    $b.ForeColor = $fg
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = 0
    $b.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $b.Cursor    = [System.Windows.Forms.Cursors]::Hand
    return $b
}

function New-Dot($x, $y) {
    $p = New-Object System.Windows.Forms.Panel
    $p.Size      = New-Object System.Drawing.Size(12, 12)
    $p.Location  = New-Object System.Drawing.Point($x, $y)
    $p.BackColor = $clrDanger
    return $p
}

function New-Card($x, $y, $w, $h) {
    $c = New-Object System.Windows.Forms.Panel
    $c.Location    = New-Object System.Drawing.Point($x, $y)
    $c.Size        = New-Object System.Drawing.Size($w, $h)
    $c.BackColor   = $clrCard
    $c.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    return $c
}

function Update-Dots {
    $script:dotIntB.BackColor = if (Is-Running "InternalBackend")  { $clrSuccess } else { $clrDanger }
    $script:dotIntF.BackColor = if (Is-Running "InternalFrontend") { $clrSuccess } else { $clrDanger }
    $script:dotCliB.BackColor = if (Is-Running "ClientBackend")    { $clrSuccess } else { $clrDanger }
    $script:dotCliF.BackColor = if (Is-Running "ClientFrontend")   { $clrSuccess } else { $clrDanger }
}

# -- Fonts ---------------------------------------------------------------------
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$fontBold  = New-Object System.Drawing.Font("Segoe UI", 9,  [System.Drawing.FontStyle]::Bold)
$fontReg   = New-Object System.Drawing.Font("Segoe UI", 9,  [System.Drawing.FontStyle]::Regular)
$fontSmall = New-Object System.Drawing.Font("Segoe UI", 8,  [System.Drawing.FontStyle]::Regular)
$fontMono  = New-Object System.Drawing.Font("Consolas", 8.5)

# -- Form ----------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text            = "BusinessManager -- Server Launcher"
$form.Size            = New-Object System.Drawing.Size(720, 640)
$form.MinimumSize     = New-Object System.Drawing.Size(720, 640)
$form.MaximumSize     = New-Object System.Drawing.Size(720, 640)
$form.StartPosition   = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor       = $clrBg
$form.Font            = $fontReg
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox     = $false

# -- Header --------------------------------------------------------------------
$header = New-Object System.Windows.Forms.Panel
$header.Dock      = [System.Windows.Forms.DockStyle]::Top
$header.Height    = 64
$header.BackColor = $clrPrimary
$form.Controls.Add($header)

$header.Controls.Add((New-Label "BusinessManager" 20 10 400 28 $fontTitle ([System.Drawing.Color]::White)))
$header.Controls.Add((New-Label "Server Launcher  --  Internal App  +  Client Portal" 20 36 500 20 $fontSmall $clrHdrSub))

# -- Internal App card ---------------------------------------------------------
$cardInt = New-Card 16 80 330 220
$form.Controls.Add($cardInt)

$cardInt.Controls.Add((New-Label "Internal App"                          16 14 200 22 $fontBold  $clrText))
$cardInt.Controls.Add((New-Label "Staff-facing dashboard and management" 16 36 300 18 $fontSmall $clrMuted))

$script:dotIntB = New-Dot 16 72
$script:dotIntF = New-Dot 16 96
$cardInt.Controls.Add($script:dotIntB)
$cardInt.Controls.Add($script:dotIntF)
$cardInt.Controls.Add((New-Label "Backend   http://localhost:8000"  34 70 280 18 $fontSmall $clrMuted))
$cardInt.Controls.Add((New-Label "Frontend  https://localhost:5173" 34 94 280 18 $fontSmall $clrMuted))

$btnStartInt = New-Btn "Start Internal" 16 124 130 34 $clrPrimary $null
$btnStopInt  = New-Btn "Stop"          154 124  60 34 $clrDanger  $null
$btnOpenInt  = New-Btn "Open"          222 124  80 34 $clrDarkBtn $null
$cardInt.Controls.AddRange(@($btnStartInt, $btnStopInt, $btnOpenInt))
$cardInt.Controls.Add((New-Label "Backend :8000  +  Frontend :5173" 16 168 300 18 $fontSmall $clrMuted))

# -- Client Portal card --------------------------------------------------------
$cardCli = New-Card 358 80 330 220
$form.Controls.Add($cardCli)

$cardCli.Controls.Add((New-Label "Client Portal"                          16 14 200 22 $fontBold  $clrText))
$cardCli.Controls.Add((New-Label "Customer-facing shop and booking portal" 16 36 300 18 $fontSmall $clrMuted))

$script:dotCliB = New-Dot 16 72
$script:dotCliF = New-Dot 16 96
$cardCli.Controls.Add($script:dotCliB)
$cardCli.Controls.Add($script:dotCliF)
$cardCli.Controls.Add((New-Label "Client API  http://localhost:8001"  34 70 280 18 $fontSmall $clrMuted))
$cardCli.Controls.Add((New-Label "Frontend    http://localhost:5174"  34 94 280 18 $fontSmall $clrMuted))

$btnStartCli = New-Btn "Start Portal" 16 124 130 34 $clrGreen   $null
$btnStopCli  = New-Btn "Stop"        154 124  60 34 $clrDanger  $null
$btnOpenCli  = New-Btn "Open"        222 124  80 34 $clrDarkBtn $null
$cardCli.Controls.AddRange(@($btnStartCli, $btnStopCli, $btnOpenCli))
$cardCli.Controls.Add((New-Label "Client API :8001  +  Frontend :5174" 16 168 300 18 $fontSmall $clrMuted))

# -- Start Both / Stop All row -------------------------------------------------
$btnStartAll = New-Btn ">> Start Both" 16  314 160 38 $clrPrimary $null
$btnStopAll  = New-Btn "[] Stop All"  186  314 160 38 $clrDanger  $null
$form.Controls.AddRange(@($btnStartAll, $btnStopAll))

# -- Python / npm status -------------------------------------------------------
$pyTxt   = if ($script:py)  { "Python : $($script:py.exe)  [OK]" } else { "Python : NOT FOUND  [X]" }
$pyClr   = if ($script:py)  { $clrSuccess } else { $clrDanger }
$npmOk   = $null -ne (Get-Command "npm" -ErrorAction SilentlyContinue)
$npmTxt  = if ($npmOk) { "npm : found  [OK]" } else { "npm : NOT FOUND  [X]" }
$npmClr  = if ($npmOk) { $clrSuccess } else { $clrDanger }

$form.Controls.Add((New-Label $pyTxt   16  362 340 18 $fontSmall $pyClr))
$form.Controls.Add((New-Label $npmTxt 370  362 330 18 $fontSmall $npmClr))

# -- Log panel -----------------------------------------------------------------
$logOuter = New-Object System.Windows.Forms.Panel
$logOuter.Location    = New-Object System.Drawing.Point(16, 388)
$logOuter.Size        = New-Object System.Drawing.Size(672, 210)
$logOuter.BackColor   = $clrLogBg
$logOuter.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$form.Controls.Add($logOuter)

$logOuter.Controls.Add((New-Label "Console Output" 0 0 200 20 $fontSmall ([System.Drawing.Color]::FromArgb(156,163,175))))

$script:logBox = New-Object System.Windows.Forms.RichTextBox
$script:logBox.Location    = New-Object System.Drawing.Point(0, 22)
$script:logBox.Size        = New-Object System.Drawing.Size(672, 188)
$script:logBox.BackColor   = $clrLogBg
$script:logBox.ForeColor   = $clrLogText
$script:logBox.Font        = $fontMono
$script:logBox.ReadOnly    = $true
$script:logBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$script:logBox.ScrollBars  = [System.Windows.Forms.RichTextBoxScrollBars]::Vertical
$logOuter.Controls.Add($script:logBox)

# -- Status polling timer ------------------------------------------------------
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({ Update-Dots })
$timer.Start()

# -- Button events -------------------------------------------------------------
$btnStartInt.Add_Click({
    Start-InternalBackend
    Start-Sleep -Milliseconds 500
    Start-InternalFrontend
    Update-Dots
})

$btnStopInt.Add_Click({
    Kill-Proc "InternalBackend"
    Kill-Proc "InternalFrontend"
    Write-Log "Internal app stopped." $clrWarning
    Update-Dots
})

$btnOpenInt.Add_Click({
    Start-Process "https://localhost:5173"
})

$btnStartCli.Add_Click({
    Start-ClientBackend
    Start-Sleep -Milliseconds 500
    Start-ClientFrontend
    Update-Dots
})

$btnStopCli.Add_Click({
    Kill-Proc "ClientBackend"
    Kill-Proc "ClientFrontend"
    Write-Log "Client portal stopped." $clrWarning
    Update-Dots
})

$btnOpenCli.Add_Click({
    Start-Process "http://localhost:5174"
})

$btnStartAll.Add_Click({
    Write-Log "Starting all services..." $clrPrimary
    Start-InternalBackend
    Start-ClientBackend
    Start-Sleep -Milliseconds 600
    Start-InternalFrontend
    Start-ClientFrontend
    Update-Dots
    Write-Log "All services launched. Check the taskbar for console windows." $clrSuccess
})

$btnStopAll.Add_Click({
    Write-Log "Stopping all services..." $clrWarning
    Stop-All
    Update-Dots
})

$form.Add_FormClosing({
    param($s, $e)
    $timer.Stop()
    if (Any-Running) {
        $res = [System.Windows.Forms.MessageBox]::Show(
            "Services are still running. Stop them before closing?",
            "BusinessManager Launcher",
            [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($res -eq [System.Windows.Forms.DialogResult]::Cancel) {
            $e.Cancel = $true
            $timer.Start()
            return
        }
        if ($res -eq [System.Windows.Forms.DialogResult]::Yes) {
            Stop-All
        }
    }
})

# -- Startup log ---------------------------------------------------------------
Write-Log "BusinessManager Launcher ready." $clrPrimary
if ($script:py) {
    Write-Log "Python : $($script:py.exe)" $clrSuccess
} else {
    Write-Log "WARNING: Python not found. Backend services will not start." $clrDanger
}
if (-not $npmOk) {
    Write-Log "WARNING: npm not found. Frontend services will not start." $clrDanger
}
Write-Log "Click 'Start Both' to launch everything at once." $clrLogText

# -- Show form -----------------------------------------------------------------
[System.Windows.Forms.Application]::Run($form)
