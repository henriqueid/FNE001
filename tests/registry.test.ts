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
import { saveParty } from "@/src/domain/registry/party-save";
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
});
