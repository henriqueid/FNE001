/** Regressões de importação OFX e seleção segura de conciliação. */
import { describe, expect, it } from "vitest";
import { seedAccounts } from "@/src/domain/finance/model";
import { emptyFinance } from "@/src/domain/finance/setup";
import {
  autoReconcile,
  importStatement,
  launchDifference,
  parseOfx,
  reconcileManual,
} from "@/src/domain/finance/reconciliation";

const line = { fitid: "F1", date: "2026-10-18", amount: 100, memo: "Crédito" };
function fixture() {
  const s = emptyFinance();
  s.accounts = seedAccounts("2026-01-01");
  const accountId = s.accounts[0].id;
  s.statement = [
    { ...line, id: "E1", accountId, status: "Pendente", file: "x", importedAt: "hoje", importedBy: "Teste" },
  ];
  s.movements = [
    {
      id: "M1",
      accountId,
      date: line.date,
      amount: 100,
      description: "Crédito",
      kind: "Entrada",
      reconciled: false,
      history: [],
    },
  ];
  return s;
}
const ofx = (body: string) => `<OFX><BANKID>341<ACCTID>12345<STMTTRN>${body}</STMTTRN></OFX>`;
describe("conciliação segura", () => {
  it("não escolhe entre movimentos equivalentes", () => {
    const s = fixture();
    s.movements.push({ ...s.movements[0], id: "M2" });
    expect(autoReconcile(s, s.accounts[0].id, "Teste").state.statement[0].status).toBe("Pendente");
  });
  it("não escolhe entre linhas equivalentes", () => {
    const s = fixture();
    s.statement.push({ ...s.statement[0], id: "E2", fitid: "F2" });
    expect(autoReconcile(s, s.accounts[0].id, "Teste").state.movements[0].reconciled).toBe(false);
  });
  it.each([NaN, Infinity, 0])("rejeita valor inválido %s sem alterar estado", amount => {
    const s = fixture();
    const r = importStatement(s, s.accounts[0].id, [{ ...line, fitid: "NOVO", amount }], "x", "Teste");
    expect(r.error).toBeTruthy();
    expect(r.state).toBe(s);
  });
  it("rejeita data impossível", () => {
    const s = fixture();
    expect(
      importStatement(s, s.accounts[0].id, [{ ...line, fitid: "NOVO", date: "2026-02-30" }], "x", "Teste").error,
    ).toBeTruthy();
  });
  it("rejeita OFX malformado em vez de descartar linha", () => {
    expect(() => parseOfx(ofx("<DTPOSTED>20260230<TRNAMT>abc"))).toThrow();
  });
  it("identifica sem FITID pelo conteúdo e não posição", () => {
    const a = "<DTPOSTED>20261018<TRNAMT>100<MEMO>A";
    const b = "<DTPOSTED>20261017<TRNAMT>50<MEMO>B";
    const original = parseOfx(ofx(a)).lines[0];
    const shifted = parseOfx(ofx(b).replace("</OFX>", `<STMTTRN>${a}</STMTTRN></OFX>`)).lines[1];
    expect(original.fitid).toBe(shifted.fitid);
  });
  it.each([
    reconcileManual,
    (s: ReturnType<typeof fixture>, l: string[], m: string[], by: string) =>
      launchDifference(s, l, m, { categoryId: "", description: "" }, by),
  ])("rejeita referência inexistente", action => {
    const s = fixture();
    expect(action(s, ["E1", "inexistente"], ["M1"], "Teste").error).toMatch(/encontrad/i);
  });
  it("rejeita diferença com itens já conciliados", () => {
    const s = fixture();
    s.statement[0].status = "Conciliado";
    s.movements[0].amount = 90;
    expect(launchDifference(s, ["E1"], ["M1"], { categoryId: "", description: "" }, "Teste").error).toMatch(
      /conciliad/i,
    );
  });
  it("preserva conciliação única", () => {
    const s = fixture();
    expect(autoReconcile(s, s.accounts[0].id, "Teste").state.movements[0].reconciled).toBe(true);
  });
});

it("rejeita FITID repetido com conteúdo divergente", () => {
  const s = fixture();
  expect(importStatement(s, s.accounts[0].id, [{ ...line, amount: 200 }], "x", "Teste").error).toMatch(/divergente/);
});
it("rejeita conta OFX divergente", () => {
  const s = fixture();
  expect(importStatement(s, s.accounts[0].id, [line], "x", "Teste", { accountId: "OUTRA" }).error).toMatch(
    /corresponde/,
  );
});
it("rejeita diferença entre contas", () => {
  const s = fixture();
  s.movements[0].accountId = s.accounts[1].id;
  expect(launchDifference(s, ["E1"], ["M1"], { categoryId: "", description: "" }, "Teste").error).toMatch(
    /mesma conta/,
  );
});
it("rejeita diferença sem seleção", () => {
  const s = fixture();
  expect(launchDifference(s, [], [], { categoryId: "", description: "" }, "Teste").error).toMatch(/Selecione/);
});
it("preserva duas ocorrências idênticas sem FITID e deduplica reimportação", () => {
  const body = "<DTPOSTED>20261018<TRNAMT>100<MEMO>A";
  const parsed = parseOfx(ofx(body).replace("</OFX>", `<STMTTRN>${body}</STMTTRN></OFX>`));
  const s = fixture();
  s.statement = [];
  const first = importStatement(s, s.accounts[0].id, parsed.lines, "x", "Teste");
  expect(first.error).toBeUndefined();
  expect(first.state.statement).toHaveLength(2);
  expect(importStatement(first.state, s.accounts[0].id, parsed.lines, "x", "Teste").state.statement).toHaveLength(2);
});
it("rejeita conciliação em período fechado", () => {
  const s = fixture();
  s.periodClosures = [
    {
      id: "FC1",
      company: s.accounts[0].company,
      throughDate: line.date,
      closedAt: "hoje",
      closedBy: "Teste",
      summary: { bankAccounts: 1, movements: 1, journalEntries: 0, statementLines: 1 },
    },
  ];
  expect(reconcileManual(s, ["E1"], ["M1"], "Teste").error).toMatch(/fechado/);
  expect(autoReconcile(s, s.accounts[0].id, "Teste").error).toMatch(/fechado/);
});
it("rejeita OFX com múltiplas contas", () => {
  expect(() => parseOfx(ofx("<DTPOSTED>20261018<TRNAMT>100").replace("</OFX>", "<ACCTID>OUTRA</OFX>"))).toThrow(
    /conta/,
  );
});
it("mensagem da diferença usa moeda e separador brasileiros", () => {
  const s = fixture();
  s.movements[0].amount = 99;
  const result = launchDifference(
    s,
    ["E1"],
    ["M1"],
    { categoryId: s.categories.find(category => category.kind === "Receita")!.id, description: "CHURUME diferença" },
    "CHURUME",
  );
  expect(result.error).toBeUndefined();
  expect(result.message?.replace(/\u00a0/g, " ")).toMatch(/Diferença de R\$ 1,00 lançada/);
});
