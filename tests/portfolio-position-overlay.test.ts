import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { overlayPortfolioPosition } from "@/src/domain/portfolio/positions";
describe("reconciliação de posição importada", () => {
  function fixture() {
    const source = structuredClone(seedPortfolio(initialOperations).titles[0]);
    Object.assign(source, {
      source: "Carteira anterior",
      openAmount: 1000,
      paidAmount: 0,
      discountAmount: 0,
      sourcePosition: { id: "batch-a", date: "2026-10-18", openAmount: 1000, paidAmount: 0, discountAmount: 0 },
    });
    const stored = structuredClone(source);
    stored.openAmount = 600;
    stored.paidAmount = 400;
    stored.payments = [
      {
        id: "local",
        financeTitleId: "CR-local",
        amount: 400,
        date: "2026-10-18",
        bank: "Banco",
        createdAt: "2026-10-18T12:00:00Z",
        createdBy: "Ator",
      },
    ];
    return { source, stored };
  }
  it("preserva baixa local quando a origem mantém o mesmo saldo-base", () => {
    const { source, stored } = fixture();
    expect(overlayPortfolioPosition(source, stored)).toMatchObject({
      openAmount: 600,
      positionReviewRequired: undefined,
    });
  });
  it("absorve posição que já contempla exatamente o saldo local sem baixar outra vez", () => {
    const { source, stored } = fixture();
    source.sourcePosition = { id: "batch-b", date: "2026-10-19", openAmount: 600, paidAmount: 400, discountAmount: 0 };
    source.openAmount = 600;
    source.paidAmount = 400;
    const result = overlayPortfolioPosition(source, stored);
    expect(result.openAmount).toBe(600);
    expect(result.sourcePosition?.id).toBe("batch-b");
    expect(result.positionReviewRequired).toBeUndefined();
  });
  it("sinaliza divergência sem apagar caixa ou presumir compensação", () => {
    const { source, stored } = fixture();
    source.sourcePosition = { id: "batch-c", date: "2026-10-19", openAmount: 800, paidAmount: 200, discountAmount: 0 };
    expect(overlayPortfolioPosition(source, stored)).toMatchObject({
      openAmount: 600,
      sourcePosition: stored.sourcePosition,
      positionReviewRequired: expect.any(String),
    });
  });
});
