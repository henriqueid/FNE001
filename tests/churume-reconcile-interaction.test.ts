/** Handlers reais de conciliação e transferência com confirmação controlada. */
import type * as ReactModule from "react";
import { type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ReconcileTab } from "@/src/features/finance/tabs/reconcile-tab";
import { ExtractTab, TransferModal } from "@/src/features/finance/tabs/statement-tab";
import { seedFinance } from "@/src/domain/finance/setup";
import type { Result } from "@/src/domain/finance/ledger";
const runtime = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
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
  useEffect: (effect: () => void, deps: unknown[]) => {
    const i = runtime.cursor++;
    const previous = runtime.slots[i] as unknown[] | undefined;
    if (!previous || deps.some((dep, j) => dep !== previous[j])) runtime.effects.push(effect);
    runtime.slots[i] = deps;
  },
}));
function elements(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as ReactElement<Record<string, unknown>>;
  return [node, ...Object.values(node.props).flatMap(elements)];
}
function words(value: unknown): string {
  if (Array.isArray(value)) return value.map(words).join("");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value && typeof value === "object" && "props" in value
    ? words((value as ReactElement<{ children: unknown }>).props.children)
    : "";
}
function render<T>(screen: () => T): T {
  runtime.cursor = 0;
  const tree = screen();
  runtime.effects.splice(0).forEach(effect => effect());
  return tree;
}
function button(tree: unknown, label: string) {
  const node = elements(tree).find(item => item.type === "button" && words(item.props.children).trim() === label);
  expect(node, label).toBeDefined();
  return node!;
}
function click(tree: unknown, label: string) {
  return (button(tree, label).props.onClick as () => unknown)();
}
function change(tree: unknown, label: string, value: string) {
  const field = elements(tree).find(item => item.props.label === label)!;
  const input = elements(field).find(item => item.type === "input" || item.type === "select")!;
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const finance = seedFinance("2026-10-26");
const fixture = () => ({
  ...finance,
  statement: [
    {
      id: "CHURUME-line",
      accountId: "cb-1",
      date: "2026-10-26",
      amount: -10,
      memo: "CHURUME tarifa",
      fitid: "CHURUME",
      file: "CHURUME.ofx",
      importedAt: "2026-10-26T00:00:00.000Z",
      importedBy: "CHURUME",
      status: "Pendente" as const,
    },
  ],
});
beforeEach(() => {
  runtime.slots = [];
  runtime.cursor = 0;
  runtime.effects = [];
});
it("conciliação bloqueia duplo clique antes da confirmação", async () => {
  const pending = deferred<boolean>();
  const onApply = vi.fn(() => pending.promise);
  const screen = () =>
    ReconcileTab({ state: fixture(), scope: "Consolidado", accountId: "cb-1", setAccountId: vi.fn(), onApply });
  const tree = render(screen);
  const first = click(tree, "Conciliar automaticamente");
  const second = click(tree, "Conciliar automaticamente");
  expect(onApply).toHaveBeenCalledOnce();
  pending.resolve(true);
  await Promise.all([first, second]);
});
it.each([false, true, "reject"] as const)("conciliação preserva preparo até confirmação %s", async outcome => {
  const pending = deferred<boolean>();
  const screen = () =>
    ReconcileTab({
      state: fixture(),
      scope: "Consolidado",
      accountId: "cb-1",
      setAccountId: vi.fn(),
      onApply: () => pending.promise,
    });
  click(render(screen), "Lançar");
  let tree = render(screen);
  const modal = elements(tree).find(item => item.props.line)!;
  const applying = (modal.props.onApply as (result: Result) => Promise<void>)({ state: finance });
  expect(elements(render(screen)).some(item => item.props.line)).toBe(true);
  if (outcome === "reject") pending.reject(new Error("CHURUME conflito"));
  else pending.resolve(outcome);
  await expect(applying).resolves.toBeUndefined();
  tree = render(screen);
  expect(elements(tree).some(item => item.props.line)).toBe(outcome !== true);
  if (outcome === "reject") expect(words(tree)).toContain("CHURUME conflito");
});
it.each(["conta", "escopo"])("troca de %s descarta modal da conta anterior", kind => {
  let accountId = "cb-1",
    scope = "Consolidado";
  const screen = () => ReconcileTab({ state: fixture(), scope, accountId, setAccountId: vi.fn(), onApply: () => true });
  click(render(screen), "Lançar");
  expect(elements(render(screen)).some(item => item.props.line)).toBe(true);
  if (kind === "conta") accountId = "cb-2";
  else scope = finance.accounts.find(item => item.id === "cb-2")!.company;
  render(screen);
  expect(elements(render(screen)).some(item => item.props.line)).toBe(false);
});
it.each(["conta", "escopo"])("OFX lido após troca de %s não é submetido", async kind => {
  let accountId = "cb-1",
    scope = "Consolidado";
  const read = deferred<string>();
  const onApply = vi.fn(() => true);
  const screen = () => ReconcileTab({ state: fixture(), scope, accountId, setAccountId: vi.fn(), onApply });
  const input = elements(render(screen)).find(item => item.props.type === "file")!;
  (input.props.onChange as (event: unknown) => void)({
    target: { files: [{ name: "CHURUME.ofx", text: () => read.promise }] },
    currentTarget: { value: "" },
  });
  if (kind === "conta") accountId = "cb-2";
  else scope = finance.accounts.find(item => item.id === "cb-3")!.company;
  render(screen);
  read.resolve("<STMTTRN><DTPOSTED>20261026<TRNAMT>-10<FITID>CHURUME<MEMO>Tarifa</STMTTRN>");
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onApply).not.toHaveBeenCalled();
  expect(words(render(screen))).not.toContain("importado(s)");
});
it.each([false, true, "reject"] as const)("extrato mantém modal até transferência confirmada %s", async outcome => {
  const pending = deferred<boolean>();
  const screen = () =>
    ExtractTab({
      state: finance,
      scope: "Consolidado",
      accountId: "cb-1",
      setAccountId: vi.fn(),
      onApply: () => pending.promise,
      onAction: vi.fn(),
    });
  click(render(screen), "Transferência entre contas");
  const modal = elements(render(screen)).find(item => item.type === TransferModal)!;
  const applying = (modal.props.onApply as (result: Result) => unknown)({ state: finance });
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(true);
  if (outcome === "reject") pending.reject(new Error("CHURUME transferência recusada"));
  else pending.resolve(outcome);
  await applying;
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(outcome !== true);
});
it("transferência construída pelo formulário envia uma vez e preserva campos na recusa", async () => {
  const pending = deferred<boolean>();
  const onApply = vi.fn((_result: Result) => pending.promise);
  const screen = () =>
    ExtractTab({
      state: finance,
      scope: "Consolidado",
      accountId: "cb-1",
      setAccountId: vi.fn(),
      onApply,
      onAction: vi.fn(),
    });
  click(render(screen), "Transferência entre contas");
  const modal = elements(render(screen)).find(item => item.type === TransferModal)!;
  const parentSlots = runtime.slots;
  runtime.slots = [];
  const form = () => TransferModal(modal.props as Parameters<typeof TransferModal>[0]);
  change(render(form), "Valor (R$)", "15,00");
  change(render(form), "Data", "2026-10-26");
  change(render(form), "Descrição", "CHURUME transferência");
  const tree = render(form);
  const submit = elements(tree).find(
    item => item.type === "button" && words(item.props.children).startsWith("Transferir"),
  )!;
  const first = (submit.props.onClick as () => unknown)();
  const second = (submit.props.onClick as () => unknown)();
  expect(onApply).toHaveBeenCalledOnce();
  const result = onApply.mock.calls[0][0];
  expect(result.error).toBeUndefined();
  const movements = result.state.movements.filter(item => item.description.includes("CHURUME transferência"));
  expect(movements).toHaveLength(2);
  expect(movements.find(item => item.amount === -15)?.accountId).toBe("cb-1");
  expect(movements.find(item => item.amount === 15)?.accountId).toBe("cb-2");
  pending.resolve(false);
  await Promise.all([first, second]);
  expect(
    elements(render(form)).some(item => item.type === "button" && words(item.props.children).startsWith("Transferir")),
  ).toBe(true);
  expect(elements(render(form)).some(item => item.props.value === "CHURUME transferência")).toBe(true);
  runtime.slots = parentSlots;
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(true);
});
it.each(["conta", "escopo"])("extrato fecha transferência quando muda %s", kind => {
  let accountId = "cb-1",
    scope = "Consolidado";
  const screen = () =>
    ExtractTab({ state: finance, scope, accountId, setAccountId: vi.fn(), onApply: () => true, onAction: vi.fn() });
  click(render(screen), "Transferência entre contas");
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(true);
  if (kind === "conta") accountId = "cb-2";
  else scope = finance.accounts.find(item => item.id === "cb-3")!.company;
  render(screen);
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(false);
});
it("OFX usa snapshot atualizado após leitura, confirma somente true", async () => {
  const read = deferred<string>(),
    confirmation = deferred<boolean>();
  let state = fixture();
  const onApply = vi.fn((_result: Result) => confirmation.promise);
  const screen = () => ReconcileTab({ state, scope: "Consolidado", accountId: "cb-1", setAccountId: vi.fn(), onApply });
  const input = elements(render(screen)).find(item => item.props.type === "file")!;
  (input.props.onChange as (event: unknown) => void)({
    target: { files: [{ name: "CHURUME.ofx", text: () => read.promise }] },
    currentTarget: { value: "" },
  });
  state = { ...state, titles: [...state.titles, { ...state.titles[0], id: "CHURUME-preservado" }] };
  render(screen);
  read.resolve("<STMTTRN><DTPOSTED>20261026<TRNAMT>-10<FITID>CHURUME-novo<MEMO>Tarifa</STMTTRN>");
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onApply).toHaveBeenCalledOnce();
  const result = onApply.mock.calls[0][0];
  expect(result.error).toBeUndefined();
  expect(result.state.titles.some(item => item.id === "CHURUME-preservado")).toBe(true);
  expect(result.state.statement?.find(item => item.fitid === "CHURUME-novo")?.accountId).toBe("cb-1");
  expect(words(render(screen))).not.toContain("importado(s)");
  confirmation.resolve(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(words(render(screen))).toContain("CHURUME.ofx: 1 lançamento(s) importado(s).");
});
it("trocar origem da transferência recalcula destino exibido e submetido", async () => {
  const onApply = vi.fn(async (_result: Result) => true);
  const screen = () =>
    TransferModal({ state: finance, accounts: finance.accounts, defaultFrom: "cb-1", onClose: vi.fn(), onApply });
  change(render(screen), "Valor (R$)", "20,00");
  change(render(screen), "Data", "2026-10-26");
  change(render(screen), "De", "cb-2");
  const tree = render(screen);
  const target = elements(tree).find(item => item.props.label === "Para")!;
  expect(elements(target).find(item => item.type === "select")?.props.value).toBe("cb-1");
  const submit = elements(tree).find(
    item => item.type === "button" && words(item.props.children).startsWith("Transferir"),
  )!;
  await (submit.props.onClick as () => unknown)();
  expect(onApply.mock.calls[0][0].error).toBeUndefined();
});
it.each([false, "reject"])("OFX não confirma nem reenvia após %s", async outcome => {
  const onApply = vi.fn(async (_result: Result) => {
    if (outcome === "reject") throw new Error("CHURUME OFX recusado");
    return false;
  });
  const screen = () =>
    ReconcileTab({ state: fixture(), scope: "Consolidado", accountId: "cb-1", setAccountId: vi.fn(), onApply });
  const input = elements(render(screen)).find(item => item.props.type === "file")!;
  (input.props.onChange as (event: unknown) => void)({
    target: {
      files: [
        new File(["<STMTTRN><DTPOSTED>20261026<TRNAMT>-10<FITID>CHURUME-novo<MEMO>Tarifa</STMTTRN>"], "CHURUME.ofx"),
      ],
    },
    currentTarget: { value: "" },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onApply).toHaveBeenCalledOnce();
  expect(words(render(screen))).not.toContain("importado(s)");
  if (outcome === "reject") expect(words(render(screen))).toContain("CHURUME OFX recusado");
});
it.each(["lançamento", "diferença"])("confirmação antiga não fecha novo preparo de %s", async kind => {
  const pending = deferred<boolean>();
  const screen = () =>
    ReconcileTab({
      state: fixture(),
      scope: "Consolidado",
      accountId: "cb-1",
      setAccountId: vi.fn(),
      onApply: () => pending.promise,
    });
  const open = () => click(render(screen), kind === "lançamento" ? "Lançar" : "Lançar diferença e conciliar");
  const findModal = () =>
    elements(render(screen)).find(item =>
      kind === "lançamento" ? Boolean(item.props.line) : Boolean(item.props.lineIds),
    );
  open();
  const old = findModal()!;
  const applying = (old.props.onApply as (result: Result) => Promise<void>)({ state: finance });
  (old.props.onClose as () => void)();
  open();
  expect(findModal()).toBeDefined();
  pending.resolve(true);
  await applying;
  expect(findModal()).toBeDefined();
});
