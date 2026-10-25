// Code-Block: Die Sprache aus class="language-…" erscheint als kleine Beschriftung über dem Code (code.css).
var SPRACHEN = {
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  powershell: "PowerShell",
  ps1: "PowerShell",
  sql: "SQL",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  csharp: "C#",
  rust: "Rust",
  go: "Go",
  yaml: "YAML",
  md: "Markdown",
  markdown: "Markdown",
};

sobaldBereit(function () {
  var bloecke = document.querySelectorAll("pre > code[class*='language-']");
  for (var i = 0; i < bloecke.length; i++) {
    var treffer = /(?:^|\s)language-([\w+#.-]+)/.exec(bloecke[i].className);
    if (!treffer || treffer[1] === "text" || treffer[1] === "plain") continue;
    bloecke[i].parentElement.setAttribute("data-sprache", SPRACHEN[treffer[1].toLowerCase()] || treffer[1]);
  }
});
