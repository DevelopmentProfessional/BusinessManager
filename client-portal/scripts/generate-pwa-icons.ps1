$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\public\icons'
$outDir = [System.IO.Path]::GetFullPath($outDir)
if (!(Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

function New-CartIcon {
  param(
    [int]$Size,
    [string]$Path,
    [bool]$WithBg = $false
  )

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($WithBg) {
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 250, 251))
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()
  }

  $scale = $Size / 512.0

  $gray = [System.Drawing.Color]::FromArgb(255, 114, 122, 145)
  $red = [System.Drawing.Color]::FromArgb(255, 205, 66, 90)
  $light = [System.Drawing.Color]::FromArgb(255, 226, 232, 244)
  $wheel = [System.Drawing.Color]::FromArgb(255, 142, 150, 170)
  $hub = [System.Drawing.Color]::FromArgb(255, 218, 224, 236)

  $penGray = New-Object System.Drawing.Pen($gray, [float](16 * $scale))
  $penGray.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $penRed = New-Object System.Drawing.Pen($red, [float](20 * $scale))
  $penRed.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $brushLight = New-Object System.Drawing.SolidBrush($light)
  $brushWheel = New-Object System.Drawing.SolidBrush($wheel)
  $brushHub = New-Object System.Drawing.SolidBrush($hub)

  # Handle and frame
  $g.DrawLine($penGray, [float](32 * $scale), [float](78 * $scale), [float](136 * $scale), [float](78 * $scale))
  $g.DrawLine($penGray, [float](136 * $scale), [float](78 * $scale), [float](166 * $scale), [float](100 * $scale))
  $g.DrawLine($penGray, [float](166 * $scale), [float](100 * $scale), [float](240 * $scale), [float](408 * $scale))
  $g.DrawLine($penGray, [float](240 * $scale), [float](408 * $scale), [float](448 * $scale), [float](408 * $scale))

  # Basket body
  $basket = New-Object System.Drawing.Drawing2D.GraphicsPath
  [System.Drawing.PointF[]]$basketPoints = @(
    [System.Drawing.PointF]::new([float](170 * $scale), [float](132 * $scale)),
    [System.Drawing.PointF]::new([float](474 * $scale), [float](132 * $scale)),
    [System.Drawing.PointF]::new([float](450 * $scale), [float](330 * $scale)),
    [System.Drawing.PointF]::new([float](212 * $scale), [float](330 * $scale))
  )
  $basket.AddPolygon($basketPoints)
  $g.FillPath($brushLight, $basket)
  $g.DrawPath($penRed, $basket)

  # Basket grid
  for ($x = 198; $x -le 430; $x += 44) {
    $g.DrawLine($penGray, [float]($x * $scale), [float](150 * $scale), [float]($x * $scale), [float](330 * $scale))
  }
  for ($y = 178; $y -le 292; $y += 38) {
    $g.DrawLine($penGray, [float](188 * $scale), [float]($y * $scale), [float](458 * $scale), [float]($y * $scale))
  }

  # Lower red rail
  $g.DrawLine($penRed, [float](204 * $scale), [float](318 * $scale), [float](452 * $scale), [float](318 * $scale))

  # Wheels
  $g.FillEllipse($brushWheel, [float](226 * $scale), [float](404 * $scale), [float](86 * $scale), [float](86 * $scale))
  $g.FillEllipse($brushWheel, [float](358 * $scale), [float](404 * $scale), [float](86 * $scale), [float](86 * $scale))
  $g.FillEllipse($brushHub, [float](254 * $scale), [float](434 * $scale), [float](28 * $scale), [float](28 * $scale))
  $g.FillEllipse($brushHub, [float](386 * $scale), [float](434 * $scale), [float](28 * $scale), [float](28 * $scale))

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $basket.Dispose()
  $penGray.Dispose()
  $penRed.Dispose()
  $brushLight.Dispose()
  $brushWheel.Dispose()
  $brushHub.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

$sizes = @(32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512)
foreach ($s in $sizes) {
  New-CartIcon -Size $s -Path (Join-Path $outDir ("icon-$s.png"))
}

# maskable icon with padded background
New-CartIcon -Size 512 -Path (Join-Path $outDir 'icon-maskable-512.png') -WithBg $true

Copy-Item (Join-Path $outDir 'icon-180.png') (Join-Path $outDir 'apple-touch-icon.png') -Force
Copy-Item (Join-Path $outDir 'icon-32.png') (Join-Path $outDir 'favicon-32.png') -Force

Write-Host "Generated client portal icon set in $outDir"
