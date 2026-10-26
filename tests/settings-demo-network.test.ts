/** Demonstração não pode disparar consultas reais por efeitos nem por ações dos painéis. */
import type * as ReactModule from "react";
import { type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AIConfigurationPanel } from "@/src/features/settings/ai-configuration-panel";
import { OutboxHealthPanel } from "@/src/features/settings/outbox-health-panel";
const fixtures = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
  configuration: vi.fn(),
  test: vi.fn(),
  sync: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => unknown) => {
    fixtures.effects.push(effect);
  },
}));
vi.mock("@/src/app/intelligence-client", () => ({
  loadAIConfiguration: fixtures.configuration,
  testAIConfiguration: fixtures.test,
}));
vi.mock("@/src/app/notification-client", () => ({
  syncPublishedNotifications: fixtures.sync,
  retryFailedNotifications: fixtures.retry,
}));
function elements(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const el = value as ReactElement<Record<string, unknown>>;
  return [el, ...elements(el.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "props" in value)
    return text((value as ReactElement<{ children: unknown }>).props.children);
  return "";
}
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.effects = [];
  fixtures.configuration.mockResolvedValue({
    configured: false,
    model: "test",
    provider: "OpenAI",
    keyHint: "",
    endpoint: "",
  });
  fixtures.test.mockResolvedValue({ configuration: { configured: true }, test: { model: "test" } });
  fixtures.sync.mockResolvedValue({ notifications: [], health: { pending: 0, published: 0, failed: 0 } });
  fixtures.retry.mockResolvedValue({ pending: 0, published: 0, failed: 0 });
});
it("painel IA em demo não carrega nem testa servidor, inclusive handlers acionados diretamente", async () => {
  const onAvailabilityChange = vi.fn();
  const tree = AIConfigurationPanel({ ...{ demoMode: true }, onAvailabilityChange });
  for (const effect of fixtures.effects) effect();
  for (const button of elements(tree).filter(item => item.type === "button"))
    if (typeof button.props.onClick === "function") await button.props.onClick();
  expect(fixtures.configuration).not.toHaveBeenCalled();
  expect(fixtures.test).not.toHaveBeenCalled();
  expect(onAvailabilityChange).not.toHaveBeenCalled();
  expect(text(tree)).toContain("Demonstração");
});
it("outbox em demo não processa nem reprocessa fila real", async () => {
  const tree = OutboxHealthPanel({ ...{ demoMode: true }, tenantId: "CHURUME" });
  for (const effect of fixtures.effects) effect();
  for (const button of elements(tree).filter(item => item.type === "button"))
    if (typeof button.props.onClick === "function") await button.props.onClick();
  expect(fixtures.sync).not.toHaveBeenCalled();
  expect(fixtures.retry).not.toHaveBeenCalled();
  expect(text(tree)).toContain("Demonstração");
  expect(text(tree)).toContain("fila real não é consultada");
});
it("modo autenticado continua carregando configuração e estado da fila", () => {
  AIConfigurationPanel({});
  OutboxHealthPanel({ tenantId: "CHURUME" });
  for (const effect of fixtures.effects) effect();
  expect(fixtures.configuration).toHaveBeenCalledOnce();
  expect(fixtures.sync).toHaveBeenCalledWith("CHURUME");
});
