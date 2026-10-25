// Modus `localist.exe --sicherheitstest`: öffnet die Testseite in der abgeschotteten Anzeige, sammelt ihre
// Ergebnisse per postMessage und prüft zusätzlich, ob die CSP der App (frame-src) die Navigation der Seite
// nach außen verhindert. Den Bericht gibt die Rust-Seite als Tabelle auf der Konsole aus.
import { useEffect, useRef, useState } from "react";
import { parseBridgeMessage, type SecurityCheck } from "../lib/bridge";
import { pageUrl, reportSecurityTest } from "../lib/vault-api";

const OUTSIDE = "https://example.com";

export function SecurityTestRunner() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState("Die Testseite läuft …");

  useEffect(() => {
    let results: SecurityCheck[] | null = null;
    let navigation = { blockiert: false, detail: "Die Navigation wurde nicht von der CSP gemeldet." };
    let reported = false;

    const finish = (checks: SecurityCheck[]) => {
      if (reported) return;
      reported = true;
      setStatus(`Fertig: ${checks.length} Prüfungen. Bericht auf der Konsole.`);
      void reportSecurityTest(checks);
    };

    const onViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.effectiveDirective === "frame-src" && event.blockedURI.startsWith(OUTSIDE)) {
        navigation = { blockiert: true, detail: `CSP der App (frame-src) hat ${event.blockedURI} blockiert` };
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = parseBridgeMessage(event.data);
      if (message?.typ !== "sicherheitstest" || results) return;
      results = message.ergebnisse;
      setStatus("Ergebnisse da, prüfe noch die Navigation nach außen …");
      // Die Testseite versucht danach, nach außen zu navigieren. Wird das blockiert, meldet die CSP es hier.
      window.setTimeout(() => {
        finish([...(results ?? []), { pruefung: `location.href nach außen (${OUTSIDE})`, erwartet: "blockiert", ...navigation }]);
      }, 4000);
    };
    document.addEventListener("securitypolicyviolation", onViolation);
    window.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("securitypolicyviolation", onViolation);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <main className="security-test">
      <h1>Sicherheitstest</h1>
      <p role="status">{status}</p>
      <iframe ref={frame} className="security-test-frame" title="Testseite" sandbox="allow-scripts" src={pageUrl("__sicherheitstest__.html")} />
    </main>
  );
}
