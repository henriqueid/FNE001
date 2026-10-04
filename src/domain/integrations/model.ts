export type IntegrationProviderId =
  "RECEITA" | "SEFAZ" | "BUREAU" | "REGISTRADORA" | "CUSTODIANTE" | "FUNDING" | "ASSINATURA";

export type IntegrationMode = "DEMONSTRACAO" | "NAO_CONFIGURADA" | "ATIVA" | "INDISPONIVEL";

export type IntegrationProvider = {
  id: IntegrationProviderId;
  name: string;
  description: string;
  capability: string;
  mode: IntegrationMode;
  updatedAt?: string;
};

export type IntegrationState = { version: 1; providers: IntegrationProvider[] };

const providerCatalog: Omit<IntegrationProvider, "mode">[] = [
  {
    id: "RECEITA",
    name: "Receita Federal",
    description: "Situação cadastral de cedentes e sacados.",
    capability: "Cadastro e situação pública",
  },
  {
    id: "SEFAZ",
    name: "SEFAZ",
    description: "Existência e situação fiscal dos documentos eletrônicos.",
    capability: "NF-e e documentos fiscais",
  },
  {
    id: "BUREAU",
    name: "Bureaus de crédito",
    description: "Scores, restrições e ocorrências externas.",
    capability: "Crédito e restrições",
  },
  {
    id: "REGISTRADORA",
    name: "Registradoras",
    description: "Registro, titularidade, gravames e ônus do recebível.",
    capability: "Registro e gravames",
  },
  {
    id: "CUSTODIANTE",
    name: "Custodiante",
    description: "Validação documental e eventos de custódia.",
    capability: "Custódia e lastro",
  },
  {
    id: "FUNDING",
    name: "Bancos e funding",
    description: "Disponibilidade, limites e condições da estrutura de funding.",
    capability: "Funding e liquidação",
  },
  {
    id: "ASSINATURA",
    name: "Assinatura eletrônica",
    description: "Formalização e evidências de assinatura.",
    capability: "Formalização",
  },
];

export function seedIntegrationState(): IntegrationState {
  return {
    version: 1,
    providers: providerCatalog.map(provider => ({
      ...provider,
      mode: ["RECEITA", "SEFAZ", "BUREAU"].includes(provider.id) ? "DEMONSTRACAO" : "NAO_CONFIGURADA",
    })),
  };
}

export function migrateIntegrationState(value: unknown): IntegrationState {
  const seed = seedIntegrationState();
  if (!value || typeof value !== "object") return seed;
  const stored = value as Partial<IntegrationState>;
  if (!Array.isArray(stored.providers)) return seed;
  const byId = new Map(stored.providers.map(provider => [provider.id, provider]));
  return {
    version: 1,
    providers: seed.providers.map(provider => {
      const existing = byId.get(provider.id);
      return existing && ["DEMONSTRACAO", "NAO_CONFIGURADA", "ATIVA", "INDISPONIVEL"].includes(existing.mode)
        ? { ...provider, mode: existing.mode, updatedAt: existing.updatedAt }
        : provider;
    }),
  };
}

export function updateIntegrationMode(
  state: IntegrationState,
  id: IntegrationProviderId,
  mode: IntegrationMode,
  at = new Date().toISOString(),
): IntegrationState {
  return {
    ...state,
    providers: state.providers.map(provider => (provider.id === id ? { ...provider, mode, updatedAt: at } : provider)),
  };
}
