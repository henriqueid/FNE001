/** Componentes exercitados com estado/efeitos controlados; não substitui clique em navegador. */
import type { ComponentProps, ReactElement } from "react";
import type * as ReactModule from "react";
import { beforeEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  effects: [] as Array<() => unknown>,
  load: vi.fn(),
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
}));
vi.mock("@/src/app/company-context", () => ({ useCompanyDestinations: () => [], useCompanyDirectory: () => null }));
vi.mock("@/src/app/operational-parameters-client", () => ({
  loadOperationalParameters: runtime.load,
  persistOperationalParameters: vi.fn(),
}));
import SettingsModule from "@/src/features/settings/settings-module";
import { UsersAccessPanel } from "@/src/features/settings/users-access-panel";
import { AIConfigurationPanel } from "@/src/features/settings/ai-configuration-panel";
import { OutboxHealthPanel } from "@/src/features/settings/outbox-health-panel";
import { seedAccessState } from "@/src/domain/access/model";
import { emptyEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { emptyIntegrationState } from "@/src/domain/integrations/model";
import { emptyOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { emptyFinance } from "@/src/domain/finance/setup";
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
function props(manager = false): ComponentProps<typeof SettingsModule> {
  const access = seedAccessState();
  if (manager) {
    const actor = access.users[1];
    access.authenticatedUserId = actor.id;
    access.users = access.users.map(user => (user.id === actor.id ? { ...user, permissions: ["users:manage"] } : user));
  }
  return {
    policies: emptyEligibilityPolicies(),
    persistedPolicies: emptyEligibilityPolicies(),
    onPolicies: vi.fn(),
    onSavePolicies: vi.fn(),
    showGuidance: true,
    onGuidance: vi.fn(),
    showJourney: false,
    onJourney: vi.fn(),
    integrations: emptyIntegrationState(),
    onIntegrations: vi.fn(),
    operationalDefaults: emptyOperationalDefaults(),
    onOperationalDefaults: vi.fn(),
    access,
    onAccess: vi.fn(),
    intelligence: emptyIntelligenceState(),
    onIntelligence: vi.fn(),
    policyApprovalActor: { id: access.authenticatedUserId, name: "CHURUME" },
    finance: emptyFinance(),
    onFinance: vi.fn(),
    companyScope: "Consolidado",
  };
}
function render(input: ComponentProps<typeof SettingsModule>) {
  runtime.index = 0;
  runtime.effects = [];
  return SettingsModule(input);
}
function navigate(tree: unknown, label: string) {
  const button = elements(tree).find(element => element.type === "button" && text(element).includes(label));
  expect(button).toBeDefined();
  (button!.props.onClick as () => void)();
}
beforeEach(() => {
  runtime.index = 0;
  runtime.values = [];
  runtime.effects = [];
  runtime.load.mockReset();
  runtime.load.mockResolvedValue({ state: emptyOperationalDefaults() });
});
it("gestor de usuários só monta acesso e não carrega padrões, mesmo com pedido bancário inicial", () => {
  const input = { ...props(true), bankSettingsCompany: "CHURUME Empresa" };
  const tree = render(input);
  const labels = elements(tree)
    .filter(element => element.type === "button")
    .map(text);
  expect(labels.some(label => label.includes("Usuários e acesso"))).toBe(true);
  expect(
    labels.some(label => label.includes("Bancos") || label.includes("Políticas") || label.includes("Visão geral")),
  ).toBe(false);
  expect(elements(tree).some(element => element.type === UsersAccessPanel)).toBe(true);
  runtime.effects.forEach(effect => effect());
  expect(runtime.load).not.toHaveBeenCalled();
});
it("revogar administração de configurações desmonta seção anterior e sua navegação", () => {
  const admin = props();
  let tree = render(admin);
  navigate(tree, "Integrações");
  tree = render(admin);
  expect(text(tree)).toContain("Integrações do motor");
  tree = render({ ...admin, access: props(true).access });
  expect(text(tree)).not.toContain("Integrações do motor");
  expect(elements(tree).some(element => element.type === UsersAccessPanel)).toBe(true);
});
it("licença/ativação não editam estado não confirmado; erro permite nova tentativa", () => {
  const retry = vi.fn();
  const input = {
    ...props(),
    intelligenceReady: false,
    intelligenceError: "CHURUME falha de gravação",
    onRetryIntelligence: retry,
  };
  let tree = render(input);
  navigate(tree, "Inteligência e IA");
  tree = render(input);
  expect(text(tree)).toContain("CHURUME falha de gravação");
  const toggles = elements(tree).filter(element => element.type === "input" && element.props.type === "checkbox");
  expect(toggles.length).toBe(2);
  expect(toggles.every(element => element.props.disabled)).toBe(true);
  navigate(tree, "Tentar novamente");
  expect(retry).toHaveBeenCalledOnce();
});
it("demo identifica falta de conexão real e transmite demoMode aos painéis externos", () => {
  const input = { ...props(), demoMode: true };
  let tree = render(input);
  navigate(tree, "Inteligência e IA");
  tree = render(input);
  expect(text(tree)).toContain("Demonstração · sem conexão real");
  expect(elements(tree).find(element => element.type === AIConfigurationPanel)?.props.demoMode).toBe(true);
  expect(elements(tree).find(element => element.type === OutboxHealthPanel)?.props.demoMode).toBe(true);
});
