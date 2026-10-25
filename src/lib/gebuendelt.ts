// Die gebündelten Bausteine (beim Build aus src/bausteine/ erzeugt) für den Export eigenständiger HTML-Dateien.
import localistCss from "../../src-tauri/seite/localist.css?raw";
import localistJs from "../../src-tauri/seite/localist.js?raw";

export const LOCALIST_CSS: string = localistCss;
export const LOCALIST_JS: string = localistJs;
