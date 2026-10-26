/** Persistência confirmada, destino inequívoco e acesso integral à auditoria financeira. */
import type * as ReactModule from "react";
import { type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ChartImportModal } from "@/src/features/finance/chart-import-modal";
import { AccountingTab } from "@/src/features/finance/tabs/accounting-tab";
import { ImportModal } from "@/src/features/finance/titles/import-titles-modal";
import ControlleriaModule from "@/src/features/controlleria/controlleria-module";
import { seedFinance } from "@/src/domain/finance/setup";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { chartToCsv } from "@/src/domain/finance/chart-import";
import type { Result } from "@/src/domain/finance/ledger";
const runtime = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const i = runtime.cursor++;
    if (!(i in runtime.slots)) runtime.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      runtime.slots[i],
      (next: unknown) => {
        runtime.slots[i] = typeof next === "function" ? next(runtime.slots[i]) : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = runtime.cursor++;
    if (!(i in runtime.slots)) runtime.slots[i] = { current: initial };
    return runtime.slots[i];
  },
}));
vi.mock("@/src/app/registry-context", () => ({ useRegistry: () => ({ commercial: seedCommercial() }) }));
vi.mock("@/src/app/company-context", () => ({
  useCompanyDestinations: () => [
    { name: "CHURUME Alpha", institution: "Factoring", detail: "A" },
    { name: "CHURUME Alpha II", institution: "Factoring", detail: "B" },
    { name: "CHURUME Beta", institution: "Factoring", detail: "C" },
  ],
}));
function elements(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as ReactElement<Record<string, unknown>>;
  return [element, ...Object.values(element.props).flatMap(elements)];
}
function words(value: unknown): string {
  if (Array.isArray(value)) return value.map(words).join("");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "props" in value)
    return words((value as ReactElement<{ children: unknown }>).props.children);
  return "";
}
function render<T>(component: () => T): T {
  runtime.cursor = 0;
  return component();
}
function button(tree: unknown, label: string) {
  const node = elements(tree).find(item => item.type === "button" && words(item.props.children).trim() === label);
  expect(node, `botão ${label}`).toBeDefined();
  return node!;
}
function click(tree: unknown, label: string) {
  return (button(tree, label).props.onClick as () => unknown)();
}
function field(tree: unknown, label: string, type = "input") {
  const section = elements(tree).find(item => item.props.label === label);
  expect(section, `campo ${label}`).toBeDefined();
  return elements(section).find(item => item.type === type)!;
}
function change(node: ReactElement<Record<string, unknown>>, value: string) {
  (node.props.onChange as (event: unknown) => void)({ target: { value } });
}
const finance = seedFinance("2026-10-26");
beforeEach(() => {
  runtime.slots = [];
  runtime.cursor = 0;
});
it.each(["false", "rejeição"])("plano não fecha antes da confirmação nem após %s", async outcome => {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: Error) => void;
  const confirmation = new Promise<boolean>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  void confirmation.catch(() => {});
  const onApply = vi.fn((_result: Result) => confirmation);
  const onClose = vi.fn();
  const screen = () => ChartImportModal({ state: finance, onApply, onClose });
  let tree = render(screen);
  const input = elements(tree).find(item => item.type === "input" && item.props.type === "file")!;
  (input.props.onChange as (event: unknown) => void)({
    target: { files: [new File([chartToCsv(finance.chart)], "CHURUME.csv")] },
    currentTarget: { value: "" },
  });
  await Promise.resolve();
  await Promise.resolve();
  tree = render(screen);
  const importButton = elements(tree).find(
    item => item.type === "button" && words(item.props.children).startsWith("Importar "),
  )!;
  expect(importButton.props.disabled).toBe(false);
  const pending = (importButton.props.onClick as () => unknown)();
  expect(onApply).toHaveBeenCalledOnce();
  expect(onApply.mock.calls[0][0].error).toBeUndefined();
  expect(onClose).not.toHaveBeenCalled();
  if (outcome === "false") resolve(false);
  else reject(new Error("CHURUME falha persistência"));
  await pending;
  expect(onClose).not.toHaveBeenCalled();
  expect(words(render(screen))).toContain("CHURUME.csv");
});
it("plano fecha somente depois de confirmação true", async () => {
  const onClose = vi.fn();
  const screen = () => ChartImportModal({ state: finance, onApply: async () => true, onClose });
  let tree = render(screen);
  const input = elements(tree).find(item => item.type === "input" && item.props.type === "file")!;
  (input.props.onChange as (event: unknown) => void)({
    target: { files: [new File([chartToCsv(finance.chart)], "CHURUME.csv")] },
    currentTarget: { value: "" },
  });
  await Promise.resolve();
  await Promise.resolve();
  tree = render(screen);
  const item = elements(tree).find(
    item => item.type === "button" && words(item.props.children).startsWith("Importar "),
  )!;
  await (item.props.onClick as () => unknown)();
  expect(onClose).toHaveBeenCalledOnce();
});
it.each(["conta", "categoria"])(
  "preserva formulário de %s quando confirmação falha; limpa só após true",
  async kind => {
    let accepted = false;
    const onApply = vi.fn(async (_result: Result) => accepted);
    const screen = () => AccountingTab({ state: finance, scope: "Consolidado", onApply });
    click(render(screen), "Plano de contas");
    if (kind === "conta") {
      change(field(render(screen), "Código"), "5.1.99");
      change(field(render(screen), "Nome"), "CHURUME conta");
    } else {
      change(field(render(screen), "Nova categoria"), "CHURUME categoria");
      change(
        field(render(screen), "Conta contábil", "select"),
        finance.chart.find(item => item.analytic && item.nature === "Despesa")!.code,
      );
    }
    const label = kind === "conta" ? "Criar conta" : "Criar categoria";
    await click(render(screen), label);
    expect(onApply.mock.calls[0][0].error).toBeUndefined();
    expect(field(render(screen), kind === "conta" ? "Nome" : "Nova categoria").props.value).toContain("CHURUME");
    accepted = true;
    await click(render(screen), label);
    expect(field(render(screen), kind === "conta" ? "Nome" : "Nova categoria").props.value).toBe("");
  },
);
it("auditoria permite visitar todos65eventos sem trazer empresa diferente", () => {
  const op = {
    ...initialOperations[0],
    vehicle: "CHURUME Alpha",
    approvalReview: {
      status: "Preparação" as const,
      audit: Array.from({ length: 65 }, (_, index) => ({
        at: `2026-10-${String(26 - Math.floor(index / 24)).padStart(2, "0")}T${String(23 - (index % 24)).padStart(2, "0")}:00:00Z`,
        by: "CHURUME",
        action: `EVENTO-${String(index).padStart(3, "0")}`,
        detail: `Detalhe ${index}`,
      })),
    },
  };
  const other = {
    ...op,
    id: "other",
    vehicle: "Outra empresa",
    approvalReview: {
      status: "Preparação" as const,
      audit: [{ at: "2026-10-26T23:59:59Z", by: "Outro", action: "SEGREDO-OUTRA-EMPRESA", detail: "fora" }],
    },
  };
  const screen = () =>
    ControlleriaModule({
      operations: [op, other],
      portfolio: { version: 3, titles: [] },
      onPortfolio: vi.fn(),
      companyScope: "CHURUME Alpha",
      onOpenOperation: vi.fn(),
    });
  let tree = render(screen);
  const tabs = elements(tree).find(item => item.props.label === "Seções da Controladoria")!;
  (tabs.props.onChange as (value: string) => void)("auditoria");
  tree = render(screen);
  const found = new Set<string>();
  for (let page = 1; page <= 3; page++) {
    tree = render(screen);
    for (const match of words(tree).matchAll(/EVENTO-\d{3}/g)) found.add(match[0]);
    expect(words(tree)).not.toContain("SEGREDO-OUTRA-EMPRESA");
    if (page < 3) click(tree, "Próxima");
  }
  expect(found.size).toBe(65);
  expect(button(render(screen), "Próxima").props.disabled).toBe(true);
  click(render(screen), "Anterior");
  expect(words(render(screen))).toContain("Página 2 de 3");
});
it.each([
  ["CHURUME inexistente", false, ""],
  ["CHURUME", false, ""],
  ["CHURUME Alpha", true, "CHURUME Alpha"],
  ["CHURUME Bet", true, "CHURUME Beta"],
  ["", true, "CHURUME Beta"],
])("importação empresa '%s' resolve destino inequívoco=%s", async (company, valid, expected) => {
  const onApply = vi.fn();
  const screen = () => ImportModal({ state: finance, defaultCompany: "CHURUME Beta", onClose: vi.fn(), onApply });
  const category = finance.categories.find(item => item.kind === "Despesa")!;
  let tree = render(screen);
  const textarea = elements(tree).find(item => item.type === "textarea")!;
  change(textarea, `Pagar;CHURUME título;Favorecido;${category.name};${company};26/10/2026;30/10/2026;100,00`);
  tree = render(screen);
  const item = elements(tree).find(
    item => item.type === "button" && words(item.props.children).startsWith("Importar "),
  )!;
  expect(Boolean(item.props.disabled)).toBe(!valid);
  if (valid) {
    await (item.props.onClick as () => unknown)();
    expect(onApply).toHaveBeenCalledOnce();
    const added = onApply.mock.calls[0][0].state.titles.find(
      (title: { description: string }) => title.description === "CHURUME título",
    );
    expect(added.company).toBe(expected);
  } else {
    expect(words(tree)).toMatch(/empresa/i);
    expect(onApply).not.toHaveBeenCalled();
  }
});

it.each(["conta", "categoria"])("rejeição do servidor mantém campos de %s e apresenta erro", async kind => {
  const screen = () =>
    AccountingTab({
      state: finance,
      scope: "Consolidado",
      onApply: async () => {
        throw new Error("CHURUME conflito no servidor");
      },
    });
  click(render(screen), "Plano de contas");
  if (kind === "conta") {
    change(field(render(screen), "Código"), "5.1.99");
    change(field(render(screen), "Nome"), "CHURUME conta rejeitada");
  } else {
    change(field(render(screen), "Nova categoria"), "CHURUME categoria rejeitada");
    change(
      field(render(screen), "Conta contábil", "select"),
      finance.chart.find(item => item.analytic && item.nature === "Despesa")!.code,
    );
  }
  await click(render(screen), kind === "conta" ? "Criar conta" : "Criar categoria");
  expect(field(render(screen), kind === "conta" ? "Nome" : "Nova categoria").props.value).toContain("CHURUME");
  expect(words(render(screen))).toContain("CHURUME conflito no servidor");
});
