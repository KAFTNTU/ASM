<#
  Native ADuC841 Version 2 UART uploader for the ST841 stand.

  Uses Windows SerialPort instead of browser Web Serial. It validates the
  automatic 25-byte loader ID, erases CODE Flash, programs Intel HEX bytes in
  documented 21-byte blocks, then runs from 0x0000.

  Example:
    powershell.exe -ExecutionPolicy Bypass -File .\scripts\aduc841-native-uploader.ps1 `
      -HexFile C:\Users\Admin\Downloads\main.hex -Port COM10
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$HexFile,
  [string]$Port = "COM10",
  [ValidateRange(300, 115200)]
  [int]$BaudRate = 9600,
  [switch]$NoRun
)

$ErrorActionPreference = "Stop"
try { $Host.UI.RawUI.WindowTitle = "ADuC841 Native Uploader - $Port" } catch {}
$script:StartedAt = [DateTime]::UtcNow

function Write-Log([string]$Kind, [string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
  $elapsed = ([DateTime]::UtcNow - $script:StartedAt).TotalSeconds
  Write-Host ("{0,8:N3}s  {1,-6} {2}" -f $elapsed, $Kind, $Message) -ForegroundColor $Color
}

function Get-HexByte([string]$Line, [int]$Offset) {
  return [Convert]::ToByte($Line.Substring($Offset, 2), 16)
}

function Read-IntelHex([string]$Path) {
  $memory = @{}
  $upperAddress = 0
  $lineNumber = 0
  $ended = $false
  foreach ($rawLine in [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path))) {
    $lineNumber += 1
    $line = $rawLine.Trim()
    if (-not $line) { continue }
    if ($ended) { throw "HEX line $lineNumber occurs after the EOF record." }
    if (-not $line.StartsWith(":")) { throw "HEX line $lineNumber does not start with ':'." }
    if (($line.Length -lt 11) -or (($line.Length - 1) % 2 -ne 0)) { throw "HEX line $lineNumber has invalid length." }
    $count = Get-HexByte $line 1
    if ($line.Length -ne 11 + (2 * $count)) { throw "HEX line $lineNumber length does not match its byte count." }
    $sum = 0
    for ($offset = 1; $offset -lt $line.Length; $offset += 2) {
      $sum = ($sum + (Get-HexByte $line $offset)) -band 0xFF
    }
    if ($sum -ne 0) { throw "HEX line $lineNumber has an invalid checksum." }
    $address = ((Get-HexByte $line 3) -shl 8) -bor (Get-HexByte $line 5)
    $recordType = Get-HexByte $line 7
    $data = [byte[]]@()
    if ($count) {
      $data = [byte[]](0..($count - 1) | ForEach-Object { Get-HexByte $line (9 + (2 * $_)) })
    }
    switch ($recordType) {
      0x00 {
        for ($index = 0; $index -lt $data.Length; $index += 1) {
          $absoluteAddress = $upperAddress + $address + $index
          # ADuC841 exposes 62 KiB CODE Flash; 0xF800..0xFFFF holds the loader.
          if ($absoluteAddress -gt 0xF7FF) {
            throw ("HEX line {0} targets 0x{1:X4}, outside user CODE Flash." -f $lineNumber, $absoluteAddress)
          }
          $memory[[int]$absoluteAddress] = $data[$index]
        }
      }
      0x01 {
        if ($count -ne 0) { throw "HEX line $lineNumber has an invalid EOF record." }
        $ended = $true
      }
      0x04 {
        if ($count -ne 2) { throw "HEX line $lineNumber has an invalid extended linear address record." }
        $upperAddress = ((([int]$data[0] -shl 8) -bor [int]$data[1]) -shl 16)
      }
      default { throw ("HEX line {0} uses unsupported record type 0x{1:X2}." -f $lineNumber, $recordType) }
    }
  }
  if (-not $ended) { throw "HEX file has no EOF record." }
  $image = foreach ($addressKey in ($memory.Keys | Sort-Object)) {
    [pscustomobject]@{ Address = [int]$addressKey; Value = [byte]$memory[$addressKey] }
  }
  if (@($image).Count -eq 0) { throw "HEX image has no CODE bytes." }
  return @($image)
}

function Find-LoaderId([System.Collections.Generic.List[byte]]$Bytes) {
  for ($start = 0; $start + 25 -le $Bytes.Count; $start += 1) {
    $packet = [byte[]]$Bytes.GetRange($start, 25).ToArray()
    $text = [Text.Encoding]::ASCII.GetString($packet, 0, 24)
    if ($text -notmatch "ADI.{0,8}(841|842|843)") { continue }
    $sum = 0
    foreach ($value in $packet) { $sum = ($sum + $value) -band 0xFF }
    if ($sum -eq 0) { return $text.Replace("`0", " ").Trim() }
  }
  return $null
}

function Wait-LoaderId([System.IO.Ports.SerialPort]$Serial, [int]$TimeoutSeconds) {
  $bytes = [System.Collections.Generic.List[byte]]::new()
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    while ($Serial.BytesToRead -gt 0) {
      $value = $Serial.ReadByte()
      if ($value -lt 0) { break }
      [void]$bytes.Add([byte]$value)
      $loaderId = Find-LoaderId $bytes
      if ($loaderId) { return $loaderId }
    }
    Start-Sleep -Milliseconds 3
  }
  throw "No complete, checksum-valid ADuC841 loader ID was received. Press RESET in programming mode."
}

function New-V2Packet([byte[]]$Data) {
  if ($Data.Length -lt 1 -or $Data.Length -gt 25) { throw "Invalid Version 2 packet data length." }
  $packet = [System.Collections.Generic.List[byte]]::new()
  [void]$packet.Add(0x07)
  [void]$packet.Add(0x0E)
  [void]$packet.Add([byte]$Data.Length)
  $sum = $Data.Length
  foreach ($value in $Data) {
    [void]$packet.Add($value)
    $sum = ($sum + $value) -band 0xFF
  }
  [void]$packet.Add([byte]((- $sum) -band 0xFF))
  return [byte[]]$packet.ToArray()
}

function Send-Command(
  [System.IO.Ports.SerialPort]$Serial,
  [byte[]]$Packet,
  [string]$Label,
  [int]$TimeoutMilliseconds = 3000
) {
  Write-Log "TX" ("{0}  {1}" -f $Label, (($Packet | ForEach-Object { "{0:X2}" -f $_ }) -join " ")) Yellow
  $Serial.Write($Packet, 0, $Packet.Length)
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    while ($Serial.BytesToRead -gt 0) {
      $value = $Serial.ReadByte()
      if ($value -eq 0x06) {
        Write-Log "ACK" "$Label  (0x06)" Green
        return
      }
      if ($value -eq 0x07) { throw "NAK 0x07 after: $Label" }
      Write-Log "RX" ("Unexpected byte 0x{0:X2} while waiting for ACK" -f $value) DarkYellow
    }
    Start-Sleep -Milliseconds 3
  }
  throw "Timed out waiting for ACK after: $Label"
}

$serial = [System.IO.Ports.SerialPort]::new($Port, $BaudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.Handshake = [System.IO.Ports.Handshake]::None
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.ReadTimeout = 200
$serial.WriteTimeout = 1000

try {
  $image = @(Read-IntelHex $HexFile)
  Write-Log "STATE" ("Loaded {0} CODE bytes from {1}" -f $image.Count, (Split-Path -Leaf $HexFile))
  Write-Log "STATE" "Opening $Port - $BaudRate baud, 8N1, RTS/DTR inactive"
  $serial.Open()
  Write-Log "STATE" "Press RESET on the board now; waiting 20 seconds for the automatic loader ID." Cyan
  $loaderId = Wait-LoaderId $serial 20
  Write-Log "OK" "Loader ID accepted: $loaderId" Green

  Send-Command $serial (New-V2Packet ([byte[]](0x43))) "Erase CODE Flash" 10000
  $written = 0
  $chunk = [System.Collections.Generic.List[object]]::new()
  $previousAddress = -2
  $packetNumber = 0
  foreach ($cell in $image) {
    $mustFlush = $chunk.Count -gt 0 -and (($cell.Address -ne ($previousAddress + 1)) -or ($chunk.Count -ge 21))
    if ($mustFlush) {
      $packetNumber += 1
      $address = [int]$chunk[0].Address
      $payload = [System.Collections.Generic.List[byte]]::new()
      [void]$payload.Add(0x57)
      [void]$payload.Add(0x00)
      [void]$payload.Add([byte](($address -shr 8) -band 0xFF))
      [void]$payload.Add([byte]($address -band 0xFF))
      foreach ($item in $chunk) { [void]$payload.Add([byte]$item.Value) }
      Send-Command $serial (New-V2Packet $payload.ToArray()) ("Write block {0} at 0x{1:X4}" -f $packetNumber, $address)
      $written += $chunk.Count
      Write-Log "PROGRESS" ("{0}/{1} bytes" -f $written, $image.Count) Cyan
      $chunk.Clear()
    }
    [void]$chunk.Add($cell)
    $previousAddress = $cell.Address
  }
  if ($chunk.Count) {
    $packetNumber += 1
    $address = [int]$chunk[0].Address
    $payload = [System.Collections.Generic.List[byte]]::new()
    [void]$payload.Add(0x57)
    [void]$payload.Add(0x00)
    [void]$payload.Add([byte](($address -shr 8) -band 0xFF))
    [void]$payload.Add([byte]($address -band 0xFF))
    foreach ($item in $chunk) { [void]$payload.Add([byte]$item.Value) }
    Send-Command $serial (New-V2Packet $payload.ToArray()) ("Write block {0} at 0x{1:X4}" -f $packetNumber, $address)
    $written += $chunk.Count
    Write-Log "PROGRESS" ("{0}/{1} bytes" -f $written, $image.Count) Cyan
  }
  if (-not $NoRun) {
    Send-Command $serial (New-V2Packet ([byte[]](0x55, 0x00, 0x00, 0x00))) "Run CODE at 0x0000"
  }
  Write-Log "DONE" ("Programmed {0} CODE bytes successfully." -f $written) Green
}
catch {
  Write-Log "ERROR" ("{0}: {1}" -f $_.Exception.GetType().Name, $_.Exception.Message) Red
  exit 1
}
finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
  Write-Log "STATE" "COM port closed"
}
