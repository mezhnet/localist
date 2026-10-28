# Prüft für scripts/app-pruefung.mjs, ob ein Explorer-Fenster einen bestimmten Ordner zeigt und (optional) eine
# Datei darin markiert hat. Gelesen wird über die Shell-Schnittstelle von Windows (Shell.Application), es wird
# nichts angeklickt. Mit -Schliessen wird nur das gefundene Fenster geschlossen (es zeigt einen Ordner der
# Prüf-Vault), damit der nächste Aufruf nicht dasselbe Fenster wiederverwendet.
#
#   powershell -NoProfile -File scripts/explorer-pruefen.ps1 -Ordner C:\Temp\vault\Notizen -Datei Ideen.md -Schliessen
#
# Ausgabe: eine Zeile mit Fenstertitel, Ordner und markierten Dateien; Exit-Code 1, wenn kein passendes Fenster
# innerhalb von -Sekunden erschienen ist (dann mit der Liste der offenen Explorer-Fenster).
# Achtung: PowerShell liest die deutschen Anführungszeichen als Begrenzer von Zeichenketten. Texte damit stehen
# deshalb nur in einfachen Anführungszeichen und werden mit -f zusammengesetzt.
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
    $liste = if ($markiert.Count) { $markiert -join ', ' } else { '-' }
    # Fremde Fenster nur zählen, nicht mit Pfad ausgeben.
    if (-not $pfad.StartsWith([IO.Path]::GetDirectoryName($ziel), [StringComparison]::OrdinalIgnoreCase)) { $gesehen += 'ein anderes Fenster'; continue }
    $gesehen += ('„{0}“: {1} (markiert: {2})' -f $fenster.LocationName, $pfad, $liste)
    if ($pfad.TrimEnd('\') -ine $ziel) { continue }
    if ($Datei -and -not ($markiert -contains $Datei)) { continue }
    Write-Output ('Explorer-Fenster „{0}“ (HWND {1}), Ordner {2}, markiert: {3}' -f $fenster.LocationName, $fenster.HWND, $pfad, $liste)
    if ($Schliessen) { $fenster.Quit() }
    exit 0
  }
  Start-Sleep -Milliseconds 300
}

$offen = if ($gesehen.Count) { $gesehen -join '; ' } else { 'keine' }
$was = if ($Datei) { ' und markierter Datei ' + $Datei } else { '' }
Write-Output ('Kein Explorer-Fenster mit {0}{1} gefunden. Offen: {2}' -f $ziel, $was, $offen)
exit 1
