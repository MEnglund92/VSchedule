$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\Matt\Desktop\Veronikas schema\icons"
$out192 = Join-Path $dir 'icon-192.png'
$out512 = Join-Path $dir 'icon-512.png'

function New-Icon {
  param([int]$size, [string]$out)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, ([System.Drawing.Color]::FromArgb(59,130,246)), ([System.Drawing.Color]::FromArgb(139,92,246)), 45.0)
  $g.FillRectangle($bg, $rect)

  $pad = [float]($size * 0.16)
  $cw = [float]($size - 2*$pad)
  $ch = [float]($size * 0.66)
  $cx = [float]($pad)
  $cy = [float]($size * 0.15)

  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $frameArgs = @($cx, $cy, $cw, $ch)
  $frame = New-Object System.Drawing.RectangleF -ArgumentList $frameArgs
  $g.FillRectangle($white, $frame)

  $ib = [float]($size * 0.02)
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30,41,59))
  $bodyArgs = @(($cx+$ib), ($cy+$ib), ($cw-2*$ib), ($ch-2*$ib))
  $body = New-Object System.Drawing.RectangleF -ArgumentList $bodyArgs
  $g.FillRectangle($dark, $body)

  $ringW = [float]($size * 0.12)
  $ringH = [float]($size * 0.18)
  $ringArgs1 = @(($cx + $size*0.06), ($cy + $size*0.03), $ringW, $ringH)
  $ringArgs2 = @(($cx + $cw - $size*0.18), ($cy + $size*0.03), $ringW, $ringH)
  $ring1 = New-Object System.Drawing.RectangleF -ArgumentList $ringArgs1
  $ring2 = New-Object System.Drawing.RectangleF -ArgumentList $ringArgs2
  $g.FillEllipse($white, $ring1)
  $g.FillEllipse($white, $ring2)

  $bandH = [float]($size * 0.13)
  $bandArgs = @(($cx+$ib), ($cy+$ib), ($cw-2*$ib), $bandH)
  $band = New-Object System.Drawing.RectangleF -ArgumentList $bandArgs
  $g.FillRectangle($white, $band)

  $fontSize = [float]($size * 0.34)
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $blue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(59,130,246))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $txtArgs = @([float]0, [float]($size*0.34), [float]$size, [float]($size*0.5))
  $txtRect = New-Object System.Drawing.RectangleF -ArgumentList $txtArgs
  $g.DrawString('V', $font, $blue, $txtRect, $sf)

  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon -size 512 -out $out512
New-Icon -size 192 -out $out192
Write-Output 'generated OK'
Get-ChildItem $dir | Select-Object Name, Length | Format-Table -AutoSize