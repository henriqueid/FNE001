import { describe, expect, it } from "vitest";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { genericFinanceCommandError } from "@/src/server/finance/command-boundaries";
describe("limites de comandos financeiros genéricos", () => {
  it("não permite apagar a compra nem simular confirmação bancária", () => {
    const before = openingEntries(emptyState("2026-10-18"));
    before.purchasePosted["op-a"] = before.journal[0].id;
    const next = structuredClone(before);
    delete next.purchasePosted["op-a"];
    expect(genericFinanceCommandError(before, next, ["settings:manage", "finance:release"])).toContain(
      "comandos próprios",
    );
    next.purchasePosted = before.purchasePosted;
    next.registrations["op-a"] = {
      sentAt: "2026-10-18",
      confirmedAt: "2026-10-18",
      titles: 1,
      account: before.accounts[0].id,
    };
    expect(genericFinanceCommandError(before, next, ["finance:release"])).toContain("comandos próprios");
  });
  it("exige configuração para alterar contas e não deixa reiniciar numeração", () => {
    const before = openingEntries(emptyState("2026-10-18"));
    before.accounts[0].collection = {
      agreement: "123",
      wallet: "109",
      layout: "CNAB 400",
      nextOurNumber: 10,
      nextRemittanceSequence: 5,
    };
    const next = structuredClone(before);
    next.accounts[0].nickname = "Outro";
    expect(genericFinanceCommandError(before, next, ["finance:release"])).toContain("configurações");
    next.accounts[0].collection!.nextOurNumber = 1;
    expect(genericFinanceCommandError(before, next, ["settings:manage"])).toContain("retroceder");
    next.accounts[0].collection!.nextOurNumber = 11;
    expect(genericFinanceCommandError(before, next, ["settings:manage"])).toBeNull();
  });
  it("nega criação de título vinculado por snapshot mesmo para administrador", () => {
    const before = openingEntries(emptyState("2026-10-18"));
    const next = structuredClone(before);
    next.titles.push({ id: "forged", portfolioTitleId: "asset-a" } as (typeof next.titles)[number]);
    expect(genericFinanceCommandError(before, next, ["settings:manage", "finance:release"])).toContain("integrado");
    expect(genericFinanceCommandError(before, before, ["finance:release"])).toBeNull();
  });
});
