# Mechanical size reduction of the existing official transparent logo for PDF embedding.
# The source asset is never edited; no pixels are recolored or redrawn.
Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $PSScriptRoot '..\src\assets\logo-dark-theme.png'
$targetPath = Join-Path $PSScriptRoot '..\src\assets\maxxis\report-official-logo.png'
$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  $targetWidth = 600
  $targetHeight = [int][Math]::Round($source.Height * $targetWidth / $source.Width)
  $target = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, $targetWidth, $targetHeight)
    } finally { $graphics.Dispose() }
    $target.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $target.Dispose() }
} finally { $source.Dispose() }
