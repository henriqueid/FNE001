import { describe, expect, it } from "vitest";
import { queueRepurchaseWriteOff } from "@/src/domain/banking/writeoff";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
const input = {
  applicationId: "application-1",
  operationId: "operation-2",
  actor: "Operador",
  at: "2026-10-25T00:00:00Z",
};
describe("fila bancária de recompra", () => {
  it("enfileira registro vigente sem afirmar baixa bancária", () => {
    const title = {
      ...seedPortfolio(initialOperations).titles[0],
      bankStatus: "Registrado" as const,
      ourNumber: "123",
      bank: "341",
      agency: "1234",
      account: "12345",
      wallet: "109",
    };
    expect(queueRepurchaseWriteOff(title, input)).toMatchObject({
      title: { bankStatus: "Registrado", bankWriteoff: { applicationId: input.applicationId, status: "Pendente" } },
    });
  });
  it("bloqueia vínculo inconclusivo ou liquidado", () => {
    for (const bankStatus of ["Pendente de integração", "Liquidado"] as const) {
      expect(
        queueRepurchaseWriteOff({ ...seedPortfolio(initialOperations).titles[0], bankStatus }, input).error,
      ).toBeTruthy();
    }
  });
  it("dispensa fila quando sem boleto ou já baixado", () => {
    for (const bankStatus of ["Sem boleto", "Baixado"] as const) {
      expect(
        queueRepurchaseWriteOff({ ...seedPortfolio(initialOperations).titles[0], bankStatus }, input).title
          .bankWriteoff,
      ).toBeUndefined();
    }
  });
});

import { validatePortfolioTransition } from "@/src/domain/portfolio/persistence";
it("snapshot genérico não forja fila nem confirmação bancária", () => {
  const previous = seedPortfolio(initialOperations);
  const next = structuredClone(previous);
  next.titles[0].bankWriteoff = {
    operationId: "x",
    cycleId: "app",
    applicationId: "app",
    status: "Confirmada",
    requestedAt: "2026-10-25T00:00:00Z",
  };
  expect(validatePortfolioTransition(previous, next, "Operador")).toBeTruthy();
});
