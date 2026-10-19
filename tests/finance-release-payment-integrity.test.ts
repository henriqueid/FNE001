/** Baixas da liberação precisam preservar obrigação, caixa e diário, inclusive parciais e estornos. */
import { describe, expect, it } from "vitest";
import { emptyState, openingEntries, roleLedger, run } from "@/src/domain/finance/ledger";
import { createTitleDraft, settleTitle, reverseDraft } from "@/src/domain/finance/titles";
import { releasePaymentIntegrityError } from "@/src/server/finance/release-integrity";

function fixture() {
  const initial = openingEntries(emptyState("2026-10-18"));
  let titleId = "";
  const made = run(initial, draft => {
    titleId = createTitleDraft(
      draft,
      {
        kind: "Pagar",
        origin: "Liberação de operação",
        description: "Cedente",
        counterparty: "Empresa Cedente",
        counterpartyDocument: "12345678000195",
        company: draft.accounts[0].company,
        competenceDate: "2026-10-18",
        dueDate: "2026-10-18",
        amount: 1000,
        settlementLedger: roleLedger(draft, "assignorsPayable"),
        skipCompetence: true,
        operationId: "operation-1",
        payableId: "payable-1",
      },
      "maker",
    );
    return {};
  });
  return { state: made.state, titleId, accountId: made.state.accounts[0].id };
}
describe("integridade da baixa de liberações", () => {
  it("rejeita status Baixado sem movimento e partidas", () => {
    const { state, titleId } = fixture();
    const forged = {
      ...state,
      titles: state.titles.map(title =>
        title.id === titleId ? { ...title, status: "Baixado" as const, settledAt: "2026-10-18" } : title,
      ),
    };
    expect(releasePaymentIntegrityError(state, forged)).toContain("baixa");
  });
  it("aceita baixa total e parcial produzidas pelo motor e rejeita valor ou favorecido adulterados", () => {
    const { state, titleId, accountId } = fixture();
    for (const amount of [1000, 400]) {
      const settled = settleTitle(
        state,
        titleId,
        { accountId, date: "2026-10-18", method: "PIX", amount, interest: 20, discount: 10 },
        "checker",
      );
      expect(settled.error).toBeUndefined();
      expect(releasePaymentIntegrityError(state, settled.state)).toBeNull();
      const forged = structuredClone(settled.state);
      forged.titles.find(title => title.id === titleId)!.counterpartyDocument = "99999999000199";
      expect(releasePaymentIntegrityError(state, forged)).toBeTruthy();
      const wrong = structuredClone(settled.state);
      wrong.movements.at(-1)!.amount -= 1;
      expect(releasePaymentIntegrityError(state, wrong)).toBeTruthy();
    }
  });
  it("aceita os dois estornos determinísticos e rejeita reabertura sem contrapartida", () => {
    const { state, titleId, accountId } = fixture();
    const settled = settleTitle(state, titleId, { accountId, date: "2026-10-18", method: "PIX" }, "checker").state;
    for (const cashMoved of [false, true]) {
      const reversed = run(settled, draft => {
        reverseDraft(draft, titleId, { reason: "Pagamento indevido", cashMoved }, "checker", "2026-10-19");
        return {};
      });
      expect(reversed.error).toBeUndefined();
      expect(releasePaymentIntegrityError(settled, reversed.state)).toBeNull();
    }
    const forged = structuredClone(settled);
    Object.assign(
      forged.titles.find(title => title.id === titleId)!,
      {
        status: "Em aberto",
        movementId: undefined,
        settledAt: undefined,
        settledAccountId: undefined,
        method: undefined,
      },
    );
    expect(releasePaymentIntegrityError(settled, forged)).toContain("estorno");
  });
  it("não aceita nova obrigação de liberação pelo caminho genérico", () => {
    const { state } = fixture();
    const previous = { ...state, titles: [] };
    expect(releasePaymentIntegrityError(previous, state)).toBeTruthy();
    expect(releasePaymentIntegrityError(previous, state, { allowNewReleaseTitles: true })).toBeNull();
  });
  it("rejeita movimento adicional apontando para obrigação sem baixa correspondente", () => {
    const { state, titleId, accountId } = fixture();
    const legitimate = settleTitle(state, titleId, { accountId, date: "2026-10-18", method: "PIX" }, "checker").state;
    const forged = { ...legitimate, titles: state.titles };
    expect(releasePaymentIntegrityError(state, forged)).toBeTruthy();
  });
  it("somente fluxo explícito de devolução aceita cancelar após estorno verificável", () => {
    const { state, titleId, accountId } = fixture();
    const settled = settleTitle(state, titleId, { accountId, date: "2026-10-18", method: "PIX" }, "checker").state;
    for (const cashMoved of [false, true]) {
      const reversed = run(settled, draft => {
        reverseDraft(draft, titleId, { reason: "Devolução autorizada", cashMoved }, "checker", "2026-10-19");
        return {};
      }).state;
      const canceled = {
        ...reversed,
        titles: reversed.titles.map(title =>
          title.id === titleId ? { ...title, status: "Cancelado" as const } : title,
        ),
      };
      expect(releasePaymentIntegrityError(settled, canceled)).toBeTruthy();
      expect(releasePaymentIntegrityError(settled, canceled, { returningOperationId: "operation-1" })).toBeNull();
    }
  });
});
