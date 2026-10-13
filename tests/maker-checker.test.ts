import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { DecisionEvent } from "@/src/domain/decisions/model";
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
    const base = { ...initialOperations[0], releaseReview: { status: "Em preparação" as const } };
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
  });
});
