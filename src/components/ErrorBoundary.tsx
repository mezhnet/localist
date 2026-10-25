// Fängt unerwartete Fehler beim Zeichnen der Oberfläche ab und zeigt eine verständliche
// deutsche Meldung statt einer leeren Seite. Die Dateien im Vault sind davon nicht betroffen.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { errorMessage } from "../lib/autosave";

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Unerwarteter Fehler in der Oberfläche:", error, info.componentStack);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="welcome" role="alert">
        <h1>Da ist etwas schiefgegangen</h1>
        <p>
          Die Oberfläche hat einen unerwarteten Fehler gemeldet. Deine Seiten sind sicher: Alles, was schon gespeichert
          war, liegt unverändert im Vault.
        </p>
        <p className="notice error">{errorMessage(this.state.error)}</p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          App neu laden
        </button>
      </main>
    );
  }
}
