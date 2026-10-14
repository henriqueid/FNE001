export type IntegrationProviderId =
  | "CEP"
  | "RECEITA"
  | "SEFAZ"
  | "BUREAU"
  | "PROTESTO"
  | "PEP_SANCOES"
  | "REGISTRADORA"
  | "CUSTODIANTE"
  | "OPEN_FINANCE"
  | "BANKING_PIX"
  | "FUNDING"
  | "ASSINATURA"
  | "NOTIFICACAO";

export type IntegrationMode = "DEMONSTRACAO" | "NAO_CONFIGURADA" | "ATIVA" | "INDISPONIVEL";

export type IntegrationCapability =
  "CNPJ_LOOKUP" | "CEP_LOOKUP" | "BANK_DIRECTORY" | "HOLIDAY_CALENDAR" | "PIX_DIRECTORY";

export type IntegrationConnection = {
  providerId: string;
  capability: IntegrationCapability;
  status: "ACTIVE" | "DEGRADED" | "PLANNED" | "SUSPENDED";
  priority: number;
  sourceType: "PUBLIC" | "INSTITUTIONAL";
  label: string;
  updatedAt: string;
};

export type IntegrationConfigurationSnapshot = Pick<
  IntegrationConnection,
  "providerId" | "capability" | "status" | "priority" | "sourceType" | "label"
>;

export type IntegrationChangeProposal = Pick<
  IntegrationConfigurationSnapshot,
  "providerId" | "capability" | "status" | "priority"
>;

export type IntegrationChangeRequest = {
  id: string;
  capability: IntegrationCapability;
  previous: IntegrationConfigurationSnapshot[];
  proposed: IntegrationConfigurationSnapshot[];
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedById: string;
  requestedBy: string;
  requestedAt: string;
  decidedById?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
};

export type IntegrationProvider = {
  id: IntegrationProviderId;
  name: string;
  description: string;
  capability: string;
  requirements: string;
  mode: IntegrationMode;
  updatedAt?: string;
  connection?: IntegrationConnection;
};

export type IntegrationState = {
  version: 1;
  providers: IntegrationProvider[];
  connections?: IntegrationConnection[];
  changeRequests?: IntegrationChangeRequest[];
};

const providerCatalog: Omit<IntegrationProvider, "mode">[] = [
  {
    id: "CEP",
    name: "CEP e endereços",
    description: "Preenchimento e validação de endereço a partir do CEP.",
    capability: "Cadastro e endereço",
    requirements: "Disponível em demonstração; produção deve definir provedor e SLA.",
  },
  {
    id: "RECEITA",
    name: "Receita Federal",
    description: "Situação cadastral de cedentes e sacados.",
    capability: "Cadastro e situação pública",
    requirements: "Certificado, procuração ou provedor homologado, conforme a fonte contratada.",
  },
  {
    id: "SEFAZ",
    name: "SEFAZ",
    description: "Existência e situação fiscal dos documentos eletrônicos.",
    capability: "NF-e e documentos fiscais",
    requirements: "Certificado digital e credenciamento SEFAZ por UF.",
  },
  {
    id: "BUREAU",
    name: "Bureaus de crédito",
    description: "Scores, restrições e ocorrências externas.",
    capability: "Crédito e restrições",
    requirements: "Contrato e credenciais do bureau escolhido.",
  },
  {
    id: "PROTESTO",
    name: "Protestos e cartórios",
    description: "Consultas de protestos, ocorrências e evidências cartorárias.",
    capability: "Crédito e ocorrências",
    requirements: "Contrato com central ou provedor de dados cartorários.",
  },
  {
    id: "PEP_SANCOES",
    name: "PEP, sanções e compliance",
    description: "Listas restritivas, PEP, sanções e apoio à qualificação KYC/COAF.",
    capability: "Compliance e prevenção",
    requirements: "Provedor homologado; COAF não oferece uma consulta cadastral pública irrestrita.",
  },
  {
    id: "REGISTRADORA",
    name: "Registradoras",
    description: "Registro, titularidade, gravames e ônus do recebível.",
    capability: "Registro e gravames",
    requirements: "Contrato, homologação e certificado com a registradora escolhida.",
  },
  {
    id: "CUSTODIANTE",
    name: "Custodiante",
    description: "Validação documental e eventos de custódia.",
    capability: "Custódia e lastro",
    requirements: "Contrato e leiaute/API do custodiante.",
  },
  {
    id: "OPEN_FINANCE",
    name: "Open Finance",
    description: "Dados bancários consentidos para análise e conciliação.",
    capability: "Dados bancários consentidos",
    requirements: "Participante ou agregador regulado, consentimento e certificados mTLS.",
  },
  {
    id: "BANKING_PIX",
    name: "Bancos, Pix e pagamentos",
    description: "Validação de conta, iniciação de pagamentos, Pix e retorno bancário.",
    capability: "Liquidação e conciliação",
    requirements: "Credenciais bancárias, certificados e homologação por instituição.",
  },
  {
    id: "FUNDING",
    name: "Bancos e funding",
    description: "Disponibilidade, limites e condições da estrutura de funding.",
    capability: "Funding e liquidação",
    requirements: "Contrato e API da instituição de funding.",
  },
  {
    id: "ASSINATURA",
    name: "Assinatura eletrônica",
    description: "Formalização e evidências de assinatura.",
    capability: "Formalização",
    requirements: "Conta corporativa e credenciais do provedor de assinatura.",
  },
  {
    id: "NOTIFICACAO",
    name: "E-mail, WhatsApp e notificações",
    description: "Confirmação de títulos, avisos operacionais e pós-venda.",
    capability: "Comunicação operacional",
    requirements: "Conta do provedor, modelos aprovados e consentimentos aplicáveis.",
  },
];

export function seedIntegrationState(): IntegrationState {
  return {
    version: 1,
    providers: providerCatalog.map(provider => ({
      ...provider,
      mode: ["CEP", "RECEITA", "SEFAZ", "BUREAU", "PEP_SANCOES"].includes(provider.id)
        ? "DEMONSTRACAO"
        : "NAO_CONFIGURADA",
    })),
  };
}

/** Catálogo real sem integrações ficticiamente conectadas. */
export function emptyIntegrationState(): IntegrationState {
  return {
    version: 1,
    providers: providerCatalog.map(provider => ({ ...provider, mode: "NAO_CONFIGURADA" })),
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
        ? { ...provider, mode: existing.mode, updatedAt: existing.updatedAt, connection: existing.connection }
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
