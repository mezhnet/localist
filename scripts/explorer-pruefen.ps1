# Prüft für scripts/app-pruefung.mjs, ob ein Explorer-Fenster einen bestimmten Ordner zeigt und (optional) eine
# Datei darin markiert hat. Gelesen wird über die Shell-Schnittstelle von Windows (Shell.Application), es wird
# nichts angeklickt. Mit -Schliessen wird nur das gefundene Fenster geschlossen (es zeigt einen Ordner der
# Prüf-Vault), damit der nächste Aufruf nicht dasselbe Fenster wiederverwendet.
#
#   powershell -NoProfile -File scripts/explorer-pruefen.ps1 -Ordner C:\Temp\vault\Notizen -Datei Ideen.md -Schliessen
#
# Ausgabe: eine Zeile mit Fenstertitel, Ordner und markierten Dateien; Exit-Code 1, wenn kein passendes Fenster
# innerhalb von -Sekunden erschienen ist (dann mit der Liste der offenen Explorer-Fenster).
param(
  [Parameter(Mandatory = $true)][string]$Ordner,
  [string]$Datei = "",
  [int]$Sekunden = 15,
  [switch]$Schliessen
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ziel = [IO.Path]::GetFullPath($Ordner).TrimEnd('\')
$shell = New-Object -ComObject Shell.Application
$ende = (Get-Date).AddSeconds($Sekunden)
$gesehen = @()

while ((Get-Date) -lt $ende) {
  $gesehen = @()
  foreach ($fenster in @($shell.Windows())) {
    try { $pfad = $fenster.Document.Folder.Self.Path } catch { continue }
    if (-not $pfad) { continue }
    $markiert = @()
    try { $markiert = @($fenster.Document.SelectedItems() | ForEach-Object { [IO.Path]::GetFileName($_.Path) }) } catch {}
    $gesehen += "„$($fenster.LocationName)“: $pfad (markiert: $(if ($markiert.Count) { $markiert -join ', ' } else { '–' }))"
    if ($pfad.TrimEnd('\') -ine $ziel) { continue }
    if ($Datei -and -not ($markiert -contains $Datei)) { continue }
    $text = if ($markiert.Count) { $markiert -join ', ' } else { '–' }
    Write-Output "Explorer-Fenster „$($fenster.LocationName)“ (HWND $($fenster.HWND)), Ordner $pfad, markiert: $text"
    if ($Schliessen) { $fenster.Quit() }
    exit 0
  }
  Start-Sleep -Milliseconds 300
}

Write-Output "Kein Explorer-Fenster mit $ziel$(if ($Datei) { " und markierter Datei $Datei" }) gefunden. Offen: $(if ($gesehen.Count) { $gesehen -join '; ' } else { 'keine' })"
exit 1
