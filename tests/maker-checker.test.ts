import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import type { DecisionEvent } from "@/src/domain/decisions/model";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import {
  hydrateOperationReceivables,
  receivablesFromOperation,
  stripReceivablesFromOperation,
} from "@/src/domain/receivables/model";
import { assertExceptionMakerChecker } from "@/src/server/decisions/governance";
import {
  assertOperationTransition,
  governReleaseTransition,
  OperationGovernanceError,
} from "@/src/server/operations/governance";
import { operationMutationPermissionError } from "@/src/domain/operations/mutation-permissions";

const request = (actorId: string, eventType: DecisionEvent["eventType"] = "EXCEPTION_REQUESTED") =>
  ({ actorId, eventType }) as DecisionEvent;

describe("maker-checker de decisões materiais", () => {
  it("impede o solicitante de decidir a própria exceção", () => {
    expect(() => assertExceptionMakerChecker([request("maker")], "maker", "EXCEPTION_APPROVED")).toThrow(
      "própria solicitação",
    );
    expect(() => assertExceptionMakerChecker([request("maker")], "checker", "EXCEPTION_APPROVED")).not.toThrow();
  });

  it("exige solicitação e impede uma segunda decisão terminal", () => {
    expect(() => assertExceptionMakerChecker([], "checker", "EXCEPTION_REJECTED")).toThrow("solicitada");
    expect(() =>
      assertExceptionMakerChecker(
        [request("maker"), request("checker-1", "EXCEPTION_APPROVED")],
        "checker-2",
        "EXCEPTION_REJECTED",
      ),
    ).toThrow("já recebeu");
  });

  it("registra o preparador no servidor e exige outro usuário para aprovar a liberação", () => {
    const base = {
      ...initialOperations[0],
      stage: 6,
      netAmount: 100,
      pricingReview: undefined,
      releaseReview: {
        status: "Em preparação" as const,
        preparedById: "sinal-do-navegador",
        paymentDate: "2026-10-14",
        payees: [
          {
            id: "favorecido-1",
            relation: "Cedente" as const,
            name: "Cedente Exemplo",
            document: "52.927.676/0001-29",
            method: "PIX" as const,
            pixKey: "financeiro@cedente.test",
            amount: 100,
          },
        ],
      },
    };
    const prepared = governReleaseTransition(null, base, { id: "maker", name: "Preparador" }, "2026-10-13T10:00:00Z");
    expect(prepared.releaseReview).toMatchObject({ preparedById: "maker", preparedBy: "Preparador" });

    const release = {
      ...prepared,
      releaseReview: { ...prepared.releaseReview!, status: "Enviada ao financeiro" as const, releasedBy: "forjado" },
    };
    expect(() => governReleaseTransition(prepared, release, { id: "maker", name: "Preparador" })).toThrow(
      OperationGovernanceError,
    );
    const approved = governReleaseTransition(
      prepared,
      release,
      { id: "checker", name: "Aprovador" },
      "2026-10-13T11:00:00Z",
    );
    expect(approved.releaseReview).toMatchObject({
      preparedById: "maker",
      approvedById: "checker",
      approvedBy: "Aprovador",
      releasedBy: "Aprovador",
    });
  });

  it("não aceita aprovação direta nem reescrita posterior", () => {
    const direct = {
      ...initialOperations[0],
      releaseReview: { status: "Enviada ao financeiro" as const },
    };
    expect(() => governReleaseTransition(null, direct, { id: "checker", name: "Aprovador" })).toThrow(
      "preparada e salva",
    );
    const approved = {
      ...direct,
      releaseReview: { ...direct.releaseReview, preparedById: "maker", approvedById: "checker" },
    };
    expect(() =>
      governReleaseTransition(
        approved,
        { ...approved, releaseReview: { ...approved.releaseReview, observation: "mudou" } },
        { id: "other", name: "Outro" },
      ),
    ).toThrow("não pode ser reescrita");
  });

  it("separa as permissões de Operações, Risco, Controladoria e Financeiro", () => {
    const base = initialOperations[0];
    const riskChange = { ...base, riskReview: { ...base.riskReview, cedentDecision: "Aprovado" as const } };
    const approvalChange = {
      ...base,
      approvalReview: { status: "Preparação" as const, observation: "Pacote iniciado" },
    };
    const releaseChange = { ...base, releaseReview: { status: "Em preparação" as const } };

    expect(operationMutationPermissionError(base, riskChange, ["finance:release"])).toContain("Somente Risco");
    expect(operationMutationPermissionError(base, riskChange, ["risk:decide"])).toBeNull();
    expect(operationMutationPermissionError(base, approvalChange, ["operations:edit"])).toContain("Controladoria");
    expect(operationMutationPermissionError(base, approvalChange, ["controlleria:formalize"])).toBeNull();
    expect(operationMutationPermissionError(base, releaseChange, ["controlleria:formalize"])).toContain("Financeiro");
    expect(operationMutationPermissionError(base, releaseChange, ["finance:release"])).toBeNull();
  });

  it("compara permissões com o snapshot reidratado e permite a conclusão por Risco", () => {
    const base = initialOperations[0];
    const persisted = stripReceivablesFromOperation(base);
    const hydrated = hydrateOperationReceivables(persisted, receivablesFromOperation(base));
    const run = evaluateOperationEligibility({ operation: hydrated, debtors: initialDebtors });
    const decided = {
      ...hydrated,
      eligibilityReview: {
        run: { ...run, evaluations: run.evaluations.map(item => ({ ...item, outcome: "APROVADO" as const })) },
        overrides: [],
      },
    };
    const advanced = {
      ...decided,
      stage: 3,
      status: "Em andamento" as const,
      stageCompletions: [{ stageId: 2, completedBy: "Risco", completedAt: "13/10/2026, 12:00" }],
    };

    expect(hydrated.manualEntry?.entries).toHaveLength(base.manualEntry?.entries.length ?? 0);
    expect(operationMutationPermissionError(hydrated, decided, ["risk:decide"])).toBeNull();
    expect(operationMutationPermissionError(decided, advanced, ["risk:decide"])).toBeNull();

    const manualDecisions = {
      ...hydrated,
      eligibilityReview: undefined,
      riskReview: {
        cedentDecision: "Aprovado" as const,
        debtorDecisions: Object.fromEntries(
          hydrated.manualEntry!.entries.map(entry => [entry.debtorId || entry.debtorDocument, "Aprovado" as const]),
        ),
        titleDecisions: Object.fromEntries(hydrated.manualEntry!.entries.map(entry => [entry.id, "Aprovado" as const])),
      },
    };
    expect(
      operationMutationPermissionError(manualDecisions, { ...manualDecisions, stage: 3 }, ["risk:decide"]),
    ).toBeNull();
  });

  it("valida estados terminais e liberação no servidor", () => {
    const released = { ...initialOperations[0], stage: 6, status: "Liberada ao financeiro" as const };
    expect(() => assertOperationTransition(released, { ...released, blockers: 99 })).toThrow("somente para consulta");
    expect(() =>
      assertOperationTransition(null, {
        ...initialOperations[0],
        stage: 6,
        status: "Liberada ao financeiro",
        releaseReview: { status: "Em preparação" },
      }),
    ).toThrow("autorização concluída");
    expect(() => assertOperationTransition(null, { ...initialOperations[0], stage: 2, titleCount: 0 })).toThrow(
      "ao menos um título",
    );
    expect(() =>
      assertOperationTransition(initialOperations[0], {
        ...initialOperations[0],
        releaseReview: { status: "Em preparação" },
      }),
    ).toThrow("etapa de Liberação");
    expect(() =>
      assertOperationTransition({ ...initialOperations[0], stage: 1 }, { ...initialOperations[0], stage: 6 }),
    ).toThrow("etapa intermediária");
    expect(() =>
      assertOperationTransition({ ...initialOperations[0], stage: 5 }, { ...initialOperations[0], stage: 6 }),
    ).toThrow("aprovação, documentos e assinaturas");
  });

  it("permite baixa e estorno financeiro sem reabrir a operação liberada", () => {
    const payable = {
      id: "pay-1",
      payee: "Cedente",
      document: "52927676000129",
      method: "PIX" as const,
      destination: "chave-pix",
      amount: 100,
      dueDate: "2026-10-13",
      payingAccount: "Conta principal",
      status: "Pendente de pagamento" as const,
      createdAt: "13/10/2026, 10:00",
    };
    const released = {
      ...initialOperations[0],
      stage: 6,
      status: "Liberada ao financeiro" as const,
      releaseReview: { status: "Enviada ao financeiro" as const, payables: [payable], audit: [] },
    };
    const paid = {
      ...released,
      releaseReview: {
        ...released.releaseReview,
        payables: [{ ...payable, status: "Pago" as const, paidAt: "2026-10-13" }],
        audit: [{ at: "13/10/2026, 12:00", by: "Financeiro", action: "Pagamento realizado", detail: "pay-1" }],
      },
    };
    expect(() => assertOperationTransition(released, paid)).not.toThrow();
    expect(() => governReleaseTransition(released, paid, { id: "finance", name: "Financeiro" })).not.toThrow();

    const reversed = {
      ...paid,
      releaseReview: {
        ...paid.releaseReview,
        payables: [{ ...payable }],
        audit: [
          ...paid.releaseReview.audit,
          { at: "13/10/2026, 12:10", by: "Financeiro", action: "Pagamento estornado", detail: "pay-1" },
        ],
      },
    };
    expect(() => assertOperationTransition(paid, reversed)).not.toThrow();
    expect(() => governReleaseTransition(paid, reversed, { id: "finance", name: "Financeiro" })).not.toThrow();
  });
});
