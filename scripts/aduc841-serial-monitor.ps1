<#
  Passive ADuC841 / CP210x UART diagnostic.

  Default operation only listens. It never writes to the board, erases Flash,
  or changes the application. Press the physical RESET while this monitor is
  open: a healthy ADuC841 Version 2 loader emits a 25-byte "ADI 841" ID.

  Example:
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\aduc841-serial-monitor.ps1 -Port COM10

  Add -Interrogate only after the passive test. It sends the documented
  21 5A 00 A6 Version 2 identification packet after the listen window.

  Add -EraseCode to send exactly one documented erase-code packet only after
  a complete loader ID has been validated. This erases program Flash.
#>
[CmdletBinding()]
param(
  [string]$Port = "COM10",
  [ValidateRange(300, 115200)]
  [int]$BaudRate = 9600,
  [ValidateRange(2, 60)]
  [int]$ListenSeconds = 10,
  [switch]$Interrogate,
  [switch]$EraseCode
)

$ErrorActionPreference = "Stop"
try { $Host.UI.RawUI.WindowTitle = "ADuC841 Native COM Monitor - $Port" } catch {}

function Write-Log([string]$Kind, [string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
  $elapsed = ([DateTime]::UtcNow - $script:StartedAt).TotalSeconds
  Write-Host ("{0,8:N3}s  {1,-5}  {2}" -f $elapsed, $Kind, $Message) -ForegroundColor $Color
}

function Find-LoaderId([System.Collections.Generic.List[byte]]$Bytes) {
  for ($start = 0; $start + 25 -le $Bytes.Count; $start += 1) {
    $packet = [byte[]]$Bytes.GetRange($start, 25).ToArray()
    $text = [Text.Encoding]::ASCII.GetString($packet, 0, 24)
    if ($text -notmatch "ADI.{0,8}(841|842|843)") { continue }
    $sum = 0
    foreach ($value in $packet) { $sum = ($sum + $value) -band 0xFF }
    if ($sum -eq 0) {
      return $text.Replace("`0", " ").Trim()
    }
  }
  return $null
}

$script:StartedAt = [DateTime]::UtcNow
$serial = [System.IO.Ports.SerialPort]::new($Port, $BaudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.Handshake = [System.IO.Ports.Handshake]::None
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.ReadTimeout = 120
$serial.WriteTimeout = 1000
$received = [System.Collections.Generic.List[byte]]::new()

try {
  Write-Log "STATE" "Opening $Port - $BaudRate baud, 8N1, RTS/DTR inactive"
  $serial.Open()
  Write-Log "STATE" "PASSIVE TEST: press RESET on the board now. No bytes will be sent for $ListenSeconds seconds." Cyan

  $initialDeadline = [DateTime]::UtcNow.AddSeconds($ListenSeconds)
  $finalDeadline = if ($Interrogate) { $initialDeadline.AddSeconds(3) } else { $initialDeadline }
  $interrogationSent = $false
  $loaderId = $null

  while ([DateTime]::UtcNow -lt $finalDeadline) {
    if ($Interrogate -and -not $interrogationSent -and [DateTime]::UtcNow -ge $initialDeadline) {
      $probe = [byte[]](0x21, 0x5A, 0x00, 0xA6)
      $serial.Write($probe, 0, $probe.Length)
      $interrogationSent = $true
      Write-Log "TX" "Interrogate Version 2 loader  21 5A 00 A6" Yellow
    }

    while ($serial.BytesToRead -gt 0) {
      $value = $serial.ReadByte()
      if ($value -lt 0) { break }
      $byte = [byte]$value
      [void]$received.Add($byte)
      $ascii = if ($byte -ge 0x20 -and $byte -le 0x7E) { [char]$byte } else { "." }
      Write-Log "RX" ("0x{0:X2}  '{1}'" -f $byte, $ascii) Green
      $loaderId = Find-LoaderId $received
      if ($loaderId) {
        Write-Log "OK" "Complete 25-byte loader ID: $loaderId" Green
        break
      }
    }
    if ($loaderId) { break }
    Start-Sleep -Milliseconds 5
  }

  if (-not $loaderId) {
    Write-Log "RESULT" "No complete, checksum-valid 25-byte ADI loader ID was received." Red
  }
  elseif ($EraseCode) {
    $erase = [byte[]](0x07, 0x0E, 0x01, 0x43, 0xBC)
    $serial.Write($erase, 0, $erase.Length)
    Write-Log "TX" "Erase CODE Flash  07 0E 01 43 BC" Yellow
    $ackDeadline = [DateTime]::UtcNow.AddSeconds(8)
    $acknowledged = $false
    while ([DateTime]::UtcNow -lt $ackDeadline) {
      while ($serial.BytesToRead -gt 0) {
        $value = $serial.ReadByte()
        if ($value -lt 0) { break }
        $byte = [byte]$value
        Write-Log "RX" ("0x{0:X2}" -f $byte) Green
        if ($byte -eq 0x06) {
          Write-Log "OK" "ACK 0x06: erase completed." Green
          $acknowledged = $true
          break
        }
        if ($byte -eq 0x07) {
          Write-Log "RESULT" "NAK 0x07: the loader rejected erase." Red
          $acknowledged = $true
          break
        }
      }
      if ($acknowledged) { break }
      Start-Sleep -Milliseconds 5
    }
    if (-not $acknowledged) {
      Write-Log "RESULT" "No ACK/NAK was received within 8 seconds of erase." Red
    }
  }
}
catch {
  Write-Log "ERROR" ("{0}: {1}" -f $_.Exception.GetType().Name, $_.Exception.Message) Red
}
finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
  Write-Log "STATE" "COM port closed"
  Write-Host "`nPress Enter to close this window..." -ForegroundColor DarkGray
  [void][Console]::ReadLine()
}
