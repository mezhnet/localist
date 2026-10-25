# Bedient einen Dialog der Prüf-App (scripts/app-pruefung.mjs) ohne Tastatur oder Maus: Die Windows-Bedienungshilfe
# (UI Automation) sucht nur in Fenstern des angegebenen Prozesses, die Knöpfe werden über Windows-Nachrichten an genau
# dieses Dialogfenster ausgelöst. Andere Programme bleiben unberührt.
#
#   Rückfrage mit "Ja" beantworten:
#     powershell -NoProfile -File scripts/dialog-bedienen.ps1 -ProzessId 1234 -Titel "In HTML-Seite umwandeln" -Knopf Ja
#   Speichern-Dialog ausfüllen und "Speichern" wählen:
#     powershell -NoProfile -File scripts/dialog-bedienen.ps1 -ProzessId 1234 -Titel "Als HTML-Datei exportieren" -Dateiname C:\Temp\x.html
#   Aufbau eines Dialogs anzeigen (Fehlersuche):
#     powershell -NoProfile -File scripts/dialog-bedienen.ps1 -ProzessId 1234 -Titel "..." -Auflisten
#
# Ausgabe: eine Zeile mit dem Ergebnis; Exit-Code 1, wenn Dialog oder Knopf nicht gefunden wurden.
param(
  [Parameter(Mandatory = $true)][int]$ProzessId,
  [Parameter(Mandatory = $true)][string]$Titel,
  [string]$Knopf = "",
  [string]$Dateiname = "",
  [int]$Sekunden = 20,
  [switch]$Auflisten
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace Localist -Name Win32 -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
'@
$WM_SETTEXT = 0x000C
$WM_COMMAND = 0x0111
$TDM_CLICK_BUTTON = 0x0466   # WM_USER + 102: Knopf eines TaskDialogs auslösen

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$Walker = [System.Windows.Automation.TreeWalker]::RawViewWalker

# Tiefensuche in der vollständigen Ansicht (manche Knöpfe erscheinen dort nur als "Pane").
function Finde($element, [scriptblock]$passt, $tiefe = 0) {
  if ($tiefe -gt 8) { return $null }
  $kind = $Walker.GetFirstChild($element)
  while ($kind) {
    if (& $passt $kind.Current) { return $kind }
    $treffer = Finde $kind $passt ($tiefe + 1)
    if ($treffer) { return $treffer }
    $kind = $Walker.GetNextSibling($kind)
  }
  return $null
}

# Dialoge gehören zum Hauptfenster der App und erscheinen in der Bedienungshilfe unter ihm.
$dialog = $null
$ende = (Get-Date).AddSeconds($Sekunden)
$prozess = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $ProzessId)
while (-not $dialog -and (Get-Date) -lt $ende) {
  foreach ($fenster in $AE::RootElement.FindAll($Scope::Children, $prozess)) {
    if ($fenster.Current.Name -eq $Titel -and $fenster.Current.ClassName -eq "#32770") { $dialog = $fenster; break }
    $dialog = Finde $fenster { param($c) $c.Name -eq $Titel -and $c.ClassName -eq "#32770" }
    if ($dialog) { break }
  }
  if (-not $dialog) { Start-Sleep -Milliseconds 250 }
}
if (-not $dialog) {
  Write-Output "Dialog '$Titel' ist nicht erschienen."
  exit 1
}
$hwnd = [IntPtr]$dialog.Current.NativeWindowHandle

if ($Auflisten) {
  function Zeige($element, $tiefe) {
    if ($tiefe -gt 6) { return }
    $c = $element.Current
    Write-Output ("{0}{1} '{2}' Klasse={3} Id={4}" -f ("  " * $tiefe), $c.ControlType.ProgrammaticName, $c.Name, $c.ClassName, $c.AutomationId)
    $kind = $Walker.GetFirstChild($element)
    while ($kind) { Zeige $kind ($tiefe + 1); $kind = $Walker.GetNextSibling($kind) }
  }
  Zeige $dialog 0
  exit 0
}

# Wartet, bis der Inhalt aufgebaut ist und das gesuchte Element erscheint.
function Warte([scriptblock]$passt) {
  while ((Get-Date) -lt $ende) {
    $treffer = Finde $dialog $passt
    if ($treffer) { return $treffer }
    Start-Sleep -Milliseconds 250
  }
  return $null
}

# Wartet, bis das Dialogfenster geschlossen ist.
function Geschlossen {
  for ($i = 0; $i -lt 40; $i++) {
    if (-not [Localist.Win32]::IsWindow($hwnd)) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

if ($Dateiname) {
  # Feld "Dateiname" (Kennung 1001, Klasse Edit) und Knopf "Speichern" (Kennung 1 = IDOK) des Windows-Speichern-Dialogs
  $feld = Warte { param($c) $c.AutomationId -eq "1001" -and $c.ClassName -eq "Edit" }
  $speichern = Warte { param($c) $c.AutomationId -eq "1" -and $c.ClassName -eq "Button" }
  if (-not $feld -or -not $speichern) {
    Write-Output "Speichern-Dialog '$Titel' erschienen, aber ohne Feld 'Dateiname' oder Knopf 'Speichern'."
    exit 1
  }
  $vorgabe = $feld.Current.Name
  $knopfName = $speichern.Current.Name
  [void][Localist.Win32]::SendMessage([IntPtr]$feld.Current.NativeWindowHandle, $WM_SETTEXT, [IntPtr]::Zero, $Dateiname)
  [void][Localist.Win32]::PostMessage($hwnd, $WM_COMMAND, [IntPtr]1, [IntPtr]$speichern.Current.NativeWindowHandle)
  $zu = Geschlossen
  Write-Output "Speichern-Dialog '$Titel' erschienen (vorgeschlagen: '$vorgabe'), Dateiname eingetragen, '$knopfName' gewählt, Dialog geschlossen: $zu."
  if ($zu) { exit 0 } else { exit 1 }
}

$ziel = Warte { param($c) $c.Name -eq $Knopf -and ($c.ClassName -eq "CCPushButton" -or $c.ClassName -eq "Button") }
if (-not $ziel) {
  Write-Output "Dialog '$Titel' erschienen, aber ohne Knopf '$Knopf'."
  exit 1
}
$inhalt = Finde $dialog { param($c) $c.AutomationId -eq "ContentText" }
$text = if ($inhalt) { $inhalt.Current.Name } else { "" }
if ($ziel.Current.ClassName -eq "CCPushButton") {
  # TaskDialog: Die Kennung steht in der AutomationId, z. B. CommandButton_1000
  $id = [int]($ziel.Current.AutomationId -replace '\D', '')
  [void][Localist.Win32]::PostMessage($hwnd, $TDM_CLICK_BUTTON, [IntPtr]$id, [IntPtr]::Zero)
} else {
  [void][Localist.Win32]::PostMessage($hwnd, $WM_COMMAND, [IntPtr][int]$ziel.Current.AutomationId, [IntPtr]$ziel.Current.NativeWindowHandle)
}
$zu = Geschlossen
Write-Output "Dialog '$Titel' erschienen mit dem Text '$text', '$Knopf' gewählt, Dialog geschlossen: $zu."
if ($zu) { exit 0 } else { exit 1 }
