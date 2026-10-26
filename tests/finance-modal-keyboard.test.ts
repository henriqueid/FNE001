import { beforeEach, expect, it, vi } from "vitest";
import type * as ReactModule from "react";
import type { ReactElement } from "react";
import { Modal } from "@/src/features/finance/finance-ui";
const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
}));
beforeEach(() => {
  hooks.effects = [];
  vi.unstubAllGlobals();
});
function mounted() {
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  const doc = {
    activeElement: null as unknown,
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    removeEventListener: vi.fn(name => listeners.delete(name)),
  };
  const control = () => {
    const node = {
      isConnected: true,
      getClientRects: () => [1],
      focus: vi.fn(() => {
        doc.activeElement = node;
      }),
    };
    return node;
  };
  const trigger = control(),
    first = control(),
    last = control();
  doc.activeElement = trigger;
  const dialog = {
    querySelectorAll: () => [first, last],
    contains: (node: unknown) => node === first || node === last,
    focus: vi.fn(),
  };
  vi.stubGlobal("document", doc);
  const onClose = vi.fn();
  const tree = Modal({ title: "CHURUME", children: "Teste", footer: "Salvar", onClose }) as ReactElement<{
    children: ReactElement<{ ref?: { current: unknown } }>;
  }>;
  const ref = tree.props.children.props.ref;
  expect(ref).toBeDefined();
  ref!.current = dialog;
  const cleanups = hooks.effects.map(effect => effect());
  const key = (key: string, shiftKey = false) => {
    const event = { key, shiftKey, defaultPrevented: false, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.get("keydown")?.(event as unknown as KeyboardEvent);
    return event;
  };
  return { doc, trigger, first, last, onClose, key, cleanups, listeners };
}
it("modal recebe foco e Escape fecha sem escapar para outros atalhos", () => {
  const m = mounted();
  expect(m.doc.activeElement).toBe(m.first);
  const event = m.key("Escape");
  expect(m.onClose).toHaveBeenCalledOnce();
  expect(event.preventDefault).toHaveBeenCalled();
  expect(event.stopPropagation).toHaveBeenCalled();
});
it("Tab e Shift+Tab circulam dentro do modal, inclusive foco externo", () => {
  const m = mounted();
  m.doc.activeElement = m.last;
  expect(m.key("Tab").preventDefault).toHaveBeenCalled();
  expect(m.doc.activeElement).toBe(m.first);
  m.key("Tab", true);
  expect(m.doc.activeElement).toBe(m.last);
  m.doc.activeElement = m.trigger;
  m.key("Tab");
  expect(m.doc.activeElement).toBe(m.first);
});
it("desmontar devolve foco e remove atalhos", () => {
  const m = mounted();
  for (const cleanup of m.cleanups) cleanup?.();
  expect(m.doc.activeElement).toBe(m.trigger);
  expect(m.listeners.size).toBe(0);
});
