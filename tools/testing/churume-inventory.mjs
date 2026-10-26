/** Inventário estático: uma ocorrência de código não equivale a botão clicado nem cenário aprovado. */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const output = process.argv[2] ?? "docs/testing/churume/2026-10-25-campanha-total";
const files = execFileSync("rg", ["--files", "src", "app", "-g", "*.tsx"], { encoding: "utf8" }).trim().split("\n").sort();
const entries = [];
const native = new Set(["button", "a", "form", "input", "select", "textarea", "summary"]);
for (const file of files) {
  const text = await fs.readFile(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const attributes = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => {
        const name = attribute.name.getText(source);
        const value = attribute.initializer;
        return [name, value ? (ts.isStringLiteral(value) ? value.text : value.getText(source)) : "true"];
      }));
      const actions = Object.fromEntries(Object.entries(attributes).filter(([key]) => /^on(Click|Submit|Change|Select|Navigate|Open|Save|Apply|Action|Toggle|Close|Confirm|Cancel|Edit|Delete|Remove|Transfer|Link|Send|Return|Update|Create|Configure|Committed)/.test(key)));
      const implicitControl = ["button", "tab", "checkbox", "radio", "menuitem", "link", "switch", "treeitem", "option", "combobox", "textbox", "slider", "spinbutton"].includes(attributes.role) || (attributes.tabIndex && attributes.tabIndex !== "{-1}") || node.attributes.properties.some(attribute => ts.isJsxSpreadAttribute(attribute) && /pressable\(/.test(attribute.getText(source)));
      if (native.has(tag) || Object.keys(actions).length || implicitControl || ["Link", "ModuleTabs", "IconButton"].includes(tag)) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        const parent = ts.isJsxElement(node.parent) ? node.parent : node;
        const literalText = ts.isJsxElement(parent) ? parent.children.map(child => ts.isJsxText(child) ? child.text.trim() : "").filter(Boolean).join(" ") : "";
        const module = file.startsWith("src/features/") ? file.split("/")[2] : file.startsWith("src/ui/") ? "shared-ui" : "app";
        entries.push({
          id: `${file}:${position.line + 1}:${position.character + 1}`,
          module, file, line: position.line + 1, tag,
          label: attributes["aria-label"] ?? attributes.title ?? attributes.label ?? literalText ?? "",
          href: attributes.href,
          type: attributes.type,
          disabled: attributes.disabled,
          dynamic: /\{/.test(attributes["aria-label"] ?? "") || Boolean(node.parent?.parent && /\.map\(/.test(node.parent.parent.getText(source).slice(0, 120))),
          actions,
          delegation: !native.has(tag),
          coverage: "NÃO EXECUTADO",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
await fs.mkdir(output, { recursive: true });
const modules = Object.fromEntries([...new Set(entries.map(entry => entry.module))].sort().map(module => {
  const rows = entries.filter(entry => entry.module === module);
  return [module, { total: rows.length, buttons: rows.filter(row => row.tag === "button").length, links: rows.filter(row => ["a", "Link"].includes(row.tag)).length, delegated: rows.filter(row => row.delegation).length }];
}));
const inventory = { generatedAt: new Date().toISOString(), sourceFiles: files.length, total: entries.length, semantics: "Ocorrências estáticas, incluindo controles delegados e templates repetidos. Não é contagem de instâncias renderizadas nem teste executado.", modules, entries };
await fs.writeFile(path.join(output, "inventario-controles.json"), JSON.stringify(inventory, null, 2));
const clean = value => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const header = "# Churume — inventário de controles\n\nCada linha é ocorrência estática. Campos e componentes delegados estão incluídos; repetições/estados em execução exigem cenários próprios. Nenhum item nasce aprovado. Evidências de execução ficam em arquivo separado.\n\n";
const rows = entries.map(entry => `| ${clean(entry.id)} | ${entry.module} | ${entry.tag} | ${clean(entry.label).slice(0, 130)} | ${clean(entry.href ?? Object.keys(entry.actions).join(", "))} | NÃO EXECUTADO |`);
await fs.writeFile(path.join(output, "inventario-controles.md"), header + "| ID | Módulo | Tipo | Texto/expressão | Ação/destino | Execução |\n| --- | --- | --- | --- | --- | --- |\n" + rows.join("\n") + "\n");
console.log(JSON.stringify({ sourceFiles: files.length, total: entries.length, modules, output }));
