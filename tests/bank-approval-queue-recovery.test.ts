/** Exercita falha, repetição e fila preservada com hooks controlados; sem navegador. */
import type { ReactElement } from "react";
import type * as ReactModule from "react";
import { beforeEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  effects: [] as Array<() => unknown>,
  load: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
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
  useEffect(effect: () => unknown) {
    runtime.effects.push(effect);
  },
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@/src/app/registry-client", () => ({
  loadBankAccountChanges: runtime.load,
  decideRegistryBankAccountChange: runtime.decide,
}));
import { BankAccountApprovalPanel } from "@/src/features/registry/bank-account-approval-panel";
type Element = ReactElement<Record<string, unknown>>;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
  return typeof value === "string" ? value : "";
}
const props = { onFeedback: vi.fn(), onApplied: vi.fn(async () => undefined) };
const change = {
  changeId: "CHURUME-bank",
  partyId: "CHURUME-party",
  partyName: "CHURUME Fila preservada",
  previousAccounts: [],
  proposedAccounts: [],
  reason: "CHURUME solicitação",
  status: "PENDING",
  requestedBy: "maker",
  requestedByName: "CHURUME",
  requestedAt: "2026-10-26T10:00:00Z",
};
function render() {
  runtime.index = 0;
  runtime.effects = [];
  return BankAccountApprovalPanel(props);
}
async function tick() {
  await new Promise(resolve => setImmediate(resolve));
}
beforeEach(() => {
  runtime.index = 0;
  runtime.values = [];
  runtime.effects = [];
  vi.clearAllMocks();
});
it("falha inicial mostra alerta e retry recupera fila", async () => {
  runtime.load.mockRejectedValueOnce(new Error("CHURUME fila indisponível")).mockResolvedValueOnce([change]);
  render();
  runtime.effects.forEach(effect => effect());
  await tick();
  let tree = render();
  expect(elements(tree).some(element => element.props.role === "alert")).toBe(true);
  expect(text(tree)).toContain("CHURUME fila indisponível");
  const retry = elements(tree).find(element => element.type === "button" && text(element).includes("Tentar novamente"));
  expect(retry).toBeDefined();
  (retry!.props.onClick as () => void)();
  await tick();
  tree = render();
  expect(text(tree)).toContain(change.partyName);
  expect(elements(tree).some(element => element.props.role === "alert")).toBe(false);
});
it("falha na atualização preserva fila e bloqueia decisão até reconfirmar", async () => {
  runtime.load.mockResolvedValueOnce([change]).mockRejectedValueOnce(new Error("CHURUME perda de conexão"));
  render();
  runtime.effects.forEach(effect => effect());
  await tick();
  let tree = render();
  const refresh = elements(tree).find(element => element.type === "button" && text(element).includes("Atualizar fila"));
  expect(refresh).toBeDefined();
  (refresh!.props.onClick as () => void)();
  await tick();
  tree = render();
  expect(text(tree)).toContain(change.partyName);
  expect(text(tree)).toContain("CHURUME perda de conexão");
  const decisions = elements(tree).filter(
    element => element.type === "button" && /Aprovar|Rejeitar/.test(text(element)),
  );
  expect(decisions.every(element => element.props.disabled)).toBe(true);
  expect(runtime.decide).not.toHaveBeenCalled();
});
