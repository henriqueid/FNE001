/** Handlers reais com hooks controlados; sem navegador ou download em disco. */
import type { ReactElement } from "react";
import type * as ReactModule from "react";
import { beforeEach, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ values: [] as unknown[], index: 0, saveFile: vi.fn() }));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useMemo: (factory: () => unknown) => factory(),
  useState(initial: unknown) {
    const index = runtime.index++;
    if (!(index in runtime.values)) runtime.values[index] = typeof initial === "function" ? initial() : initial;
    return [
      runtime.values[index],
      (value: unknown) => {
        runtime.values[index] = typeof value === "function" ? value(runtime.values[index]) : value;
      },
    ];
  },
}));
vi.mock("@/src/ui/download", () => ({ saveFile: runtime.saveFile }));

import { initialOperations } from "@/src/domain/core/demo/operations";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { PortfolioTitleGrid, type PortfolioGridRow } from "@/src/features/portfolio/portfolio-title-grid";

type Element = ReactElement<Record<string, unknown>>;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ").replace(/\s+/g, " ");
  if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function find(tree: unknown, type: string, predicate: (element: Element) => boolean): Element {
  const result = elements(tree).find(element => element.type === type && predicate(element));
  expect(result).toBeDefined();
  return result!;
}
function click(tree: unknown, label: string) {
  const button = find(
    tree,
    "button",
    element => element.props["aria-label"] === label || text(element).trim() === label,
  );
  expect(button.props.disabled).not.toBe(true);
  (button.props.onClick as () => void)();
}
function select(tree: unknown, document: string) {
  (
    find(tree, "input", element => element.props["aria-label"] === `Selecionar ${document}`).props
      .onChange as () => void
  )();
}
function titles(tree: unknown): string[] {
  const body = find(tree, "tbody", () => true);
  return elements(body)
    .filter(element => element.type === "input")
    .map(element => String(element.props["aria-label"]).replace("Selecionar ", ""));
}
function fixture() {
  const portfolio = seedPortfolio(initialOperations);
  const source: PortfolioGridRow[] = Array.from({ length: 203 }, (_, index) => ({
    ...portfolio.titles[0],
    id: `grid-${index + 1}`,
    documentNumber: `QA-${String(index + 1).padStart(3, "0")}`,
    dueDate: "2026-10-01",
    source: "Carteira",
    amount: index + 1,
    reference: "CHURUME",
    originLabel: "CHURUME",
    displayStatus: "A vencer",
    late: 0,
  }));
  const rows = source.filter(row => row.amount <= 201);
  const render = (filtered = rows) => {
    runtime.index = 0;
    return PortfolioTitleGrid({ rows: filtered, repName: () => "CHURUME", portfolio, onPortfolio: vi.fn() });
  };
  return { source, rows, render };
}
function csv(tree: unknown) {
  click(tree, "Exportar CSV");
  const [name, content] = runtime.saveFile.mock.lastCall! as [string, string];
  expect(name).toMatch(/^carteira-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(content.charCodeAt(0)).toBe(0xfeff);
  return content.slice(1).split("\r\n");
}
beforeEach(() => {
  runtime.values = [];
  runtime.index = 0;
  runtime.saveFile.mockReset().mockResolvedValue(undefined);
});

it("navega 100 + 100 + 1 títulos e preserva seleção entre páginas", () => {
  const { render } = fixture();
  let tree = render();
  expect(titles(tree)).toHaveLength(100);
  expect(titles(tree)[0]).toBe("QA-001");
  expect(find(tree, "button", element => element.props["aria-label"] === "Página anterior").props.disabled).toBe(true);
  select(tree, "QA-001");
  tree = render();
  click(tree, "Próxima página");
  tree = render();
  expect(titles(tree)).toHaveLength(100);
  expect(titles(tree)[0]).toBe("QA-101");
  click(tree, "Próxima página");
  tree = render();
  expect(titles(tree)).toEqual(["QA-201"]);
  expect(text(find(tree, "span", element => element.props.role === "status"))).toContain("Página 3 de 3");
  expect(find(tree, "button", element => element.props["aria-label"] === "Próxima página").props.disabled).toBe(true);
  select(tree, "QA-201");
  tree = render();
  expect(text(tree)).toContain("2 selecionado(s)");
  click(tree, "Página anterior");
  tree = render();
  click(tree, "Página anterior");
  tree = render();
  expect(find(tree, "input", element => element.props["aria-label"] === "Selecionar QA-001").props.checked).toBe(true);
  expect(text(tree)).toContain("2 selecionado(s)");
});

it("CSV exporta 201 filtrados além da página/seleção, com colunas e ordenação escolhidas", () => {
  const { source, rows, render } = fixture();
  let tree = render();
  select(tree, "QA-001");
  const columns = find(tree, "button", element => element.props["aria-expanded"] === false);
  (columns.props.onClick as () => void)();
  tree = render();
  for (const label of ["Cedente", "Desconto"]) {
    const option = find(tree, "label", element => text(element).trim() === label);
    (find(option, "input", () => true).props.onChange as () => void)();
    tree = render();
  }
  const sort = () =>
    (
      find(tree, "button", element => element.props.className === "pf-sort" && text(element).includes("Saldo")).props
        .onClick as () => void
    )();
  sort();
  tree = render();
  sort();
  tree = render();
  expect(titles(tree)[0]).toBe("QA-201");
  select(tree, "QA-201");
  tree = render();
  click(tree, "Próxima página");
  tree = render();
  click(tree, "Próxima página");
  tree = render();
  expect(titles(tree)).toEqual(["QA-001"]);
  const lines = csv(tree);
  expect(lines).toHaveLength(202);
  expect(lines.slice(1).map(line => line.split(";")[0])).toEqual(
    [...rows].reverse().map(row => `"${row.documentNumber}"`),
  );
  expect(lines[0]).not.toContain('"Cedente"');
  expect(lines[0]).toContain('"Desconto"');
  expect(lines[1].split(";")[0]).toBe('"QA-201"');
  expect(lines.at(-1)!.split(";")[0]).toBe('"QA-001"');
  expect(lines.join("\n")).not.toMatch(/QA-202|QA-203/);
  expect(text(tree)).toContain("2 selecionado(s)");
  expect(source.map(row => row.amount)).toEqual(Array.from({ length: 203 }, (_, index) => index + 1));

  tree = render(rows.filter(row => row.amount > 150));
  expect(titles(tree)).toHaveLength(51);
  expect(titles(tree)[0]).toBe("QA-201");
  expect(text(tree)).toContain("Página 1 de 1");
  expect(text(tree)).toContain("1 selecionado(s)");
  expect(find(tree, "input", element => element.props["aria-label"] === "Selecionar QA-201").props.checked).toBe(true);
  const filteredCsv = csv(tree);
  expect(filteredCsv).toHaveLength(52);
  expect(filteredCsv[0]).toBe(lines[0]);
  expect(filteredCsv.at(-1)!.split(";")[0]).toBe('"QA-151"');
  expect(filteredCsv.join("\n")).not.toMatch(/QA-001|QA-150|QA-202|QA-203/);
  tree = render();
  expect(text(tree)).toContain("2 selecionado(s)");
  expect(csv(tree)).toEqual(lines);
});
