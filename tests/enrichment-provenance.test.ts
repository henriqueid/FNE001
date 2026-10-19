/** Verifica que configuração de integração não substitui evidência de consulta. */
import { describe, expect, it } from "vitest";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { buildEnrichmentSnapshot } from "@/src/domain/integrations/enrichment";
import { seedIntegrationState, type IntegrationMode } from "@/src/domain/integrations/model";

const at = "2026-10-18T12:00:00.000Z";
const snapshotFor = (mode: IntegrationMode) => {
  const integrations = seedIntegrationState();
  return buildEnrichmentSnapshot({
    operation: initialOperations[0],
    debtors: initialDebtors,
    cedent: initialCedents[0],
    integrations: {
      ...integrations,
      providers: integrations.providers.map(provider => ({ ...provider, mode })),
    },
    at,
  });
};

describe("proveniência do enriquecimento externo", () => {
  it("mantém todas as integrações ativas pendentes sem evidência efetiva", () => {
    const snapshot = snapshotFor("ATIVA");
    const external = snapshot.checks.filter(check => check.providerId);

    expect(external).toHaveLength(6);
    for (const check of external) {
      expect(check).toMatchObject({
        provenance: "PENDENTE",
        result: "PENDENTE",
        value: "Consulta pendente",
        observedAt: at,
      });
      expect(check.evidence).toContain("evidência");
      expect(check.evidence).not.toContain("Retorno da integração");
    }
    expect(snapshot.summary.OFICIAL).toBe(0);
    expect(snapshot.summary.DEMONSTRACAO).toBe(0);
  });

  it.each(["DEMONSTRACAO", "INDISPONIVEL", "NAO_CONFIGURADA"] as const)(
    "preserva o estado explícito %s sem promover dados a oficiais",
    mode => {
      const snapshot = snapshotFor(mode);
      const provenance = mode === "NAO_CONFIGURADA" ? "PENDENTE" : mode;
      expect(snapshot.checks.filter(check => check.providerId).every(check => check.provenance === provenance)).toBe(
        true,
      );
      expect(snapshot.summary.OFICIAL).toBe(0);
    },
  );
});
