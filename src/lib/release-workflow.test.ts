// Release-Pipeline (Etappe 21): .github/workflows/release.yml, tauri.release.conf.json und der Updater-Endpoint.
// actionlint ist auf diesem PC nicht installiert; deshalb prüft dieser Test die YAML-Datei und ihren Aufbau.
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import workflowText from "../../.github/workflows/release.yml?raw";
import releaseConf from "../../src-tauri/tauri.release.conf.json";
import tauriConf from "../../src-tauri/tauri.conf.json";
import androidUpdate from "../../src-tauri/src/android_update.rs?raw";
import androidGitignore from "../../src-tauri/gen/android/.gitignore?raw";

interface Schritt {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
}

const dokument = parseDocument(workflowText, { uniqueKeys: true });
const workflow = dokument.toJS() as {
  on: { push: { tags: string[] }; workflow_dispatch?: { inputs: Record<string, { required?: boolean }> } };
  permissions: Record<string, string>;
  jobs: Record<string, { "runs-on": string; if?: string; needs?: string; env?: Record<string, string>; steps: Schritt[] }>;
};
const job = Object.values(workflow.jobs)[0];
const schritte = job.steps;
const tauriSchritte = schritte.filter((s) => s.uses?.startsWith("tauri-apps/tauri-action@"));
const position = (passt: (s: Schritt) => boolean) => schritte.findIndex(passt);

describe("release.yml", () => {
  it("ist gültiges YAML ohne Warnungen, Windows-Job auf windows-latest und Android-Job danach, ausgelöst durch Tags v*, mit contents: write", () => {
    expect(dokument.errors).toEqual([]);
    expect(dokument.warnings).toEqual([]);
    expect(Object.keys(workflow.jobs)).toEqual(["release", "android"]);
    expect(workflow.on.push).toEqual({ tags: ["v*"] });
    // Von Hand nur mit einem vorhandenen Tag; ein Release (Windows-Job) entsteht dabei nie.
    expect(Object.keys(workflow.on)).toEqual(["push", "workflow_dispatch"]);
    expect(Object.keys(workflow.on.workflow_dispatch?.inputs ?? {})).toEqual(["tag"]);
    expect(workflow.on.workflow_dispatch?.inputs.tag.required).toBe(true);
    expect(job.if).toBe("${{ github.event_name == 'push' }}");
    expect(job["runs-on"]).toBe("windows-latest");
    expect(workflow.permissions).toEqual({ contents: "write" });
    for (const schritt of schritte) expect(Boolean(schritt.uses) !== Boolean(schritt.run), JSON.stringify(schritt)).toBe(true);
  });

  it("stellt LF-Zeilenenden ein, richtet Node und Rust ein und lässt npm ci, npm test und cargo test vor jedem Release laufen", () => {
    const checkout = position((s) => s.uses?.startsWith("actions/checkout@") ?? false);
    const node = position((s) => s.uses?.startsWith("actions/setup-node@") ?? false);
    const rust = position((s) => s.uses?.startsWith("dtolnay/rust-toolchain@") ?? false);
    const ci = position((s) => s.run === "npm ci");
    const test = position((s) => s.run === "npm test");
    const cargo = position((s) => s.run === "cargo test --manifest-path src-tauri/Cargo.toml");
    // Vor dem Auschecken: Zeilenenden LF wie im Repository (sonst CRLF unter Windows, und Tests mit LF-Erwartung scheitern)
    const lf = position((s) => (s.run ?? "").includes("git config --global core.autocrlf false") && (s.run ?? "").includes("git config --global core.eol lf"));
    expect([lf, checkout, node, rust, ci, test, cargo].every((i) => i >= 0)).toBe(true);
    expect(lf < checkout && checkout < node && node < ci && rust < cargo && ci < test && test < cargo).toBe(true);
    // Tests ohne „continue-on-error“: Schlägt einer fehl, bricht der Job ab, und es entsteht kein Release.
    expect(workflowText).not.toContain("continue-on-error");
    expect(tauriSchritte).toHaveLength(2);
    for (const schritt of tauriSchritte) expect(schritte.indexOf(schritt)).toBeGreaterThan(cargo);
  });

  it("tauri-action mit Release-Konfiguration, Name, Tag, latest.json und Signaturschlüssel aus den Secrets", () => {
    for (const schritt of tauriSchritte) {
      expect(schritt.with).toMatchObject({
        args: "--config src-tauri/tauri.release.conf.json",
        tagName: "v__VERSION__",
        releaseName: "Localist v__VERSION__",
        releaseDraft: false,
        prerelease: false,
        includeUpdaterJson: true,
      });
      expect(schritt.env?.TAURI_SIGNING_PRIVATE_KEY).toBe("${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}");
      expect(schritt.env?.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe("${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}");
    }
  });

  it("Release-Ziel umschaltbar: mit RELEASE_OWNER/RELEASE_REPO dorthin (RELEASES_TOKEN), sonst ins eigene Repository (GITHUB_TOKEN)", () => {
    const [eigenes, fremdes] = tauriSchritte;
    expect(eigenes.if).toBe("${{ vars.RELEASE_OWNER == '' || vars.RELEASE_REPO == '' }}");
    expect(eigenes.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    expect(eigenes.with?.owner).toBeUndefined();
    expect(fremdes.if).toBe("${{ vars.RELEASE_OWNER != '' && vars.RELEASE_REPO != '' }}");
    expect(fremdes.env?.GITHUB_TOKEN).toBe("${{ secrets.RELEASES_TOKEN }}");
    expect(fremdes.with).toMatchObject({ owner: "${{ vars.RELEASE_OWNER }}", repo: "${{ vars.RELEASE_REPO }}", releaseCommitish: "main" });
  });

  it("Ausdrücke nutzen nur secrets, vars und github; Secrets stehen nie in einer if-Bedingung", () => {
    const ausdruecke = [...workflowText.matchAll(/\$\{\{([^}]*)\}\}/g)].map((m) => m[1].trim());
    expect(ausdruecke.length).toBeGreaterThan(0);
    for (const ausdruck of ausdruecke) expect(/^(secrets|vars|github)\./.test(ausdruck), ausdruck).toBe(true);
    for (const schritt of [...schritte, ...workflow.jobs.android.steps]) expect(schritt.if ?? "").not.toContain("secrets.");
  });
});

describe("release.yml: Android-APK (seit Version 2.3.1)", () => {
  const android = workflow.jobs.android;
  const run = (teil: string) => android.steps.findIndex((s) => (s.run ?? "").includes(teil));

  it("läuft auf ubuntu-latest erst nach dem Windows-Job (von Hand ohne ihn, für den angegebenen Tag) und lädt ins selbe Ziel hoch", () => {
    expect(android["runs-on"]).toBe("ubuntu-latest");
    expect(android.needs).toBe("release");
    expect(android.if).toBe("${{ github.event_name == 'workflow_dispatch' && !cancelled() || needs.release.result == 'success' }}");
    const checkout = android.steps.find((s) => s.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with?.ref).toBe("${{ github.event_name == 'workflow_dispatch' && github.event.inputs.tag || github.ref }}");
    // setup-android ohne „packages“ scheitert am Paket „tools“, das es nicht mehr gibt.
    expect(android.steps.find((s) => s.uses?.startsWith("android-actions/setup-android@"))?.with).toEqual({ packages: "platform-tools" });
    expect(android.env?.GH_REPO).toContain("github.repository");
    expect(android.env?.GH_TOKEN).toBe("${{ vars.RELEASE_OWNER != '' && vars.RELEASE_REPO != '' && secrets.RELEASES_TOKEN || secrets.GITHUB_TOKEN }}");
    for (const schritt of android.steps) expect(Boolean(schritt.uses) !== Boolean(schritt.run), JSON.stringify(schritt)).toBe(true);
  });

  it("bricht ohne Schlüssel mit klarer Meldung ab; der Schlüssel kommt aus den Secrets nach RUNNER_TEMP, nie ins Repository", () => {
    expect(run("ANDROID_KEYSTORE_BASE64 und ANDROID_KEYSTORE_PASSWORD fehlen")).toBe(0);
    const schreiben = android.steps[run("base64 --decode")];
    expect(schreiben.env).toEqual({ KEYSTORE: "${{ secrets.ANDROID_KEYSTORE_BASE64 }}", PASSWORT: "${{ secrets.ANDROID_KEYSTORE_PASSWORD }}" });
    expect(schreiben.run).toContain('> "$RUNNER_TEMP/localist-android.jks"');
    expect(schreiben.run).toContain("> src-tauri/gen/android/keystore.properties");
    expect(androidGitignore.split(/\r?\n/)).toContain("keystore.properties");
  });

  it("baut die APK nach npm ci, prüft die Signatur und hängt sie unter dem Namen an, den android_update.rs erwartet", () => {
    const ci = android.steps.findIndex((s) => s.run === "npm ci");
    const bauen = run("npx tauri android build --apk --target aarch64");
    const hochladen = run("gh release upload");
    expect(ci >= 0 && ci < run("base64 --decode") && run("base64 --decode") < bauen && bauen < hochladen).toBe(true);
    const schritt = android.steps[hochladen].run ?? "";
    expect(schritt).toContain('DATEI="Localist_${VERSION}_android.apk"');
    expect(schritt.indexOf('"$APKSIGNER" verify --print-certs "$DATEI"')).toBeGreaterThan(-1);
    expect(schritt.indexOf('"$APKSIGNER" verify --print-certs "$DATEI"')).toBeLessThan(schritt.indexOf("gh release upload"));
    expect(androidUpdate).toContain('format!("{basis}/download/v{version}/Localist_{version}_android.apk")');
  });
});

describe("Updater-Endpoint und Release-Build", () => {
  it("der Endpoint zeigt auf latest.json des neuesten Releases, das tauri-action mit includeUpdaterJson hochlädt", () => {
    // Platzhalter EMRE_GITHUB_NAME oder schon der echte Name (ANLEITUNG-RELEASE.md, Schritt 2)
    expect(tauriConf.plugins.updater.endpoints).toHaveLength(1);
    expect(tauriConf.plugins.updater.endpoints[0]).toMatch(/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/localist(-releases)?\/releases\/latest\/download\/latest\.json$/);
    expect(tauriConf.plugins.updater.windows.installMode).toBe("passive");
  });

  it("Updater-Dateien (.sig) nur im Release-Build; in tauri.conf.json steht nur der öffentliche Schlüssel", () => {
    expect(releaseConf).toEqual({ bundle: { createUpdaterArtifacts: true } });
    expect("createUpdaterArtifacts" in tauriConf.bundle).toBe(false);
    expect(atob(tauriConf.plugins.updater.pubkey)).toMatch(/^untrusted comment: minisign public key: [0-9A-F]{16}\n/);
  });
});
