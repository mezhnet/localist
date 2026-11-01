# Helfer für scripts/fenster-pruefung.mjs: liest Befehle zeilenweise von stdin und antwortet je Befehl mit einer
# JSON-Zeile. Er misst das Fenster der gebauten localist.exe (Fensterrechteck, sichtbarer Rahmen, Innenbereich,
# maximiert/minimiert, Fensterstil) und bedient es mit echter Maus und Tastatur (SetCursorPos, mouse_event,
# keybd_event). Sicherheitsregel: Maus und Tasten wirken nur, wenn das Localist-Fenster vorn liegt bzw. unter dem
# Mauszeiger ist – sonst bricht der Befehl ab, damit kein anderes Fenster bedient wird.
#
# Befehle: finde <pid> | info <hwnd> | oben <hwnd> <0|1> | vorholen <hwnd> | klick <hwnd> x y | doppelklick <hwnd> x y
#          ziehen <hwnd> x y dx dy | tasten <hwnd> <win+left|win+right|win+up|win+down|escape> | zeigen <hwnd>
#          bild <hwnd> <datei> | runter <hwnd> x y | gleiten <hwnd> x y [schritte] [ms] | hoch <hwnd>
#          datei <hwnd> x0 y0 x1 y1 <Pfad> | ende
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

public static class LocalistFenster {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern uint GetDoubleClickTime();
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);

  public static IntPtr Finde(uint pid) {
    IntPtr gefunden = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p != pid || !IsWindowVisible(h)) return true;
      var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
      if (sb.ToString() == "Localist") { gefunden = h; return false; }
      return true;
    }, IntPtr.Zero);
    return gefunden;
  }

  public static RECT Sichtbar(IntPtr h) {
    RECT r; DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))); // DWMWA_EXTENDED_FRAME_BOUNDS
    return r;
  }

  public static bool UnterZeiger(IntPtr h, int x, int y) {
    var p = new POINT { X = x, Y = y };
    var unter = WindowFromPoint(p);
    return unter != IntPtr.Zero && GetAncestor(unter, 2) == h; // GA_ROOT
  }

  const uint LINKS_RUNTER = 0x0002, LINKS_HOCH = 0x0004;

  public static void Klick(int x, int y) {
    SetCursorPos(x, y); Thread.Sleep(60);
    mouse_event(LINKS_RUNTER, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(40);
    mouse_event(LINKS_HOCH, 0, 0, 0, UIntPtr.Zero);
  }

  public static void Doppelklick(int x, int y) {
    SetCursorPos(x, y); Thread.Sleep(60);
    mouse_event(LINKS_RUNTER, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(30);
    mouse_event(LINKS_HOCH, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(60);
    mouse_event(LINKS_RUNTER, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(30);
    mouse_event(LINKS_HOCH, 0, 0, 0, UIntPtr.Zero);
  }

  public static void Ziehen(int x, int y, int dx, int dy) {
    SetCursorPos(x, y); Thread.Sleep(80);
    mouse_event(LINKS_RUNTER, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(150);
    for (int i = 1; i <= 20; i++) { SetCursorPos(x + dx * i / 20, y + dy * i / 20); Thread.Sleep(25); }
    Thread.Sleep(150);
    mouse_event(LINKS_HOCH, 0, 0, 0, UIntPtr.Zero);
  }

  // Einzelschritte für scripts/ziehen-pruefung.mjs: Nach SetCursorPos schickt ein Bewegen um 0 Pixel ein echtes
  // Mausereignis, damit auch das Ziehen von Windows (OLE) und die Seite die neue Position mitbekommen.
  const uint BEWEGEN = 0x0001;
  public static void Bewege(int x, int y) { SetCursorPos(x, y); mouse_event(BEWEGEN, 0, 0, 0, UIntPtr.Zero); }
  public static void Runter(int x, int y) { Bewege(x, y); Thread.Sleep(80); mouse_event(LINKS_RUNTER, 0, 0, 0, UIntPtr.Zero); }
  public static void Hoch() { mouse_event(LINKS_HOCH, 0, 0, 0, UIntPtr.Zero); }
  public static void Gleiten(int x, int y, int schritte, int ms) {
    POINT p; GetCursorPos(out p);
    for (int i = 1; i <= schritte; i++) { Bewege(p.X + (x - p.X) * i / schritte, p.Y + (y - p.Y) * i / schritte); Thread.Sleep(ms); }
  }

  const byte LWIN = 0x5B; const uint HOCH = 0x0002, ERWEITERT = 0x0001;

  public static void Tasten(string was) {
    byte taste;
    switch (was) {
      case "win+left": taste = 0x25; break;
      case "win+up": taste = 0x26; break;
      case "win+right": taste = 0x27; break;
      case "win+down": taste = 0x28; break;
      case "escape": keybd_event(0x1B, 0, 0, UIntPtr.Zero); Thread.Sleep(30); keybd_event(0x1B, 0, HOCH, UIntPtr.Zero); return;
      default: throw new ArgumentException(was);
    }
    keybd_event(LWIN, 0, ERWEITERT, UIntPtr.Zero); Thread.Sleep(40);
    keybd_event(taste, 0, ERWEITERT, UIntPtr.Zero); Thread.Sleep(40);
    keybd_event(taste, 0, ERWEITERT | HOCH, UIntPtr.Zero); Thread.Sleep(40);
    keybd_event(LWIN, 0, ERWEITERT | HOCH, UIntPtr.Zero);
  }
}
'@
Add-Type -AssemblyName System.Drawing
# Datei ziehen wie aus dem Explorer: Ein kleines eigenes Fenster startet mit gedrückter Maustaste ein echtes
# Windows-Ziehen (OLE, Format CF_HDROP), ein zweiter Faden führt die Maus zum Ziel und lässt dort los.
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public static class LocalistDateiZiehen {
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  static void Bewege(int x, int y) { SetCursorPos(x, y); mouse_event(0x0001, 0, 0, 0, UIntPtr.Zero); }

  public static string Ziehen(string datei, int x0, int y0, int x1, int y1) {
    var form = new Form { FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.Manual, TopMost = true, ShowInTaskbar = false, BackColor = Color.Orange };
    form.Bounds = new Rectangle(x0 - 30, y0 - 30, 60, 60);
    string ergebnis = "kein Ziehen";
    form.MouseDown += (s, e) => {
      var daten = new DataObject(DataFormats.FileDrop, new string[] { datei });
      ergebnis = form.DoDragDrop(daten, DragDropEffects.Copy | DragDropEffects.Move | DragDropEffects.Link).ToString();
      form.Close();
    };
    form.Shown += (s, e) => {
      var faden = new Thread(() => {
        // Wie der Hauptfaden in echten Bildschirmpixeln rechnen (sonst skaliert Windows die Koordinaten)
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        Thread.Sleep(300);
        Bewege(x0, y0); Thread.Sleep(80);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); // links runter
        Thread.Sleep(300);
        for (int i = 1; i <= 30; i++) { Bewege(x0 + (x1 - x0) * i / 30, y0 + (y1 - y0) * i / 30); Thread.Sleep(30); }
        Thread.Sleep(800);
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); // links hoch
        Thread.Sleep(5000);
        try { form.BeginInvoke((Action)(() => form.Close())); } catch { }
      });
      faden.IsBackground = true;
      faden.Start();
    };
    Application.Run(form);
    return ergebnis;
  }
}
'@
# Alle Koordinaten in echten Bildschirmpixeln (Per-Monitor-DPI v2)
[void][LocalistFenster]::SetThreadDpiAwarenessContext([IntPtr](-4))

function Rechteck($r) { @{ links = $r.Left; oben = $r.Top; rechts = $r.Right; unten = $r.Bottom; breite = $r.Right - $r.Left; hoehe = $r.Bottom - $r.Top } }
function Antwort($daten) { [Console]::Out.WriteLine(($daten | ConvertTo-Json -Compress -Depth 5)); [Console]::Out.Flush() }
function Vorn($h) {
  if ([LocalistFenster]::GetForegroundWindow() -ne $h) { throw 'Das Localist-Fenster liegt nicht vorn – abgebrochen, damit kein anderes Fenster bedient wird.' }
}
function Zeiger($h, $x, $y) {
  if (-not [LocalistFenster]::UnterZeiger($h, $x, $y)) { throw "Unter dem Punkt $x, $y liegt nicht das Localist-Fenster, abgebrochen." }
}

Antwort @{ ok = $true; bereit = $true; doppelklickZeit = [LocalistFenster]::GetDoubleClickTime() }
while ($true) {
  $zeile = [Console]::In.ReadLine()
  if ($null -eq $zeile) { break }
  $teile = $zeile.Trim().Split(' ')
  try {
    $h = if ($teile.Length -gt 1) { [IntPtr][long]$teile[1] } else { [IntPtr]::Zero }
    switch ($teile[0]) {
      'finde' { Antwort @{ ok = $true; hwnd = [long][LocalistFenster]::Finde([uint32]$teile[1]) } }
      'info' {
        $r = New-Object LocalistFenster+RECT; [void][LocalistFenster]::GetWindowRect($h, [ref]$r)
        $c = New-Object LocalistFenster+RECT; [void][LocalistFenster]::GetClientRect($h, [ref]$c)
        $p = New-Object LocalistFenster+POINT; [void][LocalistFenster]::ClientToScreen($h, [ref]$p)
        $mi = New-Object LocalistFenster+MONITORINFO; $mi.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($mi)
        [void][LocalistFenster]::GetMonitorInfo([LocalistFenster]::MonitorFromWindow($h, 2), [ref]$mi)
        $stil = [LocalistFenster]::GetWindowLong($h, -16)
        Antwort @{
          ok = $true; gibtEs = [LocalistFenster]::IsWindow($h)
          fenster = Rechteck $r; sichtbar = Rechteck ([LocalistFenster]::Sichtbar($h))
          innen = @{ x = $p.X; y = $p.Y; breite = $c.Right; hoehe = $c.Bottom }
          arbeitsflaeche = Rechteck $mi.rcWork; dpi = [LocalistFenster]::GetDpiForWindow($h)
          maximiert = [LocalistFenster]::IsZoomed($h); minimiert = [LocalistFenster]::IsIconic($h)
          vorn = ([LocalistFenster]::GetForegroundWindow() -eq $h)
          titelleiste = (($stil -band 0x00C00000) -eq 0x00C00000); groesseAenderbar = (($stil -band 0x00040000) -ne 0)
          maximierbar = (($stil -band 0x00010000) -ne 0); minimierbar = (($stil -band 0x00020000) -ne 0)
        }
      }
      'oben' {
        # HWND_TOPMOST (-1) bzw. HWND_NOTOPMOST (-2), ohne Größe, Position oder Aktivierung zu ändern
        $nach = if ($teile[2] -eq '1') { [IntPtr](-1) } else { [IntPtr](-2) }
        [void][LocalistFenster]::SetWindowPos($h, $nach, 0, 0, 0, 0, 0x0013)
        Antwort @{ ok = $true }
      }
      'klick' { Zeiger $h ([int]$teile[2]) ([int]$teile[3]); [LocalistFenster]::Klick([int]$teile[2], [int]$teile[3]); Antwort @{ ok = $true } }
      'doppelklick' { Vorn $h; Zeiger $h ([int]$teile[2]) ([int]$teile[3]); [LocalistFenster]::Doppelklick([int]$teile[2], [int]$teile[3]); Antwort @{ ok = $true } }
      'ziehen' {
        Vorn $h
        # Der Startpunkt darf knapp außerhalb des sichtbaren Rahmens liegen (unsichtbarer Rand zum Größe-Ändern).
        $start = New-Object LocalistFenster+POINT; $start.X = [int]$teile[2]; $start.Y = [int]$teile[3]
        $unter = [LocalistFenster]::GetAncestor([LocalistFenster]::WindowFromPoint($start), 2)
        if ($unter -ne $h) { throw "Unter dem Startpunkt liegt nicht das Localist-Fenster, abgebrochen." }
        [LocalistFenster]::Ziehen([int]$teile[2], [int]$teile[3], [int]$teile[4], [int]$teile[5]); Antwort @{ ok = $true }
      }
      'tasten' { Vorn $h; [LocalistFenster]::Tasten($teile[2]); Antwort @{ ok = $true } }
      # Ziehen in Einzelschritten (scripts/ziehen-pruefung.mjs): runter <hwnd> x y | gleiten <hwnd> x y [schritte] [ms] | hoch <hwnd>
      'runter' { Vorn $h; Zeiger $h ([int]$teile[2]) ([int]$teile[3]); [LocalistFenster]::Runter([int]$teile[2], [int]$teile[3]); Antwort @{ ok = $true } }
      'gleiten' {
        Vorn $h; Zeiger $h ([int]$teile[2]) ([int]$teile[3])
        $schritte = if ($teile.Length -gt 4) { [int]$teile[4] } else { 15 }
        $ms = if ($teile.Length -gt 5) { [int]$teile[5] } else { 25 }
        [LocalistFenster]::Gleiten([int]$teile[2], [int]$teile[3], $schritte, $ms); Antwort @{ ok = $true }
      }
      'hoch' { [LocalistFenster]::Hoch(); Antwort @{ ok = $true } }
      # datei <hwnd> <x0> <y0> <x1> <y1> <Pfad>: Datei von (x0, y0) außerhalb des Fensters nach (x1, y1) im Fenster ziehen
      'datei' {
        Vorn $h; Zeiger $h ([int]$teile[4]) ([int]$teile[5])
        $pfad = ($teile[6..($teile.Length - 1)] -join ' ')
        if (-not (Test-Path -LiteralPath $pfad)) { throw "Datei fehlt: $pfad" }
        $effekt = [LocalistDateiZiehen]::Ziehen($pfad, [int]$teile[2], [int]$teile[3], [int]$teile[4], [int]$teile[5])
        Antwort @{ ok = $true; effekt = $effekt }
      }
      'zeigen' { [void][LocalistFenster]::ShowWindow($h, 9); Antwort @{ ok = $true } }
      'vorholen' { Antwort @{ ok = $true; vorn = [LocalistFenster]::SetForegroundWindow($h) } }
      'bild' {
        $r = [LocalistFenster]::Sichtbar($h)
        $bmp = New-Object System.Drawing.Bitmap ($r.Right - $r.Left), ($r.Bottom - $r.Top)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
        $bmp.Save($teile[2], [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
        Antwort @{ ok = $true; datei = $teile[2] }
      }
      'ende' { Antwort @{ ok = $true }; exit 0 }
      default { throw "Unbekannter Befehl: $($teile[0])" }
    }
  } catch {
    Antwort @{ ok = $false; fehler = $_.Exception.Message }
  }
}
