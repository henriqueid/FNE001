/** Destino de dossiê deve seguir identidade estável e não o primeiro homônimo. */
import { type ReactElement } from "react";
import type * as ReactModule from "react";
import { expect, it, vi } from "vitest";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { CommitteesTab } from "@/src/features/commercial/tabs/committees-tab";
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
function elements(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}
it("abre prospectId correto entre homônimos e não faz fallback de ID inexistente", () => {
  const state = seedCommercial();
  const base = state.prospects[0];
  const first = { ...base, id: "homonimo-errado", name: "CHURUME homônimos" };
  const right = { ...base, id: "identidade-correta", name: first.name };
  const committee = {
    ...state.committees[0],
    prospectId: right.id,
    clientName: right.name,
    status: "Em pauta" as const,
  };
  const onOpenDossier = vi.fn();
  const props = {
    state: { ...state, prospects: [first, right] },
    pauta: [committee],
    repFilter: "",
    from: "2026-01-01",
    to: "2026-12-31",
    onDecide: vi.fn(),
    onOpenDossier,
    canDecide: true,
  };
  const button = elements(CommitteesTab(props)).find(
    item => item.type === "button" && item.props.children === "Ver dossiê",
  )!;
  (button.props.onClick as () => void)();
  expect(onOpenDossier).toHaveBeenCalledWith(right);
  expect(
    elements(CommitteesTab({ ...props, pauta: [{ ...committee, prospectId: "apagado" }] })).some(
      item => item.type === "button" && item.props.children === "Ver dossiê",
    ),
  ).toBe(false);
  expect(
    elements(CommitteesTab({ ...props, pauta: [{ ...committee, prospectId: undefined }] })).some(
      item => item.type === "button" && item.props.children === "Ver dossiê",
    ),
  ).toBe(false);
  const legacy = elements(
    CommitteesTab({
      ...props,
      state: { ...props.state, prospects: [right] },
      pauta: [{ ...committee, prospectId: undefined }],
    }),
  ).find(item => item.type === "button" && item.props.children === "Ver dossiê");
  expect(legacy).toBeDefined();
});
