/** Devolução preserva fatos e permite uma nova aquisição auditável, sem apagar o ciclo anterior. */
import { describe, expect, it } from "vitest";
import { releasedOperation } from "./operation-return-fixture";
import { emptyFinance } from "@/src/domain/finance/setup";
import { returnOperation, syncReleases } from "@/src/domain/finance/releases";

const financial = { face: 1000, discount: 100, fees: 0, revenue: 0, rate: 0, net: 900 };
describe("devolução sem exclusão de fatos financeiros", () => {
  it("mantém compra e registro no histórico e permite compra nova após estorno", () => {
    const operation = releasedOperation();
    const finance = syncReleases(emptyFinance(), [operation], { [operation.id]: financial }, "Operador");
    finance.registrations[operation.id] = { sentAt: "2026-10-18T12:00:00Z", titles: 1, account: "Conta A" };
    const purchase = finance.purchasePosted[operation.id];
    const returned = returnOperation(
      finance,
      operation,
      { targetStage: 3, reason: "Correção documental", cashMoved: false },
      "Operador",
    );
    expect(returned.error).toBeUndefined();
    expect(returned.state.purchasePosted[operation.id]).toBe(purchase);
    expect(returned.state.registrations[operation.id]).toEqual(finance.registrations[operation.id]);
    expect(returned.state.journal.find(e => e.id === purchase)?.reversedBy).toBeTruthy();
    const next = {
      ...operation,
      releaseReview: {
        ...operation.releaseReview!,
        payables: operation.releaseReview!.payables!.map(p => ({
          ...p,
          id: "payable-next",
          createdAt: "2026-10-19T12:00:00Z",
        })),
      },
    };
    const acquired = syncReleases(returned.state, [next], { [operation.id]: financial }, "Operador");
    expect(acquired.purchasePosted[operation.id]).not.toBe(purchase);
    expect(acquired.journal).toHaveLength(3);
    expect(acquired.titles).toHaveLength(2);
    expect(acquired.titles[0].status).toBe("Cancelado");
    expect(acquired.titles[1].status).toBe("Em aberto");
  });
  it("recusa destino inválido e reaquisição com identificador de obrigação antigo", () => {
    const operation = releasedOperation(),
      finance = syncReleases(emptyFinance(), [operation], { [operation.id]: financial }, "Operador");
    expect(
      returnOperation(finance, operation, { targetStage: 0, reason: "Motivo", cashMoved: false }, "Operador").error,
    ).toBeTruthy();
    const returned = returnOperation(
      finance,
      operation,
      { targetStage: 3, reason: "Motivo", cashMoved: false },
      "Operador",
    );
    expect(() => syncReleases(returned.state, [operation], { [operation.id]: financial }, "Operador")).toThrow(
      /identificador|ciclo|favorecido/i,
    );
  });
});
