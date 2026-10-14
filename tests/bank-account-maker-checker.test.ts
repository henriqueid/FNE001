import { describe, expect, it } from "vitest";
import { emptyParty, type PartyBankAccount } from "@/src/domain/registry/parties";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import {
  bankAccountProposalError,
  decideBankAccountChange,
  requestBankAccountChange,
} from "@/src/server/registry/bank-account-changes";

const currentAccount: PartyBankAccount = {
  id: "bank-1",
  bank: "001 · Banco do Brasil",
  agency: "1234",
  account: "99881-0",
  pixKey: "11.222.333/0001-81",
  holderDocument: "11.222.333/0001-81",
  main: true,
};
const proposedAccount = { ...currentAccount, id: "bank-2", account: "77881-0" };

class Statement implements DecisionStatement {
  values: unknown[] = [];
  constructor(
    readonly query: string,
    private readonly database: FakeDatabase,
  ) {}
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (this.database.first(this.query) as T | null) ?? null;
  }
  async all<T>() {
    return { results: (this.database.all(this.query) as T[]) ?? [] };
  }
  async run() {
    this.database.runs.push({ query: this.query, values: this.values });
    return { success: true };
  }
}

class FakeDatabase implements DecisionDatabase {
  runs: { query: string; values: unknown[] }[] = [];
  party = { ...emptyParty("fornecedor"), id: "party-1", name: "Fornecedor", bankAccounts: [currentAccount] };
  request = {
    party_id: "party-1",
    previous_accounts: [currentAccount],
    proposed_accounts: [proposedAccount],
    requested_by: "maker",
    status: "PENDING" as const,
    payload: this.party,
  };
  prepare(query: string) {
    return new Statement(query, this);
  }
  first(query: string) {
    if (query.includes("select c.*, p.payload")) return this.request;
    if (query.includes("select payload from private.registry_parties")) return { payload: this.party };
    if (query.includes("select status from private.registry_parties")) return { status: "Ativo" };
    return null;
  }
  all(_query: string) {
    return [];
  }
  async batch(statements: DecisionStatement[]) {
    for (const statement of statements) await statement.run();
    return [];
  }
  async exec(_query: string) {}
  async transaction<T>(work: (database: DecisionDatabase) => Promise<T>): Promise<T> {
    return work(this);
  }
}

describe("maker-checker de contas bancárias cadastrais", () => {
  it("valida conta principal, titular, destino e motivo", () => {
    expect(bankAccountProposalError([currentAccount], "Alteração confirmada pelo fornecedor")).toBeNull();
    expect(bankAccountProposalError([{ ...currentAccount, main: false }], "Alteração confirmada")).toContain(
      "exatamente uma",
    );
    expect(bankAccountProposalError([{ ...currentAccount, agency: "" }], "Alteração confirmada")).toContain(
      "obrigatórios",
    );
    expect(bankAccountProposalError([currentAccount], "curto")).toContain("10 caracteres");
  });

  it("registra a proposta sem alterar imediatamente o cadastro", async () => {
    const db = new FakeDatabase();
    const changeId = await requestBankAccountChange(
      db,
      "tenant-1",
      "maker",
      "party-1",
      [proposedAccount],
      "Conta nova confirmada por documento",
    );
    expect(changeId).toBeTruthy();
    expect(db.party.bankAccounts).toEqual([currentAccount]);
    expect(db.runs.some(item => item.query.includes("insert into private.registry_bank_account_changes"))).toBe(true);
  });

  it("impede o solicitante de aprovar a própria alteração", async () => {
    const db = new FakeDatabase();
    await expect(
      decideBankAccountChange(db, "tenant-1", { id: "maker", name: "Preparador" }, "change-1", "APPROVED", "Conferido"),
    ).rejects.toThrow("própria alteração");
  });

  it("recusa aprovação se a conta atual mudou durante a espera", async () => {
    const db = new FakeDatabase();
    db.request = { ...db.request, payload: { ...db.party, bankAccounts: [{ ...currentAccount, account: "outra" }] } };
    await expect(
      decideBankAccountChange(
        db,
        "tenant-1",
        { id: "checker", name: "Aprovador" },
        "change-1",
        "APPROVED",
        "Conferido",
      ),
    ).rejects.toThrow("mudou depois");
  });

  it("aplica a conta somente com segundo usuário e registra decisão terminal", async () => {
    const db = new FakeDatabase();
    await expect(
      decideBankAccountChange(
        db,
        "tenant-1",
        { id: "checker", name: "Aprovador" },
        "change-1",
        "APPROVED",
        "Documentos conferidos",
        "2026-10-14T12:00:00.000Z",
      ),
    ).resolves.toEqual({ decision: "APPROVED", partyId: "party-1" });
    expect(
      db.runs.some(
        item => item.query.includes("update private.registry_bank_account_changes") && item.values[0] === "APPROVED",
      ),
    ).toBe(true);
    expect(db.runs.some(item => item.query.includes("insert into private.registry_parties"))).toBe(true);
  });
});
