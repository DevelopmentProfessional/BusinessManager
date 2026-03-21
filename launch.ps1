
# ============================================================
#  BUSINESSMANAGER — UNIFIED LAUNCHER
#  Starts internal app and/or client portal with a GUI.
#  Run from the project root (BusinessManager folder).
# ============================================================

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

# ── Colours (match app brand palette) ────────────────────────────────────────
$clrBg        = [System.Drawing.Color]::FromArgb(249, 250, 251)   # gray-50
$clrCard      = [System.Drawing.Color]::White
$clrBorder    = [System.Drawing.Color]::FromArgb(229, 231, 235)   # gray-200
$clrPrimary   = [System.Drawing.Color]::FromArgb(79,  70,  229)   # indigo-600
$clrSuccess   = [System.Drawing.Color]::FromArgb(34,  197, 94)    # green-500
$clrDanger    = [System.Drawing.Color]::FromArgb(239, 68,  68)    # red-500
$clrWarning   = [System.Drawing.Color]::FromArgb(245, 158, 11)    # amber-500
$clrText      = [System.Drawing.Color]::FromArgb(17,  24,  39)    # gray-900
$clrMuted     = [System.Drawing.Color]::FromArgb(107, 114, 128)   # gray-500
$clrLogBg     = [System.Drawing.Color]::FromArgb(17,  24,  39)    # gray-900
$clrLogText   = [System.Drawing.Color]::FromArgb(209, 213, 219)   # gray-300

# ── Process tracking ──────────────────────────────────────────────────────────
$procs = @{
    InternalBackend  = $null
    InternalFrontend = $null
    ClientBackend    = $null
    ClientFrontend   = $null
}

# ── Python detection ──────────────────────────────────────────────────────────
function Find-Python {
    function Test-Py { param($exe, $args_)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { return $false }
        $null = & $exe @args_ -c "import sys; sys.exit(0)" 2>&1
        return ($LASTEXITCODE -eq 0)
    }
    if (Test-Path ".\.venv\Scripts\python.exe") {
        $v = (Resolve-Path ".\.venv\Scripts\python.exe").Path
        if (Test-Py $v @()) { return @{ exe = $v; args = @() } }
    }
    if (Test-Py "py" @("-3")) { return @{ exe = "py"; args = @("-3") } }
    if (Test-Py "python" @())  { return @{ exe = "python"; args = @() } }
    return $null
}

$py = Find-Python

# ── Helpers ───────────────────────────────────────────────────────────────────
function Is-Running($key) {
    $p = $procs[$key]
    if ($null -eq $p) { return $false }
    try { return (-not $p.HasExited) } catch { return $false }
}

function Any-Running {
    return ($procs.Keys | Where-Object { Is-Running $_ }).Count -gt 0
}

function Log($msg, $color = $clrLogText) {
    $logBox.SelectionStart  = $logBox.TextLength
    $logBox.SelectionLength = 0
    $logBox.SelectionColor  = $color
    $logBox.AppendText("$(Get-Date -Format 'HH:mm:ss')  $msg`n")
    $logBox.ScrollToCaret()
}

function Open-Url($url) {
    Start-Process $url
}

function Kill-Proc($key) {
    $p = $procs[$key]
    if ($null -ne $p) {
        try {
            # Kill the whole process tree (cmd.exe + child uvicorn/node)
            $children = Get-WmiObject Win32_Process |
                Where-Object { $_.ParentProcessId -eq $p.Id }
            $children | ForEach-Object {
                try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
            }
            if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
        } catch {}
        $procs[$key] = $null
    }
}

# ── Start functions ───────────────────────────────────────────────────────────
function Start-InternalBackend {
    if (Is-Running "InternalBackend") { Log "Internal backend already running." $clrWarning; return }
    if ($null -eq $py) { Log "Python not found!" $clrDanger; return }

    $cmd = "$($py.exe) $($py.args -join ' ') -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title [Internal Backend] && $cmd" `
        -WorkingDirectory $scriptDir -PassThru -WindowStyle Minimized
    $procs["InternalBackend"] = $p
    Log "Internal backend started  →  http://localhost:8000" $clrSuccess
}

function Start-InternalFrontend {
    if (Is-Running "InternalFrontend") { Log "Internal frontend already running." $clrWarning; return }

    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title [Internal Frontend] && npm run dev:frontend" `
        -WorkingDirectory $scriptDir -PassThru -WindowStyle Minimized
    $procs["InternalFrontend"] = $p
    Log "Internal frontend started  →  https://localhost:5173" $clrSuccess
}

function Start-ClientBackend {
    if (Is-Running "ClientBackend") { Log "Client API already running." $clrWarning; return }
    if ($null -eq $py) { Log "Python not found!" $clrDanger; return }

    $envFile = Join-Path $scriptDir "client-api\.env"
    $cmd = "$($py.exe) $($py.args -join ' ') -m uvicorn main:app --reload --host 127.0.0.1 --port 8001"
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title [Client API] && $cmd" `
        -WorkingDirectory (Join-Path $scriptDir "client-api") -PassThru -WindowStyle Minimized
    $procs["ClientBackend"] = $p
    Log "Client API started  →  http://localhost:8001" $clrSuccess
}

function Start-ClientFrontend {
    if (Is-Running "ClientFrontend") { Log "Client portal frontend already running." $clrWarning; return }

    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title [Client Portal] && npm run dev" `
        -WorkingDirectory (Join-Path $scriptDir "client-portal") -PassThru -WindowStyle Minimized
    $procs["ClientFrontend"] = $p
    Log "Client portal started  →  http://localhost:5174" $clrSuccess
}

function Stop-All {
    @("InternalBackend","InternalFrontend","ClientBackend","ClientFrontend") | ForEach-Object { Kill-Proc $_ }
    Log "All services stopped." $clrWarning
}

# ── UI builder helpers ────────────────────────────────────────────────────────
function New-Label($text, $x, $y, $w, $h, $font, $color = $clrText) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $text; $l.Location = [System.Drawing.Point]::new($x,$y)
    $l.Size = [System.Drawing.Size]::new($w,$h); $l.Font = $font
    $l.ForeColor = $color; $l.BackColor = [System.Drawing.Color]::Transparent
    return $l
}

function New-Btn($text, $x, $y, $w, $h, $bg, $fg = [System.Drawing.Color]::White) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text; $b.Location = [System.Drawing.Point]::new($x,$y)
    $b.Size = [System.Drawing.Size]::new($w,$h)
    $b.BackColor = $bg; $b.ForeColor = $fg
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = 0
    $b.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $b.Cursor = [System.Windows.Forms.Cursors]::Hand
    return $b
}

function New-Dot($x, $y) {
    $p = New-Object System.Windows.Forms.Panel
    $p.Size = [System.Drawing.Size]::new(12,12)
    $p.Location = [System.Drawing.Point]::new($x,$y)
    $p.BackColor = $clrDanger
    return $p
}

# ── Build the form ────────────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text          = "BusinessManager — Server Launcher"
$form.Size          = [System.Drawing.Size]::new(720, 640)
$form.MinimumSize   = [System.Drawing.Size]::new(720, 640)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor     = $clrBg
$form.Font          = New-Object System.Drawing.Font("Segoe UI", 9)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox   = $false
$form.Icon          = [System.Drawing.SystemIcons]::Application

$fontTitle  = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$fontSub    = New-Object System.Drawing.Font("Segoe UI", 9,  [System.Drawing.FontStyle]::Regular)
$fontBold   = New-Object System.Drawing.Font("Segoe UI", 9,  [System.Drawing.FontStyle]::Bold)
$fontMono   = New-Object System.Drawing.Font("Consolas", 8.5)
$fontSmall  = New-Object System.Drawing.Font("Segoe UI", 8)

# ── Header ────────────────────────────────────────────────────────────────────
$header = New-Object System.Windows.Forms.Panel
$header.Dock = [System.Windows.Forms.DockStyle]::Top
$header.Height = 64
$header.BackColor = $clrPrimary
$form.Controls.Add($header)

$hTitle = New-Label "BusinessManager" 20 10 400 28 $fontTitle ([System.Drawing.Color]::White)
$hSub   = New-Label "Server Launcher — Internal App  +  Client Portal" 20 36 500 20 $fontSub ([System.Drawing.Color]::FromArgb(199,210,254))
$header.Controls.AddRange(@($hTitle, $hSub))

# ── Card builder ──────────────────────────────────────────────────────────────
function New-Card($x, $y, $w, $h) {
    $c = New-Object System.Windows.Forms.Panel
    $c.Location = [System.Drawing.Point]::new($x,$y); $c.Size = [System.Drawing.Size]::new($w,$h)
    $c.BackColor = $clrCard
    $c.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    return $c
}

# ── INTERNAL APP card ─────────────────────────────────────────────────────────
$cardInt = New-Card 16 80 330 210
$form.Controls.Add($cardInt)

$cardInt.Controls.Add((New-Label "Internal App" 16 14 200 22 $fontBold))
$cardInt.Controls.Add((New-Label "Staff-facing dashboard & management" 16 36 300 18 $fontSmall $clrMuted))

# Status dots + labels
$dotIntB  = New-Dot 16 70;  $cardInt.Controls.Add($dotIntB)
$lblIntB  = New-Label "Backend   http://localhost:8000" 34 68 280 18 $fontSmall $clrMuted
$cardInt.Controls.Add($lblIntB)

$dotIntF  = New-Dot 16 94;  $cardInt.Controls.Add($dotIntF)
$lblIntF  = New-Label "Frontend  https://localhost:5173" 34 92 280 18 $fontSmall $clrMuted
$cardInt.Controls.Add($lblIntF)

$btnStartInt = New-Btn "Start Internal App" 16 124 140 34 $clrPrimary
$btnStopInt  = New-Btn "Stop" 164 124 70 34 $clrDanger
$btnOpenInt  = New-Btn "Open" 242 124 70 34 ([System.Drawing.Color]::FromArgb(75,85,99))
$cardInt.Controls.AddRange(@($btnStartInt, $btnStopInt, $btnOpenInt))

$cardInt.Controls.Add((New-Label "Starts backend (port 8000) + frontend (5173)" 16 166 300 18 $fontSmall $clrMuted))

# ── CLIENT PORTAL card ────────────────────────────────────────────────────────
$cardCli = New-Card 358 80 330 210
$form.Controls.Add($cardCli)

$cardCli.Controls.Add((New-Label "Client Portal" 16 14 200 22 $fontBold))
$cardCli.Controls.Add((New-Label "Customer-facing shop & booking portal" 16 36 300 18 $fontSmall $clrMuted))

$dotCliB  = New-Dot 16 70;  $cardCli.Controls.Add($dotCliB)
$lblCliB  = New-Label "Client API   http://localhost:8001" 34 68 280 18 $fontSmall $clrMuted
$cardCli.Controls.Add($lblCliB)

$dotCliF  = New-Dot 16 94;  $cardCli.Controls.Add($dotCliF)
$lblCliF  = New-Label "Frontend     http://localhost:5174" 34 92 280 18 $fontSmall $clrMuted
$cardCli.Controls.Add($lblCliF)

$btnStartCli = New-Btn "Start Client Portal" 16 124 140 34 ([System.Drawing.Color]::FromArgb(5,150,105))
$btnStopCli  = New-Btn "Stop" 164 124 70 34 $clrDanger
$btnOpenCli  = New-Btn "Open" 242 124 70 34 ([System.Drawing.Color]::FromArgb(75,85,99))
$cardCli.Controls.AddRange(@($btnStartCli, $btnStopCli, $btnOpenCli))

$cardCli.Controls.Add((New-Label "Starts client API (port 8001) + frontend (5174)" 16 166 300 18 $fontSmall $clrMuted))

# ── START ALL / STOP ALL row ──────────────────────────────────────────────────
$btnStartAll = New-Btn "▶  Start Both" 16  304 160 38 $clrPrimary
$btnStopAll  = New-Btn "■  Stop All"  186 304 160 38 $clrDanger
$form.Controls.AddRange(@($btnStartAll, $btnStopAll))

# ── Python / Node status row ──────────────────────────────────────────────────
$pyStatus  = if ($py) { "Python: $($py.exe)  ✓" } else { "Python: NOT FOUND  ✗" }
$pyColor   = if ($py) { $clrSuccess } else { $clrDanger }
$lblPy     = New-Label $pyStatus 16 352 340 18 $fontSmall $pyColor
$form.Controls.Add($lblPy)

# Check npm
$npmOk = $null -ne (Get-Command "npm" -ErrorAction SilentlyContinue)
$npmStatus = if ($npmOk) { "npm:    found  ✓" } else { "npm:    NOT FOUND  ✗" }
$npmColor  = if ($npmOk) { $clrSuccess } else { $clrDanger }
$lblNpm    = New-Label $npmStatus 370 352 330 18 $fontSmall $npmColor
$form.Controls.Add($lblNpm)

# ── Log panel ─────────────────────────────────────────────────────────────────
$logPanel = New-Object System.Windows.Forms.Panel
$logPanel.Location  = [System.Drawing.Point]::new(16, 378)
$logPanel.Size      = [System.Drawing.Size]::new(672, 210)
$logPanel.BackColor = $clrLogBg
$logPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$form.Controls.Add($logPanel)

$logLabel = New-Label "Console Output" 0 0 200 20 $fontSmall ([System.Drawing.Color]::FromArgb(156,163,175))
$logPanel.Controls.Add($logLabel)

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Location    = [System.Drawing.Point]::new(0, 22)
$logBox.Size        = [System.Drawing.Size]::new(672, 188)
$logBox.BackColor   = $clrLogBg
$logBox.ForeColor   = $clrLogText
$logBox.Font        = $fontMono
$logBox.ReadOnly    = $true
$logBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$logBox.ScrollBars  = [System.Windows.Forms.RichTextBoxScrollBars]::Vertical
$logPanel.Controls.Add($logBox)

# ── Status polling timer ──────────────────────────────────────────────────────
function Update-Dots {
    # Internal
    $dotIntB.BackColor  = if (Is-Running "InternalBackend")  { $clrSuccess } else { $clrDanger }
    $dotIntF.BackColor  = if (Is-Running "InternalFrontend") { $clrSuccess } else { $clrDanger }
    # Client
    $dotCliB.BackColor  = if (Is-Running "ClientBackend")    { $clrSuccess } else { $clrDanger }
    $dotCliF.BackColor  = if (Is-Running "ClientFrontend")   { $clrSuccess } else { $clrDanger }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000   # poll every 2 seconds
$timer.Add_Tick({ Update-Dots })
$timer.Start()

# ── Button wiring ─────────────────────────────────────────────────────────────
$btnStartInt.Add_Click({
    Start-InternalBackend
    Start-Sleep -Milliseconds 600
    Start-InternalFrontend
    Update-Dots
})

$btnStopInt.Add_Click({
    Kill-Proc "InternalBackend"; Kill-Proc "InternalFrontend"
    Log "Internal app stopped." $clrWarning; Update-Dots
})

$btnOpenInt.Add_Click({ Open-Url "https://localhost:5173" })

$btnStartCli.Add_Click({
    Start-ClientBackend
    Start-Sleep -Milliseconds 600
    Start-ClientFrontend
    Update-Dots
})

$btnStopCli.Add_Click({
    Kill-Proc "ClientBackend"; Kill-Proc "ClientFrontend"
    Log "Client portal stopped." $clrWarning; Update-Dots
})

$btnOpenCli.Add_Click({ Open-Url "http://localhost:5174" })

$btnStartAll.Add_Click({
    Log "Starting all services…" $clrPrimary
    Start-InternalBackend
    Start-ClientBackend
    Start-Sleep -Milliseconds 600
    Start-InternalFrontend
    Start-ClientFrontend
    Update-Dots
    Log "All services launched. Windows are minimised in the taskbar." $clrSuccess
})

$btnStopAll.Add_Click({
    Log "Stopping all services…" $clrWarning
    Stop-All
    Update-Dots
})

$form.Add_FormClosing({
    $timer.Stop()
    if (Any-Running) {
        $result = [System.Windows.Forms.MessageBox]::Show(
            "Services are still running.`nStop them before closing?",
            "BusinessManager Launcher",
            [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($result -eq [System.Windows.Forms.DialogResult]::Cancel) {
            $_.Cancel = $true; $timer.Start(); return
        }
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            Stop-All
        }
    }
})

# ── Initial log messages ──────────────────────────────────────────────────────
Log "BusinessManager Launcher ready." $clrPrimary
if ($py) {
    Log "Python found: $($py.exe)" $clrSuccess
} else {
    Log "WARNING: Python not found. Backend services will not start." $clrDanger
    Log "Install Python from python.org or activate your .venv" $clrWarning
}
if (-not $npmOk) {
    Log "WARNING: npm not found. Frontend services will not start." $clrDanger
}
Log "Click 'Start Both' to launch everything, or start services individually." $clrLogText

# ── Show the form ─────────────────────────────────────────────────────────────
[System.Windows.Forms.Application]::Run($form)
