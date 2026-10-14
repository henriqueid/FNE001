import {
  emptyIntegrationState,
  type IntegrationConnection,
  type IntegrationState,
} from "@/src/domain/integrations/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

export type IntegrationCapability =
  "CNPJ_LOOKUP" | "CEP_LOOKUP" | "BANK_DIRECTORY" | "HOLIDAY_CALENDAR" | "PIX_DIRECTORY";

type ConfigurationRow = {
  provider_id: string;
  capability: IntegrationCapability;
  status: IntegrationConnection["status"];
  priority: number;
  config: { sourceType?: string };
  updated_at: string;
};

const publicProviderLabels: Record<string, string> = {
  BRASIL_API: "BrasilAPI · fonte pública",
};

const catalogMapping = {
  CEP: "CEP_LOOKUP",
  RECEITA: "CNPJ_LOOKUP",
} as const;

const modeFor = (status: ConfigurationRow["status"]) => {
  if (status === "ACTIVE") return "ATIVA" as const;
  if (status === "DEGRADED" || status === "SUSPENDED") return "INDISPONIVEL" as const;
  return "NAO_CONFIGURADA" as const;
};

const connectionFor = (row: ConfigurationRow): IntegrationConnection => ({
  providerId: row.provider_id,
  capability: row.capability,
  status: row.status,
  sourceType: row.config?.sourceType === "PUBLIC" || row.provider_id === "BRASIL_API" ? "PUBLIC" : "INSTITUTIONAL",
  label: publicProviderLabels[row.provider_id] ?? row.provider_id,
  updatedAt: row.updated_at,
});

async function configurations(db: DecisionDatabase, tenantId: string) {
  const result = await db
    .prepare(
      `select provider_id, capability, status, priority, config, updated_at
       from private.integration_provider_configs
       where tenant_id = ?
       order by capability,
         case status when 'ACTIVE' then 0 when 'DEGRADED' then 1 when 'SUSPENDED' then 2 else 3 end,
         priority`,
    )
    .bind(tenantId)
    .all<ConfigurationRow>();
  return result.results;
}

/** Retorna somente disponibilidade operacional sanitizada; nunca devolve `config` ou credenciais ao navegador. */
export async function loadIntegrationState(db: DecisionDatabase, tenantId: string): Promise<IntegrationState> {
  const rows = await configurations(db, tenantId);
  const bestByCapability = new Map<IntegrationCapability, ConfigurationRow>();
  for (const row of rows) if (!bestByCapability.has(row.capability)) bestByCapability.set(row.capability, row);
  const state = emptyIntegrationState();
  return {
    ...state,
    providers: state.providers.map(provider => {
      const capability = catalogMapping[provider.id as keyof typeof catalogMapping];
      if (!capability) return provider;
      const row = bestByCapability.get(capability);
      if (!row) return provider;
      return {
        ...provider,
        name:
          provider.id === "RECEITA" && connectionFor(row).sourceType === "PUBLIC"
            ? "CNPJ e situação cadastral"
            : provider.name,
        mode: modeFor(row.status),
        updatedAt: row.updated_at,
        connection: connectionFor(row),
      };
    }),
  };
}

export async function activeIntegrationProvider(
  db: DecisionDatabase,
  tenantId: string,
  capability: IntegrationCapability,
) {
  const row = await db
    .prepare(
      `select provider_id, capability, status, priority, config, updated_at
       from private.integration_provider_configs
       where tenant_id = ? and capability = ? and status = 'ACTIVE'
       order by priority
       limit 1`,
    )
    .bind(tenantId, capability)
    .first<ConfigurationRow>();
  return row ? connectionFor(row) : null;
}
