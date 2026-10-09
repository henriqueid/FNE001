import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { buildEnrichmentSnapshot } from "@/src/domain/integrations/enrichment";
import { seedIntegrationState, updateIntegrationMode } from "@/src/domain/integrations/model";

const at = "2026-10-04T12:00:00.000Z";

describe("hub de enriquecimento", () => {
  it("identifica dados demonstrativos sem promovê-los a fonte oficial", () => {
    const snapshot = buildEnrichmentSnapshot({
      operation: initialOperations[0],
      debtors: initialDebtors,
      cedent: initialCedents[0],
      integrations: seedIntegrationState(),
      at,
    });

    expect(snapshot.summary.DEMONSTRACAO).toBeGreaterThan(0);
    expect(snapshot.summary.OFICIAL).toBe(0);
    expect(snapshot.checks.filter(check => check.provenance === "DEMONSTRACAO")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence: expect.stringContaining("Não representa consulta oficial") }),
      ]),
    );
  });

  it("mantém registradora e custodiante pendentes sem conexão configurada", () => {
    const snapshot = buildEnrichmentSnapshot({
      operation: initialOperations[0],
      debtors: initialDebtors,
      cedent: initialCedents[0],
      integrations: seedIntegrationState(),
      at,
    });

    expect(snapshot.checks.find(check => check.providerId === "REGISTRADORA")?.provenance).toBe("PENDENTE");
    expect(snapshot.checks.find(check => check.providerId === "CUSTODIANTE")?.provenance).toBe("PENDENTE");
  });

  it("reflete alteração de configuração em nova fotografia", () => {
    const seed = seedIntegrationState();
    const active = updateIntegrationMode(seed, "RECEITA", "ATIVA", at);
    const snapshot = buildEnrichmentSnapshot({
      operation: initialOperations[0],
      debtors: initialDebtors,
      cedent: initialCedents[0],
      integrations: active,
      at,
    });

    expect(
      snapshot.checks.filter(check => check.providerId === "RECEITA").every(check => check.provenance === "OFICIAL"),
    ).toBe(true);
    expect(snapshot.configurationFingerprint).not.toBe(
      buildEnrichmentSnapshot({
        operation: initialOperations[0],
        debtors: initialDebtors,
        cedent: initialCedents[0],
        integrations: seed,
        at,
      }).configurationFingerprint,
    );
  });

  it("marca cadastro provisório de sacado como pendência", () => {
    const operation = {
      ...initialOperations[0],
      manualEntry: {
        receivableType: "Duplicata" as const,
        mode: "individual" as const,
        entries: [
          {
            id: "title:new",
            documentNumber: "NF-1",
            amount: 1000,
            dueDate: "2026-11-01",
            debtorId: "pending:1",
            debtorName: "Sacado Novo",
            debtorDocument: "11.111.111/0001-11",
          },
        ],
      },
    };
    const provisional = {
      ...initialDebtors[0],
      id: "pending:1",
      document: "11.111.111/0001-11",
      name: "Sacado Novo",
      registrationStatus: "Provisório" as const,
    };
    const snapshot = buildEnrichmentSnapshot({
      operation,
      debtors: [provisional],
      cedent: initialCedents[0],
      integrations: seedIntegrationState(),
      at,
    });

    expect(snapshot.checks.find(check => check.id.startsWith("internal:debtors"))).toMatchObject({
      provenance: "PENDENTE",
      result: "PENDENTE",
    });
  });
});
