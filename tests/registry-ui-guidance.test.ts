import type { ReactElement } from "react";
import type * as ReactModule from "react";
import { beforeEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
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
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
}));
vi.mock("@/src/app/registry-context", () => ({
  useRegistry: () => ({
    parties: [party],
    saveParty: vi.fn(),
    isDemo: true,
    operationalDefaults: {},
    records: [
      {
        document: "11.222.333/0001-81",
        name: "CHURUME",
        cedent: initialCedents[0],
        status: "Ativo",
        limitSource: "Cadastro",
      },
    ],
    commercial: seedCommercial(),
  }),
}));
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { emptyParty } from "@/src/domain/registry/parties";
import { CedentsTab } from "@/src/features/registry/cedents-tab";
import { PartyFormModal } from "@/src/features/registry/party-form-modal";
const party = { ...emptyParty("fornecedor"), id: "churume-existing", document: "11.222.333/0001-81", name: "CHURUME" };
type Element = ReactElement<Record<string, unknown>>;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children), ...elements(element.props.footer)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  return value && typeof value === "object" && "props" in value
    ? text((value as Element).props.children)
    : typeof value === "string"
      ? value
      : "";
}
beforeEach(() => {
  runtime.values = [];
  runtime.index = 0;
});
it("linha de cedente permite expandir por Enter e Espaço", () => {
  const props = {
    operations: [],
    onOpenOperation: vi.fn(),
    onNavigate: vi.fn(),
    onEdit: vi.fn(),
    onTransfer: vi.fn(),
    onLink: vi.fn(),
    repFilter: "",
  };
  const tree = CedentsTab(props);
  const row = elements(tree).find(element => element.type === "tr" && element.props.className === "cm-click")!;
  expect(row.props.role).toBe("button");
  expect(row.props.tabIndex).toBe(0);
  const preventDefault = vi.fn();
  (row.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault });
  runtime.index = 0;
  expect(
    elements(CedentsTab(props)).find(element => element.type === "tr" && element.props.className === "cm-click")!.props[
      "aria-expanded"
    ],
  ).toBe(true);
  expect(preventDefault).toHaveBeenCalled();
});
it("salvar sem motivo abre seção onde campo obrigatório está visível", () => {
  const props = { party, onClose: vi.fn(), onSaved: vi.fn(), onOpenExisting: vi.fn() };
  const tree = PartyFormModal(props);
  const save = elements(tree).find(
    element => element.type === "button" && text(element).includes("Salvar alterações"),
  )!;
  (save.props.onClick as () => void)();
  runtime.index = 0;
  const next = PartyFormModal(props);
  expect(elements(next).some(element => element.props.id === "party-change-reason")).toBe(true);
});
