/** Handlers reais de conciliação e transferência com confirmação controlada. */
import type * as ReactModule from "react";
import { type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
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
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const finance = seedFinance("2026-10-26");
beforeEach(() => {
  runtime.slots = [];
  runtime.cursor = 0;
  runtime.effects = [];
});
it("resposta da transferência fechada não fecha novo rascunho", async () => {
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
  const old = elements(render(screen)).find(item => item.type === TransferModal)!;
  const applying = (old.props.onApply as (r: Result) => Promise<boolean>)({ state: finance });
  (old.props.onClose as () => void)();
  click(render(screen), "Transferência entre contas");
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(true);
  pending.resolve(true);
  await applying;
  expect(elements(render(screen)).some(item => item.type === TransferModal)).toBe(true);
});
