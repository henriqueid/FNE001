import { describe, expect, it } from "vitest";
import type { Operation, ReleaseReview } from "@/src/domain/core/types";
import { governReleaseTransition, OperationGovernanceError } from "@/src/server/operations/governance";

const operation = (review: ReleaseReview): Operation =>
  ({
    id: "op-approval",
    borderoNumber: "0000099",
    stage: 6,
    status: "Em andamento",
    netAmount: 100,
    releaseReview: review,
  }) as Operation;

const prepared: ReleaseReview = {
  status: "Em preparação",
  preparedById: "maker",
  preparedBy: "Preparador",
  preparedAt: "2026-10-14T10:00:00.000Z",
  paymentDate: "2026-10-15",
  observation: "Pacote conferido",
  payees: [
    {
      id: "payee-1",
      relation: "Cedente",
      name: "Cedente Exemplo",
      document: "52.927.676/0001-29",
      method: "PIX",
      pixKey: "financeiro@cedente.test",
      amount: 100,
    },
  ],
  audit: [],
};

describe("integridade da aprovação de favorecidos", () => {
  it("recusa troca de chave, conta, favorecido ou valor no ato da aprovação", () => {
    const current = operation(prepared);
    const changed = operation({
      ...prepared,
      status: "Enviada ao financeiro",
      payees: [{ ...prepared.payees![0], pixKey: "chave-do-atacante", amount: 100 }],
    });

    expect(() =>
      governReleaseTransition(current, changed, { id: "checker", name: "Aprovador" }),
    ).toThrow(OperationGovernanceError);
    expect(() =>
      governReleaseTransition(current, changed, { id: "checker", name: "Aprovador" }),
    ).toThrow("não podem mudar durante a aprovação");
  });

  it("ignora lançamentos forjados pelo navegador e os recria do pacote preparado", () => {
    const current = operation(prepared);
    const requested = operation({
      ...prepared,
      status: "Enviada ao financeiro",
      payables: [
        {
          id: "forjado",
          payee: "Atacante",
          document: "00000000000",
          method: "PIX",
          destination: "Chave PIX atacante",
          amount: 100,
          dueDate: "2026-10-15",
          payingAccount: "Conta forjada",
          status: "Pago",
          createdAt: "forjado",
        },
      ],
      audit: [{ at: "forjado", by: "forjado", action: "forjado", detail: "forjado" }],
    });

    const approved = governReleaseTransition(
      current,
      requested,
      { id: "checker", name: "Aprovador" },
      "2026-10-14T11:00:00.000Z",
    );

    expect(approved.releaseReview?.payables).toEqual([
      expect.objectContaining({
        id: "CP-0000099-01",
        payee: "Cedente Exemplo",
        destination: "Chave PIX financeiro@cedente.test",
        amount: 100,
        status: "Pendente de pagamento",
        createdAt: "2026-10-14T11:00:00.000Z",
      }),
    ]);
    expect(approved.releaseReview?.audit).toEqual([
      expect.objectContaining({ by: "Aprovador", action: "Liberada ao financeiro" }),
    ]);
  });

  it("valida no servidor o favorecido e a distribuição antes de registrar a preparação", () => {
    const invalid = operation({
      status: "Em preparação",
      preparedById: "sinal-do-navegador",
      paymentDate: "2026-10-15",
      payees: [{ ...prepared.payees![0], amount: 99 }],
    });

    expect(() => governReleaseTransition(null, invalid, { id: "maker", name: "Preparador" })).toThrow(
      "distribuir exatamente",
    );
  });
});
