/** Fluxo bancário completo com repositórios reais e double apenas no banco. */
import { describe, expect, it } from "vitest";
import { BankingDatabase } from "./cnab400-server-database";
import { executeBankingCommand, validateRepurchaseBankWriteoff } from "@/src/server/banking/service";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { accountBalance } from "@/src/domain/finance/banking";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { emptyParty } from "@/src/domain/registry/parties";
import type { ServerPrincipal } from "@/src/server/access/repository";
const principal = {
  id: "actor",
  name: "Operador",
  tenantId: "tenant-a",
  companyScopes: ["*"],
  permissions: ["finance:release"],
} as ServerPrincipal;
function fixture(bankCode = "341") {
  const db = new BankingDatabase(),
    finance = openingEntries(emptyState("2026-10-18"));
  const account = finance.accounts[0];
  Object.assign(account, {
    agency: "1234",
    account: bankCode === "341" ? "12345" : "1234567",
    bankCode,
    active: true,
    usage: { payments: true, receipts: true, collection: true },
    collection: {
      agreement: bankCode === "341" ? "" : "123456789",
      wallet: bankCode === "341" ? "109" : "19",
      layout: "CNAB 400",
      nextOurNumber: 2,
      accountDigit: bankCode === "341" ? "6" : "8",
      beneficiaryDocument: "11222333000181",
      beneficiaryName: "Empresa Teste",
      nextRemittanceSequence: 1,
      dailyInterestCents: 0,
    },
  });
  db.finance.set("tenant-a", { payload: finance, aggregate_version: 1 });
  const portfolio = seedPortfolio(initialOperations),
    title = portfolio.titles[0];
  Object.assign(title, {
    id: "title-a",
    company: account.company,
    documentNumber: "DOC-01",
    originalAmount: 1000,
    openAmount: 1000,
    paidAmount: 0,
    discountAmount: 0,
    repurchasedAmount: 0,
    abatementAmount: 0,
    payments: [],
    status: "Em aberto",
    bankStatus: "Sem boleto",
    ourNumber: undefined,
    issueDate: "2026-10-01",
    dueDate: "2027-12-31",
    ownerDocument: "11222333000181",
    debtorDocument: "52998224725",
  });
  portfolio.titles = [title];
  db.portfolio.set("tenant-a", { payload: portfolio, aggregate_version: 1 });
  const party = { ...emptyParty("sacado"), kind: "PF" as const, document: "52998224725", name: "Sacado Teste" };
  Object.assign(party, {
    address: {
      zipCode: "01001000",
      street: "Rua Um",
      number: "123",
      complement: "",
      district: "Centro",
      city: "Sao Paulo",
      state: "SP",
    },
  });
  db.parties.set("52998224725", party);
  return { db, accountId: account.id, titleId: title.id };
}
const remit = (accountId: string, titleId: string, commandId = "bank-remit-0001") => ({
  action: "remittance" as const,
  accountId,
  titleIds: [titleId],
  commandId,
});
function returnFile(bankCode = "341") {
  const row = () => Array<string>(400).fill(" "),
    put = (r: string[], start: number, v: string) => {
      for (let i = 0; i < v.length; i++) r[start + i - 1] = v[i];
    };
  const h = row(),
    d = row(),
    t = row();
  put(h, 1, "02RETORNO01COBRANCA       ");
  put(h, 27, "123400123456");
  put(h, 77, "341");
  put(h, 95, "181026");
  put(h, 109, "00042");
  put(h, 395, "000001");
  put(d, 1, "10211222333000181");
  put(d, 18, "123400123456");
  put(d, 38, "T00000002");
  put(d, 63, "00000002");
  put(d, 83, "109000000020");
  put(d, 108, "I06");
  put(d, 111, "181026");
  put(d, 117, "DOC-01");
  put(d, 127, "00000002");
  put(d, 147, "311227");
  for (const s of [153, 176, 215, 228, 241, 254, 267, 280]) put(d, s, "0000000000000");
  put(d, 153, "0000000100000");
  put(d, 254, "0000000100000");
  put(d, 296, "181026");
  put(d, 378, "00000000");
  put(d, 395, "000002");
  if (bankCode === "237") {
    put(h, 27, "00000000000123456789");
    put(h, 77, "237");
    put(d, 18, "00000190123412345678");
    put(d, 38, "T00000000002");
    put(d, 63, "00000000000000000028");
    put(d, 83, "0000000000000000000000");
    put(d, 105, "000906");
    put(d, 127, "000000000028        ");
    put(d, 189, "0000000000000");
    put(d, 319, "0000000000");
  }
  put(t, 1, `9201${bankCode}`);
  put(t, 395, "000003");
  return [h, d, t].map(r => r.join("")).join("\r\n") + "\r\n" + (bankCode === "237" ? "\x1a" : "");
}
describe("CNAB400 transacional no servidor", () => {
  it("replay recupera bytes exatos sem consumir sequência ou nosso número duas vezes", async () => {
    const { db, accountId, titleId } = fixture();
    const command = remit(accountId, titleId);
    const first = await executeBankingCommand(db, principal, command),
      again = await executeBankingCommand(db, principal, command);
    expect(again).toEqual(first);
    expect(first.content).toContain("REMESSA");
    expect(db.finance.get("tenant-a")!.payload.accounts[0].collection).toMatchObject({
      nextOurNumber: 3,
      nextRemittanceSequence: 2,
    });
    expect(db.bankEvents.filter(e => e.type === "BankRemittance")).toHaveLength(1);
  });
  it("isola tenant e escopo da conta", async () => {
    const { db, accountId, titleId } = fixture();
    await expect(
      executeBankingCommand(db, { ...principal, tenantId: "tenant-b" }, remit(accountId, titleId)),
    ).rejects.toThrow();
    await expect(
      executeBankingCommand(db, { ...principal, companyScopes: ["Outra empresa"] }, remit(accountId, titleId)),
    ).rejects.toThrow();
    expect(db.bankEvents).toHaveLength(0);
  });
  it("importa pagamento e rejeita duplicação em arquivo com outro identificador", async () => {
    const { db, accountId, titleId } = fixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const before = accountBalance(db.finance.get("tenant-a")!.payload, accountId);
    const command = { action: "return" as const, accountId, commandId: "bank-return-0001", content: returnFile() };
    const first = await executeBankingCommand(db, principal, command);
    const alias = await executeBankingCommand(db, principal, {
      ...command,
      commandId: "bank-return-0002",
      content: command.content.slice(0, 108) + "00043" + command.content.slice(113),
    });
    expect(first.processed).toBe(1);
    expect(alias.repeated).toBe(1);
    expect(accountBalance(db.finance.get("tenant-a")!.payload, accountId)).toBe(before + 1000);
    expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({ status: "Pago", openAmount: 0 });
  });
  it("rollback restaura sequência e carteira se persistência falhar", async () => {
    const { db, accountId, titleId } = fixture();
    db.failPortfolio = true;
    await expect(executeBankingCommand(db, principal, remit(accountId, titleId))).rejects.toThrow();
    expect(db.finance.get("tenant-a")!.payload.accounts[0].collection?.nextOurNumber).toBe(2);
    expect(db.bankEvents).toHaveLength(0);
  });
  it("recusa conta divergente e registra bloqueio sem afetar caixa", async () => {
    const { db, accountId, titleId } = fixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const before = accountBalance(db.finance.get("tenant-a")!.payload, accountId);
    await expect(
      executeBankingCommand(db, principal, {
        action: "return",
        accountId,
        commandId: "bank-return-0001",
        content: returnFile().slice(0, 32) + "99999" + returnFile().slice(37),
      }),
    ).rejects.toThrow();
    expect(accountBalance(db.finance.get("tenant-a")!.payload, accountId)).toBe(before);
    expect(db.bankEvents.some(e => e.type === "BankReturnBlock")).toBe(true);
  });
});

it("não descarta tarifa na confirmação de entrada e grava bloqueio", async () => {
  const { db, accountId, titleId } = fixture();
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  let content = returnFile();
  const offset = 402;
  const change = (start: number, value: string) => {
    content = content.slice(0, offset + start - 1) + value + content.slice(offset + start - 1 + value.length);
  };
  change(109, "02");
  change(176, "0000000000123");
  change(254, "0000000000000");
  change(296, "000000");
  await expect(
    executeBankingCommand(db, principal, { action: "return", accountId, commandId: "return-fee-0001", content }),
  ).rejects.toThrow(/tarifa/i);
  expect(db.portfolio.get("tenant-a")!.payload.titles[0].bankStatus).toBe("Pendente de integração");
  expect(db.bankEvents.some(e => e.type === "BankReturnBlock")).toBe(true);
});
it("serializa solicitações concorrentes sem emitir duas remessas do mesmo ativo", async () => {
  const { db, accountId, titleId } = fixture();
  const results = await Promise.allSettled([
    executeBankingCommand(db, principal, remit(accountId, titleId, "remit-race-0001")),
    executeBankingCommand(db, principal, remit(accountId, titleId, "remit-race-0002")),
  ]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(db.bankEvents.filter(e => e.type === "BankRemittance")).toHaveLength(1);
  expect(db.finance.get("tenant-a")!.payload.accounts[0].collection?.nextOurNumber).toBe(3);
});

it("gera e liquida cobrança Bradesco usando conta/convênio reais da configuração", async () => {
  const { db, accountId, titleId } = fixture("237");
  const generated = await executeBankingCommand(db, principal, remit(accountId, titleId));
  expect(generated.content?.slice(110, 117)).toBe("0000001");
  expect(generated.content?.endsWith("\r\n\x1a")).toBe(true);
  const before = accountBalance(db.finance.get("tenant-a")!.payload, accountId);
  const result = await executeBankingCommand(db, principal, {
    action: "return",
    accountId,
    commandId: "bradesco-ret-0001",
    content: returnFile("237"),
  });
  expect(result.processed).toBe(1);
  expect(accountBalance(db.finance.get("tenant-a")!.payload, accountId)).toBe(before + 1000);
  expect(db.portfolio.get("tenant-a")!.payload.titles[0].status).toBe("Pago");
});

it.each(["remittance", "return"] as const)("bloqueia %s enquanto posição da carteira exige revisão", async action => {
  const { db, accountId, titleId } = fixture();
  if (action === "return") await executeBankingCommand(db, principal, remit(accountId, titleId));
  Object.assign(db.portfolio.get("tenant-a")!.payload.titles[0], {
    positionReviewRequired: "Posição importada divergiu da baixa local",
  });
  const input =
    action === "remittance"
      ? remit(accountId, titleId)
      : { action: "return" as const, accountId, commandId: "review-return-0001", content: returnFile() };
  await expect(executeBankingCommand(db, principal, input)).rejects.toThrow(/posição|revisão/i);
  expect(db.bankEvents.filter(e => e.type === "BankReturn")).toHaveLength(0);
});

function bankIssuedFixture() {
  const result = fixture(),
    account = result.db.finance.get("tenant-a")!.payload.accounts[0];
  Object.assign(account.collection!, {
    wallet: "112",
    nextOurNumber: 0,
    dailyInterestCents: undefined,
    monthlyInterestPercent: 8,
    lateFinePercent: 2,
    lateFineDaysAfterDue: 1,
    sendPayerEmail: true,
  });
  result.db.parties.get("52998224725")!.email = "sacado@example.test";
  return result;
}
function bankIssuedReturn(occurrence = "02", ourNumber = "12345678", control = "T0000001000001") {
  let content = returnFile();
  const change = (start: number, value: string) => {
    const at = 402 + start - 1;
    content = content.slice(0, at) + value + content.slice(at + value.length);
  };
  change(38, control.padEnd(25, " "));
  change(63, ourNumber);
  change(83, `112${ourNumber}0`);
  change(109, occurrence);
  change(127, ourNumber);
  if (occurrence !== "06") {
    change(254, "0000000000000");
    change(296, "000000");
  }
  return content;
}
describe("Itaú112 escritural com número atribuído pelo banco", () => {
  it("gera zeros sem consumir número local e inclui juros/multa/email contratados", async () => {
    const { db, accountId, titleId } = bankIssuedFixture();
    const result = await executeBankingCommand(db, principal, remit(accountId, titleId));
    const rows = result.content!.slice(0, -2).split("\r\n"),
      detail = rows.find(row => row[0] === "1")!;
    expect(detail.slice(62, 70)).toBe("00000000");
    expect(detail.slice(37, 62).trim()).toBe("T0000001000001");
    expect(detail.slice(83, 86)).toBe("112");
    expect(detail.slice(160, 173)).toBe("0000000000267");
    expect(
      rows
        .find(row => row[0] === "5")
        ?.slice(1, 121)
        .trim(),
    ).toBe("sacado@example.test");
    expect(rows.some(row => row[0] === "2")).toBe(true);
    expect(db.finance.get("tenant-a")!.payload.accounts[0].collection).toMatchObject({
      nextOurNumber: 0,
      nextRemittanceSequence: 2,
    });
    expect(db.portfolio.get("tenant-a")!.payload.titles[0].ourNumber).toBeUndefined();
  });
  it("aceita02 uma vez, liquida após confirmação e repetição02 não regride liquidado", async () => {
    const { db, accountId, titleId } = bankIssuedFixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const input = {
      action: "return" as const,
      accountId,
      commandId: "bank112-entry-0001",
      content: bankIssuedReturn(),
    };
    await executeBankingCommand(db, principal, input);
    expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({
      ourNumber: "12345678",
      bankStatus: "Registrado",
    });
    await executeBankingCommand(db, principal, {
      ...input,
      commandId: "bank112-paid-0001",
      content: bankIssuedReturn("06"),
    });
    await executeBankingCommand(db, principal, { ...input, commandId: "bank112-entry-0002" });
    const laterEntry = bankIssuedReturn();
    await executeBankingCommand(db, principal, {
      ...input,
      commandId: "bank112-entry-0003",
      content: laterEntry.slice(0, 512) + "191026" + laterEntry.slice(518),
    });
    expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({
      ourNumber: "12345678",
      bankStatus: "Liquidado",
      status: "Pago",
    });
    await expect(
      executeBankingCommand(db, principal, {
        ...input,
        commandId: "bank112-other-0001",
        content: bankIssuedReturn("02", "87654321"),
      }),
    ).rejects.toThrow(/número|atribui/i);
  });
  it.each([
    [153, "0000000099999"],
    [147, "301227"],
  ])("recusa confirmação com snapshot divergente na posição %s", async (position, value) => {
    const { db, accountId, titleId } = bankIssuedFixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const content = bankIssuedReturn(),
      offset = 402 + Number(position) - 1;
    await expect(
      executeBankingCommand(db, principal, {
        action: "return",
        accountId,
        commandId: "bank112-mismatch-0001",
        content: content.slice(0, offset) + value + content.slice(offset + String(value).length),
      }),
    ).rejects.toThrow(/valor|vencimento|remessa/i);
    expect(db.portfolio.get("tenant-a")!.payload.titles[0].ourNumber).toBeUndefined();
  });
  it("nega06 antes da confirmação e aceita rejeição03 sem nosso número", async () => {
    const { db, accountId, titleId } = bankIssuedFixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    await expect(
      executeBankingCommand(db, principal, {
        action: "return",
        accountId,
        commandId: "bank112-paid-0001",
        content: bankIssuedReturn("06"),
      }),
    ).rejects.toThrow(/confirm|número/i);
    await executeBankingCommand(db, principal, {
      action: "return",
      accountId,
      commandId: "bank112-reject-0001",
      content: bankIssuedReturn("03", "00000000"),
    });
    expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({ bankStatus: "Sem boleto" });
    expect(db.portfolio.get("tenant-a")!.payload.titles[0].ourNumber).toBeUndefined();
  });
  it("reserva controles exclusivos para dois títulos com nosso número zerado", async () => {
    const { db, accountId, titleId } = bankIssuedFixture();
    const portfolio = db.portfolio.get("tenant-a")!.payload;
    portfolio.titles.push({ ...structuredClone(portfolio.titles[0]), id: "title-b", documentNumber: "DOC-02" });
    const result = await executeBankingCommand(db, principal, {
      ...remit(accountId, titleId),
      titleIds: ["title-b", titleId],
    });
    const details = result.content!.split("\r\n").filter(row => row[0] === "1");
    expect(details.map(row => row.slice(62, 70))).toEqual(["00000000", "00000000"]);
    expect(details.map(row => row.slice(37, 62).trim())).toEqual(["T0000001000001", "T0000001000002"]);
    expect(db.finance.get("tenant-a")!.payload.accounts[0].collection!.nextOurNumber).toBe(0);
  });
  it("recusa email solicitado sem cadastro e colisão de número na conta", async () => {
    const { db, accountId, titleId } = bankIssuedFixture();
    db.parties.get("52998224725")!.email = "";
    await expect(executeBankingCommand(db, principal, remit(accountId, titleId))).rejects.toThrow(/email|e-mail/i);
    db.parties.get("52998224725")!.email = "sacado@example.test";
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const original = db.portfolio.get("tenant-a")!.payload.titles[0];
    db.portfolio.get("tenant-a")!.payload.titles.push({
      ...structuredClone(original),
      id: "other-title",
      ourNumber: "12345678",
      documentNumber: "OTHER",
    });
    await expect(
      executeBankingCommand(db, principal, {
        action: "return",
        accountId,
        commandId: "bank112-collision-0001",
        content: bankIssuedReturn(),
      }),
    ).rejects.toThrow(/número|outro|colis/i);
  });
});

describe("baixa bancária após recompra", () => {
  it("preserva registro/número, confirma somente retorno09, replay não consome nova faixa", async () => {
    const { db, accountId, titleId } = fixture();
    await executeBankingCommand(db, principal, remit(accountId, titleId));
    const stored = db.portfolio.get("tenant-a")!.payload.titles[0];
    Object.assign(stored, {
      status: "Recomprado",
      openAmount: 0,
      repurchasedAmount: 1000,
      bankStatus: "Registrado",
      bankWriteoff: {
        operationId: "op-new",
        cycleId: "app1",
        applicationId: "app1",
        status: "Pendente",
        requestedAt: "2026-10-25T00:00:00Z",
      },
    });
    const command = remit(accountId, titleId, "writeoff-remit-01");
    const result = await executeBankingCommand(db, principal, command);
    expect(result.content!.split("\r\n")[1].slice(108, 110)).toBe("02");
    expect(await executeBankingCommand(db, principal, command)).toEqual(result);
    const current = db.portfolio.get("tenant-a")!.payload.titles[0];
    expect(current.bankStatus).toBe("Registrado");
    expect(current.bankWriteoff?.status).toBe("Remessa gerada");
    expect(db.finance.get("tenant-a")!.payload.accounts[0].collection!.nextOurNumber).toBe(3);
    const before = accountBalance(db.finance.get("tenant-a")!.payload, accountId);
    const rows = returnFile().split("\r\n");
    rows[1] = rows[1].slice(0, 108) + "09" + rows[1].slice(110, 253) + "0000000000000" + rows[1].slice(266);
    await executeBankingCommand(db, principal, {
      action: "return",
      accountId,
      commandId: "writeoff-return-01",
      content: rows.join("\r\n"),
    });
    expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({
      status: "Recomprado",
      bankStatus: "Baixado",
      bankWriteoff: { status: "Confirmada" },
    });
    expect(accountBalance(db.finance.get("tenant-a")!.payload, accountId)).toBe(before);
  });
});

it.each(["341", "237"])("baixa %s rejeitada preserva registro e permite nova remessa sem renumerar", async bank => {
  const { db, accountId, titleId } = fixture(bank);
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  const title = db.portfolio.get("tenant-a")!.payload.titles[0];
  Object.assign(title, {
    status: "Recomprado",
    openAmount: 0,
    repurchasedAmount: 1000,
    bankStatus: "Registrado",
    bankWriteoff: {
      operationId: "new",
      cycleId: "app",
      applicationId: "app",
      status: "Pendente",
      requestedAt: "2026-10-25T00:00:00Z",
    },
  });
  await executeBankingCommand(db, principal, remit(accountId, titleId, "writeoff-first-01"));
  const rows = returnFile(bank).split("\r\n");
  const code = bank === "341" ? "15" : "27";
  rows[1] = rows[1].slice(0, 108) + code + rows[1].slice(110, 253) + "0000000000000" + rows[1].slice(266);
  await executeBankingCommand(db, principal, {
    action: "return",
    accountId,
    commandId: "writeoff-reject-01",
    content: rows.join("\r\n"),
  });
  expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({
    bankStatus: "Registrado",
    bankWriteoff: { status: "Pendente", rejectionReason: expect.stringContaining(code) },
  });
  const retry = await executeBankingCommand(db, principal, remit(accountId, titleId, "writeoff-retry-01"));
  expect(retry.content!.split("\r\n")[1].slice(108, 110)).toBe("02");
});
it("bloqueia pagamento após recompra com baixa sem duplicar caixa", async () => {
  const { db, accountId, titleId } = fixture();
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  Object.assign(db.portfolio.get("tenant-a")!.payload.titles[0], {
    status: "Recomprado",
    openAmount: 0,
    repurchasedAmount: 1000,
    bankStatus: "Registrado",
    bankWriteoff: {
      operationId: "new",
      cycleId: "app",
      applicationId: "app",
      status: "Pendente",
      requestedAt: "2026-10-25T00:00:00Z",
    },
  });
  const before = accountBalance(db.finance.get("tenant-a")!.payload, accountId);
  await expect(
    executeBankingCommand(db, principal, {
      action: "return",
      accountId,
      commandId: "writeoff-payment-01",
      content: returnFile(),
    }),
  ).rejects.toThrow(/após recompra/);
  expect(accountBalance(db.finance.get("tenant-a")!.payload, accountId)).toBe(before);
});

it("inclui baixa pendente automaticamente na próxima remessa de entrada", async () => {
  const { db, accountId, titleId } = fixture();
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  const portfolio = db.portfolio.get("tenant-a")!.payload;
  const registered = portfolio.titles[0];
  const fresh = {
    ...structuredClone(registered),
    id: "new-entry",
    documentNumber: "DOC-02",
    bankStatus: "Sem boleto" as const,
    ourNumber: undefined,
  };
  Object.assign(registered, {
    status: "Recomprado",
    openAmount: 0,
    repurchasedAmount: 1000,
    bankStatus: "Registrado",
    bankWriteoff: {
      operationId: "new",
      cycleId: "app",
      applicationId: "app",
      status: "Pendente",
      requestedAt: "2026-10-25T00:00:00Z",
    },
  });
  portfolio.titles.push(fresh);
  const result = await executeBankingCommand(db, principal, remit(accountId, fresh.id, "entry-and-writeoff-01"));
  expect(result.processed).toBe(2);
  expect(
    result
      .content!.split("\r\n")
      .slice(1, -2)
      .map(row => row.slice(108, 110))
      .sort(),
  ).toEqual(["01", "02"]);
});

it("baixa Itaú112 preserva número atribuído e retorno vincula remessa original", async () => {
  const { db, accountId, titleId } = bankIssuedFixture();
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  await executeBankingCommand(db, principal, {
    action: "return",
    accountId,
    commandId: "writeoff112-entry",
    content: bankIssuedReturn(),
  });
  Object.assign(db.portfolio.get("tenant-a")!.payload.titles[0], {
    status: "Recomprado",
    openAmount: 0,
    repurchasedAmount: 1000,
    bankWriteoff: {
      operationId: "new",
      cycleId: "app",
      applicationId: "app",
      status: "Pendente",
      requestedAt: "2026-10-25T00:00:00Z",
    },
  });
  const result = await executeBankingCommand(db, principal, remit(accountId, titleId, "writeoff112-remit"));
  const detail = result.content!.split("\r\n")[1];
  expect(detail.slice(62, 70)).toBe("12345678");
  expect(detail.slice(108, 110)).toBe("02");
  expect(detail.slice(37, 62).trim()).toBe("");
  await executeBankingCommand(db, principal, {
    action: "return",
    accountId,
    commandId: "writeoff112-confirm",
    content: bankIssuedReturn("09"),
  });
  expect(db.portfolio.get("tenant-a")!.payload.titles[0]).toMatchObject({
    bankStatus: "Baixado",
    ourNumber: "12345678",
    bankWriteoff: { status: "Confirmada" },
  });
});

it("recompra SIM exige instrução bancária executável antes de baixar internamente", async () => {
  const { db, accountId, titleId } = fixture();
  const finance = db.finance.get("tenant-a")!.payload;
  const title = db.portfolio.get("tenant-a")!.payload.titles[0];
  Object.assign(title, {
    bankStatus: "Registrado",
    bank: "341",
    agency: "1234",
    account: "12345",
    wallet: "109",
    ourNumber: "00000002",
  });
  expect(await validateRepurchaseBankWriteoff(db, "tenant-a", finance, title)).toMatch(/remessa.*original/i);
  Object.assign(title, { bankStatus: "Sem boleto", ourNumber: undefined });
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  const registered = db.portfolio.get("tenant-a")!.payload.titles[0];
  registered.bankStatus = "Registrado";
  expect(
    await validateRepurchaseBankWriteoff(db, "tenant-a", db.finance.get("tenant-a")!.payload, registered),
  ).toBeNull();
  db.finance.get("tenant-a")!.payload.accounts[0].active = false;
  expect(
    await validateRepurchaseBankWriteoff(db, "tenant-a", db.finance.get("tenant-a")!.payload, registered),
  ).toBeTruthy();
});

it.each(["liquidado", "conta divergente"])("não gera baixa com %s", async reason => {
  const { db, accountId, titleId } = fixture();
  await executeBankingCommand(db, principal, remit(accountId, titleId));
  const title = db.portfolio.get("tenant-a")!.payload.titles[0];
  Object.assign(title, {
    status: "Recomprado",
    openAmount: 0,
    repurchasedAmount: 1000,
    bankStatus: reason === "liquidado" ? "Liquidado" : "Registrado",
    account: reason === "conta divergente" ? "99999" : title.account,
    bankWriteoff: {
      operationId: "new",
      cycleId: "app",
      applicationId: "app",
      status: "Pendente",
      requestedAt: "2026-10-25T00:00:00Z",
    },
  });
  await expect(
    executeBankingCommand(db, principal, remit(accountId, titleId, "writeoff-invalid-01")),
  ).rejects.toThrow();
  expect(db.bankEvents.filter(event => event.type === "BankRemittance")).toHaveLength(1);
});
