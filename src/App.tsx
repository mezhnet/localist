import { FileText, FolderOpen, Lock, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./styles/index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FolderPicker } from "./components/FolderPicker";
import { SecurityTestRunner } from "./components/SecurityTestRunner";
import { Button } from "./components/ui";
import { Workspace } from "./components/Workspace";
import { errorMessage } from "./lib/autosave";
import { ThemeProvider } from "./lib/theme";
import { appPlatform, getLastVault, openVault, pickVaultFolder, securityTestVault, type VaultInfo } from "./lib/vault-api";

type Phase = "starting" | "ready";

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

function AppContent() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Auf Android wählt man den Vault in einer eigenen Ordnerauswahl (siehe FolderPicker). */
  const [platform, setPlatform] = useState("unbekannt");
  const [picking, setPicking] = useState(false);
  /** `localist.exe --sicherheitstest`: statt des Arbeitsbereichs läuft der Test. */
  const [securityTest, setSecurityTest] = useState(false);
  const started = useRef(false);

  // Beim Start den zuletzt geöffneten Vault wieder öffnen.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPlatform(await appPlatform().catch(() => "unbekannt"));
      const testVault = await securityTestVault().catch(() => null);
      if (testVault) {
        setVault(await openVault(testVault));
        setSecurityTest(true);
        setPhase("ready");
        return;
      }
      try {
        const last = await getLastVault();
        if (last) {
          try {
            setVault(await openVault(last));
          } catch (openError) {
            setError(`Der zuletzt geöffnete Vault konnte nicht geöffnet werden. ${errorMessage(openError)}`);
          }
        }
      } catch (startError) {
        setError(errorMessage(startError));
      } finally {
        setPhase("ready");
      }
    })();
  }, []);

  const openChosen = async (path: string) => {
    try {
      setVault(await openVault(path));
      setError(null);
    } catch (chooseError) {
      setError(errorMessage(chooseError));
    }
  };

  const chooseVault = async () => {
    if (platform === "android") {
      setPicking(true);
      return;
    }
    try {
      const path = await pickVaultFolder();
      if (path) await openChosen(path);
    } catch (chooseError) {
      setError(errorMessage(chooseError));
    }
  };

  const picker = picking && (
    <FolderPicker
      onCancel={() => setPicking(false)}
      onPick={(path) => {
        setPicking(false);
        void openChosen(path);
      }}
    />
  );

  if (phase === "starting") {
    return (
      <div className="splash" role="status">
        Lädt …
      </div>
    );
  }

  if (securityTest) return <SecurityTestRunner />;

  if (!vault) {
    return (
      <main className="welcome">
        <div className="welcome-card">
          <img className="welcome-logo" src="/localist.svg" alt="" width={56} height={56} />
          <p className="welcome-app">Willkommen bei Localist</p>
          <h1>Hallo Vault</h1>
          <p className="welcome-text">
            Wähle einen Ordner als Vault. Alle Seiten werden dort als normale Markdown-Dateien gespeichert und bleiben auch
            ohne diese App lesbar.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" className="welcome-button" icon={<FolderOpen />} onClick={() => void chooseVault()}>
            Vault-Ordner öffnen …
          </Button>
          <ul className="welcome-points">
            <li>
              <FileText aria-hidden="true" /> Normale Dateien in deinem Ordner
            </li>
            <li>
              <WifiOff aria-hidden="true" /> Funktioniert komplett offline
            </li>
            <li>
              <Lock aria-hidden="true" /> Keine Konten, keine Telemetrie
            </li>
          </ul>
        </div>
        {picker}
      </main>
    );
  }

  return (
    <>
      <Workspace key={vault.root} vault={vault} onSwitchVault={() => void chooseVault()} />
      {picker}
    </>
  );
}

export default App;
