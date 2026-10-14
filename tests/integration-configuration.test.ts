import { describe, expect, it } from "vitest";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { activeIntegrationProvider, loadIntegrationState } from "@/src/server/integrations/configuration-repository";

type Row = {
  provider_id: string;
  capability: "CNPJ_LOOKUP" | "CEP_LOOKUP";
  status: "ACTIVE" | "DEGRADED" | "PLANNED" | "SUSPENDED";
  priority: number;
  config: { sourceType?: string; apiKey?: string };
  updated_at: string;
};

const database = (rows: Row[]) =>
  ({
    prepare(_query: string) {
      let values: unknown[] = [];
      return {
        bind(...input: unknown[]) {
          values = input;
          return this;
        },
        async all() {
          return { results: rows };
        },
        async first() {
          const capability = values[1];
          return (
            rows
              .filter(row => row.capability === capability && row.status === "ACTIVE")
              .sort((left, right) => left.priority - right.priority)[0] ?? null
          );
        },
        async run() {
          return { success: true };
        },
      };
    },
    async batch() {
      return [];
    },
    async exec() {},
  }) as unknown as DecisionDatabase;

const updatedAt = "2026-10-14T12:00:00.000Z";

describe("configuração operacional de integrações", () => {
  it("expõe somente disponibilidade sanitizada e identifica fonte pública", async () => {
    const state = await loadIntegrationState(
      database([
        {
          provider_id: "BRASIL_API",
          capability: "CNPJ_LOOKUP",
          status: "ACTIVE",
          priority: 10,
          config: { sourceType: "PUBLIC", apiKey: "nunca-deve-sair-do-servidor" },
          updated_at: updatedAt,
        },
      ]),
      "tenant-1",
    );

    const provider = state.providers.find(item => item.id === "RECEITA");
    expect(provider).toMatchObject({
      name: "CNPJ e situação cadastral",
      mode: "ATIVA",
      connection: {
        providerId: "BRASIL_API",
        capability: "CNPJ_LOOKUP",
        sourceType: "PUBLIC",
        label: "BrasilAPI · fonte pública",
      },
    });
    expect(JSON.stringify(provider)).not.toContain("apiKey");
    expect(state.providers.find(item => item.id === "SEFAZ")?.mode).toBe("NAO_CONFIGURADA");
  });

  it("não promove configuração planejada e representa indisponibilidade", async () => {
    const state = await loadIntegrationState(
      database([
        {
          provider_id: "BRASIL_API",
          capability: "CNPJ_LOOKUP",
          status: "SUSPENDED",
          priority: 10,
          config: { sourceType: "PUBLIC" },
          updated_at: updatedAt,
        },
        {
          provider_id: "RECEITA_WS",
          capability: "CEP_LOOKUP",
          status: "PLANNED",
          priority: 20,
          config: { sourceType: "INSTITUTIONAL" },
          updated_at: updatedAt,
        },
      ]),
      "tenant-1",
    );

    expect(state.providers.find(item => item.id === "RECEITA")?.mode).toBe("INDISPONIVEL");
    expect(state.providers.find(item => item.id === "CEP")?.mode).toBe("NAO_CONFIGURADA");
  });

  it("seleciona somente provedor ativo pela prioridade", async () => {
    const db = database([
      {
        provider_id: "PROVIDER_B",
        capability: "CNPJ_LOOKUP",
        status: "ACTIVE",
        priority: 20,
        config: { sourceType: "INSTITUTIONAL", apiKey: "segredo" },
        updated_at: updatedAt,
      },
      {
        provider_id: "BRASIL_API",
        capability: "CNPJ_LOOKUP",
        status: "ACTIVE",
        priority: 10,
        config: { sourceType: "PUBLIC" },
        updated_at: updatedAt,
      },
    ]);

    await expect(activeIntegrationProvider(db, "tenant-1", "CNPJ_LOOKUP")).resolves.toMatchObject({
      providerId: "BRASIL_API",
      sourceType: "PUBLIC",
    });
    await expect(activeIntegrationProvider(db, "tenant-1", "PIX_DIRECTORY")).resolves.toBeNull();
  });
});
