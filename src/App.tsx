import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Workspace } from "./components/Workspace";
import { errorMessage } from "./lib/autosave";
import { ThemeProvider } from "./lib/theme";
import { getLastVault, openVault, pickVaultFolder, type VaultInfo } from "./lib/vault-api";

type Phase = "starting" | "ready";

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Beim Start den zuletzt geöffneten Vault wieder öffnen.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
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

  const chooseVault = async () => {
    try {
      const path = await pickVaultFolder();
      if (!path) return;
      setVault(await openVault(path));
      setError(null);
    } catch (chooseError) {
      setError(errorMessage(chooseError));
    }
  };

  if (phase === "starting") {
    return <div className="splash">Lädt …</div>;
  }

  if (!vault) {
    return (
      <main className="welcome">
        <h1>Hallo Vault</h1>
        <p>
          Wähle einen Ordner als Vault. Alle Seiten werden dort als normale Markdown-Dateien gespeichert und bleiben auch
          ohne diese App lesbar.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="primary" onClick={() => void chooseVault()}>
          Vault-Ordner öffnen …
        </button>
      </main>
    );
  }

  return <Workspace key={vault.root} vault={vault} onSwitchVault={() => void chooseVault()} />;
}

export default App;
