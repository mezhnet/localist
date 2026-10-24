import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App (Startseite)", () => {
  it("zeigt die Überschrift „Hallo Vault“", () => {
    render(<App />);
    const ueberschrift = screen.getByRole("heading", { level: 1 });
    expect(ueberschrift.textContent).toBe("Hallo Vault");
  });
});
