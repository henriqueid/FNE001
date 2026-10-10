import { repAt } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import {
  emptyParty,
  formatDocument,
  isValidCnpj,
  isValidCpf,
  mergeParties,
  seedParties,
  validateParty,
} from "@/src/domain/registry/parties";
import { partyChanges, saveParty } from "@/src/domain/registry/party-save";
import { describe, expect, it } from "vitest";

describe("documentos", () => {
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });
  it("formata enquanto o usuário digita", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("todos os documentos de demonstração são válidos", () => {
    initialCedents.forEach(c => expect(isValidCnpj(c.document), c.name).toBe(true));
    initialDebtors.forEach(d => expect(isValidCnpj(d.document), d.name).toBe(true));
    seedParties().forEach(p =>
      expect(p.kind === "PJ" ? isValidCnpj(p.document) : isValidCpf(p.document), p.name).toBe(true),
    );
  });
});

describe("validação do cadastro", () => {
  it("bloqueia documento duplicado e exige papel", () => {
    const a = { ...emptyParty("fornecedor"), id: "a", document: "11.222.333/0001-81", name: "A" };
    const b = { ...emptyParty(), id: "b", document: "11.222.333/0001-81", name: "B" };
    const issues = validateParty(b, [a, b])
      .filter(i => i.blocking)
      .map(i => i.field);
    expect(issues).toContain("document");
    expect(issues).toContain("roles");
  });
  it("debenturista precisa de série, quantidade, PU e vencimento", () => {
    const p = { ...emptyParty("debenturista"), document: "529.982.247-25", kind: "PF" as const, name: "Investidor" };
    const fields = validateParty(p, [p])
      .filter(i => i.blocking)
      .map(i => i.field);
    expect(fields).toEqual(
      expect.arrayContaining(["debenturista.series", "debenturista.quantity", "debenturista.maturity"]),
    );
  });
});

describe("gravação e propagação", () => {
  const commercial = seedCommercial("2026-09-30");
  const base = { saved: [], debtors: initialDebtors, commercial, today: "2026-09-30", by: "Teste" };
  const all = mergeParties([], {
    cedents: initialCedents,
    debtors: initialDebtors,
    reps: commercial.reps,
    repOfCedent: d => repAt(commercial, d, "2026-09-30"),
  });

  it("não duplica pessoas que já existem nos módulos", () => {
    const docs = all.map(p => p.document.replace(/\D/g, ""));
    expect(new Set(docs).size).toBe(docs.length);
  });
  it("representante novo vira comercial", () => {
    const party = {
      ...emptyParty("representante"),
      kind: "PF" as const,
      document: "529.982.247-25",
      name: "Nova Representante",
    };
    const result = saveParty({ ...base, party, all: [...all, party] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.commercial.reps.some(r => r.name === "Nova Representante")).toBe(true);
  });
  it("cedente novo com comercial cria o vínculo; sacado entra na lista de sacados", () => {
    const repId = commercial.reps[0].id;
    const party = {
      ...emptyParty("cedente"),
      document: "11.222.333/0001-81",
      name: "Nova Indústria",
      roles: ["cedente", "sacado"] as ("cedente" | "sacado")[],
      roleData: {
        cedente: { creditLimit: 100000, monthlyRate: 2, repId, contractUntil: "", guarantee: "Com regresso" as const },
        sacado: { creditLimit: 0, confirmationContact: "" },
      },
    };
    const result = saveParty({ ...base, party, all: [...all, party] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repAt(result.commercial, party.document, "2026-09-30")).toBe(repId);
    expect(result.commercial.links.find(l => l.document === party.document)?.approvedLimit).toBe(100000);
    expect(result.debtors.some(d => d.document === party.document)).toBe(true);
  });
  it("recusa gravar com erro bloqueante", () => {
    const party = { ...emptyParty("fornecedor"), document: "123", name: "X" };
    const result = saveParty({ ...base, party, all: [...all, party] });
    expect(result.ok).toBe(false);
  });
  it("grava uma linha imutável por campo alterado com autor, motivo e origem", () => {
    const original = {
      ...emptyParty("fornecedor"),
      id: "auditado",
      document: "11.222.333/0001-81",
      name: "Fornecedor Original",
      email: "antes@exemplo.com",
    };
    const party = { ...original, name: "Fornecedor Atualizado", email: "depois@exemplo.com" };
    const result = saveParty({
      ...base,
      saved: [original],
      all: [party],
      party,
      reason: "Correção solicitada pelo fornecedor",
      source: "Cadastro",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entries = result.saved[0].history;
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          from: "Fornecedor Original",
          to: "Fornecedor Atualizado",
          by: "Teste",
          at: "2026-09-30",
          reason: "Correção solicitada pelo fornecedor",
          origin: "Cadastro",
        }),
        expect.objectContaining({ field: "email", from: "antes@exemplo.com", to: "depois@exemplo.com" }),
      ]),
    );
  });
  it("preserva histórico antigo e exige motivo em edições", () => {
    const original = {
      ...emptyParty("fornecedor"),
      id: "legado",
      document: "11.222.333/0001-81",
      name: "Fornecedor",
      history: [{ at: "2026-01-01", by: "Sistema", action: "Cadastro importado" }],
    };
    const party = { ...original, phone: "11999999999" };
    const withoutReason = saveParty({ ...base, saved: [original], all: [party], party });
    expect(withoutReason).toEqual({ ok: false, error: "Informe o motivo da alteração para manter a auditoria." });
    const withReason = saveParty({ ...base, saved: [original], all: [party], party, reason: "Contato atualizado" });
    expect(withReason.ok).toBe(true);
    if (withReason.ok) {
      expect(withReason.saved[0].history[0]).toEqual(original.history[0]);
      expect(withReason.saved[0].history[1]).toEqual(expect.objectContaining({ field: "phone" }));
    }
  });
  it("detecta alterações em campos aninhados e valores removidos", () => {
    const before = {
      ...emptyParty("cedente"),
      address: { ...emptyParty().address, city: "Curitiba", state: "PR" },
      notes: "Observação anterior",
    };
    const after = {
      ...before,
      address: { ...before.address, city: "São Paulo" },
      notes: "",
      roleData: { ...before.roleData, cedente: { ...before.roleData.cedente!, creditLimit: 250000 } },
    };
    expect(partyChanges(before, after)).toEqual(
      expect.arrayContaining([
        { field: "address.city", from: "Curitiba", to: "São Paulo" },
        { field: "notes", from: "Observação anterior", to: "—" },
        { field: "roleData.cedente.creditLimit", from: "0", to: "250000" },
      ]),
    );
  });
});
