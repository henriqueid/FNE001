import { describe, expect, it } from "vitest";
import {
  addProspect,
  assignAccountManager,
  decideCommittee,
  dossierReadiness,
  emptyProspectDossier,
  moveProspect,
  saveProspectDossier,
  submitCommittee,
  transferClient,
} from "@/src/domain/commercial/actions";
import { computeCommission, managerOf, repAt, tierRate } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { todayIso } from "@/src/domain/finance/ledger";
import { approvedProspectToParty } from "@/src/domain/registry/commercial-onboarding";

const TODAY = "2026-09-30";

describe("regras comerciais", () => {
  const state = seedCommercial(TODAY);

  it("faixa de comissão pelo atingimento da meta", () => {
    expect(tierRate(state.rules, 50)).toBe(3);
    expect(tierRate(state.rules, 85)).toBe(5);
    expect(tierRate(state.rules, 100)).toBe(7);
    expect(tierRate(state.rules, 130)).toBe(8);
  });
  it("transferência só muda o dono a partir da data", () => {
    const link = state.links[0];
    const other = state.reps.find(r => r.id !== link.repId)!;
    const moved = transferClient(state, link.id, other.id, "teste", "Teste").state;
    expect(repAt(moved, link.document, "2020-01-01")).toBe(link.repId);
    // A transferência vale a partir da data real do sistema (todayIso), não da data fixa do seed.
    expect(repAt(moved, link.document, todayIso())).toBe(other.id);
  });
  it("mantém comercial e gerente da conta como responsabilidades independentes", () => {
    const link = state.links[0];
    const manager = state.reps.find(rep => rep.role.toLowerCase().includes("gerente"))!;
    const assigned = assignAccountManager(state, link.id, manager.id);
    expect(assigned.error).toBeUndefined();
    expect(repAt(assigned.state, link.document, TODAY)).toBe(link.repId);
    expect(managerOf(assigned.state, link.document)).toBe(manager.id);
  });
  it("comissão = base × faixa + bônus − estorno", () => {
    const month = TODAY.slice(0, 7);
    computeCommission(state, state.deals, month).forEach(line => {
      expect(line.total).toBeCloseTo(line.commission + line.bonus - line.clawback, 2);
    });
  });
  it("recompra registrada na carteira estorna a comissão do dono do cliente", () => {
    const month = TODAY.slice(0, 7);
    const link = state.links.find(l => state.deals.some(d => d.document === l.document && d.date.startsWith(month)))!;
    const withEvent = {
      ...state,
      carteiraEvents: [
        {
          kind: "Recompra" as const,
          document: link.document,
          clientName: link.clientName,
          date: TODAY,
          amount: 50_000,
          reference: "teste",
        },
      ],
    };
    const before = computeCommission(state, state.deals, month).find(l => l.repId === link.repId)!;
    const after = computeCommission(withEvent, state.deals, month).find(l => l.repId === link.repId)!;
    expect(after.clawback).toBeGreaterThan(before.clawback);
  });

  it("leva um lead com dossiê completo ao comitê e o converte em cedente ao aprovar", () => {
    const created = addProspect(state, {
      name: "Nova Indústria Ltda",
      document: "11.222.333/0001-81",
      repId: "rep-1",
      potential: 500_000,
      source: "Indicação",
      nextStep: "Montar dossiê",
      dossier: emptyProspectDossier(),
    }).state;
    const prospect = created.prospects.at(-1)!;
    const dossier = {
      ...emptyProspectDossier(),
      document: "11.222.333/0001-81",
      tradeName: "Nova Indústria",
      segment: "Indústria",
      city: "Curitiba",
      state: "PR",
      contactName: "Ana",
      email: "ana@novaindustria.test",
      monthlyRevenue: 1_500_000,
      requestedLimit: 500_000,
      proposedRate: 2.4,
      averageTermDays: 45,
      debtorCount: 18,
      largestDebtorPercent: 20,
      commercialSummary: "Empresa com carteira pulverizada, bom histórico e potencial recorrente.",
      documents: {
        ...emptyProspectDossier().documents,
        companyRegistration: true,
        financialStatements: true,
        receivablesSample: true,
      },
    };
    const documented = saveProspectDossier(created, prospect.id, dossier, "Rafael").state;
    const ready = documented.prospects.find(item => item.id === prospect.id)!;
    expect(dossierReadiness(ready).ready).toBe(true);
    const proposed = moveProspect(documented, prospect.id, "Proposta").state;
    const queued = submitCommittee(
      proposed,
      {
        clientName: prospect.name,
        document: dossier.document,
        repId: prospect.repId,
        request: "Limite inicial",
        requested: dossier.requestedLimit,
        rate: dossier.proposedRate,
        commercialOpinion: dossier.commercialSummary,
        date: TODAY,
      },
      "Rafael",
    ).state;
    const committee = queued.committees.at(-1)!;
    const approved = decideCommittee(
      queued,
      committee.id,
      { status: "Aprovado", approved: 450_000, rate: 2.5 },
      "Henrique",
    ).state;
    const converted = approved.prospects.find(item => item.id === prospect.id)!;
    expect(converted.convertedAt).toBeTruthy();
    expect(approved.links.some(link => link.document === dossier.document && link.approvedLimit === 450_000)).toBe(
      true,
    );
    const party = approvedProspectToParty(converted, approved, "Henrique");
    expect(party?.roles).toContain("cedente");
    expect(party?.roleData.cedente?.creditLimit).toBe(450_000);
  });

  it("mantém a reprovação no histórico do lead", () => {
    const prospect = state.prospects.find(item => item.stage === "Proposta")!;
    const complete = {
      ...emptyProspectDossier(),
      document: "52.927.676/0001-29",
      segment: "Serviços",
      city: "Curitiba",
      state: "PR",
      contactName: "Contato",
      phone: "41999999999",
      monthlyRevenue: 900_000,
      requestedLimit: 300_000,
      proposedRate: 3,
      debtorCount: 10,
      commercialSummary: "Cliente com oportunidade comercial, submetido para análise completa.",
      documents: {
        ...emptyProspectDossier().documents,
        companyRegistration: true,
        financialStatements: true,
        receivablesSample: true,
      },
    };
    const documented = saveProspectDossier(state, prospect.id, complete, "Comercial").state;
    const queued = submitCommittee(
      documented,
      {
        clientName: prospect.name,
        document: complete.document,
        repId: prospect.repId,
        request: "Limite inicial",
        requested: 300_000,
        commercialOpinion: complete.commercialSummary,
        date: TODAY,
      },
      "Comercial",
    ).state;
    const committee = queued.committees.at(-1)!;
    const rejected = decideCommittee(
      queued,
      committee.id,
      { status: "Reprovado", conditions: "Endividamento incompatível com o limite solicitado." },
      "Comitê",
    ).state;
    const archived = rejected.prospects.find(item => item.id === prospect.id)!;
    expect(archived.rejectedAt).toBeTruthy();
    expect(archived.lost).toContain("Endividamento incompatível");
    expect(archived.history?.at(-1)?.action).toBe("Reprovado pelo comitê");
  });
});
