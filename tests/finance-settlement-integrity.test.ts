/** Baixas manuais, recorrentes e de recuperação/devolução preservam caixa, empresa e diário. */
import { describe, expect, it } from "vitest";
import { emptyState, openingEntries, run } from "@/src/domain/finance/ledger";
import { createTitleDraft, settleTitle, reverseDraft } from "@/src/domain/finance/titles";
import type { FinanceTitle } from "@/src/domain/finance/model";
import { settlementIntegrityError } from "@/src/server/finance/settlement-integrity";
function fixture(kind: FinanceTitle["kind"] = "Pagar", origin: FinanceTitle["origin"] = "Manual") {
  const state = openingEntries(emptyState("2026-10-18"));
  let id = "";
  const created = run(state, draft => {
    id = createTitleDraft(
      draft,
      {
        kind,
        origin,
        description: "Obrigação manual",
        counterparty: "Pessoa",
        company: draft.accounts[0].company,
        competenceDate: "2026-10-18",
        dueDate: "2026-10-18",
        amount: 1000,
        skipCompetence: true,
      },
      "operador",
    );
    return {};
  }).state;
  return { state: created, id, accountId: state.accounts[0].id };
}
describe("integridade compartilhada da liquidação financeira", () => {
  it("não fabrica recuperação/devolução sem estorno da obrigação original", () => {
    const { state } = fixture("Receber", "Recuperação de pagamento");
    expect(settlementIntegrityError({ ...state, titles: [] }, state)).toBeTruthy();
  });
  it("recusa Baixado sem movimento e partidas", () => {
    const { state, id } = fixture();
    const forged = {
      ...state,
      titles: state.titles.map(title =>
        title.id === id ? { ...title, status: "Baixado" as const, settledAt: "2026-10-18" } : title,
      ),
    };
    expect(settlementIntegrityError(state, forged)).toBeTruthy();
  });
  it.each(["Pagar", "Receber"] as const)("aceita baixa total/parcial e dois estornos de %s", kind => {
    const { state, id, accountId } = fixture(kind);
    for (const amount of [400, 1000]) {
      const paid = settleTitle(
        state,
        id,
        { accountId, date: "2026-10-18", method: "PIX", amount, interest: 20, discount: 10 },
        "operador",
      ).state;
      expect(settlementIntegrityError(state, paid)).toBeNull();
      for (const cashMoved of [false, true]) {
        const reversed = run(paid, draft => {
          reverseDraft(draft, id, { reason: "Conferência bancária", cashMoved }, "operador", "2026-10-19");
          return {};
        }).state;
        expect(settlementIntegrityError(paid, reversed)).toBeNull();
      }
    }
  });
  it("recusa outra empresa no caixa, journal adulterado e reabertura sem estorno", () => {
    const { state, id, accountId } = fixture();
    const paid = settleTitle(state, id, { accountId, date: "2026-10-18", method: "PIX" }, "operador").state;
    const wrongBank = structuredClone(paid);
    wrongBank.movements.at(-1)!.accountId = state.accounts.find(
      account => account.company !== state.accounts[0].company,
    )!.id;
    expect(settlementIntegrityError(state, wrongBank)).toBeTruthy();
    const wrongJournal = structuredClone(paid);
    wrongJournal.journal.at(-1)!.company = "Outra empresa";
    expect(settlementIntegrityError(state, wrongJournal)).toBeTruthy();
    const reopened = { ...paid, titles: state.titles };
    expect(settlementIntegrityError(paid, reopened)).toBeTruthy();
  });
  it.each(["Recorrente", "Recuperação de pagamento", "Devolução de recebimento"] as const)(
    "aceita baixa legítima de origem %s",
    origin => {
      const { state, id, accountId } = fixture(origin === "Recuperação de pagamento" ? "Receber" : "Pagar", origin);
      const paid = settleTitle(state, id, { accountId, date: "2026-10-18", method: "PIX" }, "operador").state;
      expect(settlementIntegrityError(state, paid)).toBeNull();
    },
  );
});
