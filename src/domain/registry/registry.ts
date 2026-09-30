// Cadastro único do cliente e vínculos entre módulos.
//
//   Cadastro (cedente + crédito)  ──┐
//   Comercial (vínculo, comitê)   ──┼──►  ClientRecord  ──► Operação (comercial gravado na criação)
//   Carteira (títulos, recompras) ──┘                   ──► Comercial (negócios, carteira, comissão)
//                                                       ──► Tesouraria (comissão a pagar e baixa)
//
// Regras:
// - O CNPJ é a chave. O limite aprovado vem do comitê (vínculo comercial) e é o que o cadastro,
//   a operação e a Visão geral enxergam.
// - O comercial responsável é o do vínculo na data (transferência só muda o que vem depois).
// - Recompras feitas nas operações viram eventos da carteira e estornam a comissão do dono do cliente.

import { digits } from "@/src/domain/commercial/calendar";
import { repAt } from "@/src/domain/commercial/rules";
import {
  type CarteiraEvent,
  type ClientLink,
  type CommercialState,
  type SalesRep,
} from "@/src/domain/commercial/types";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { cedentPortfolioTitles } from "@/src/domain/core/demo/portfolio";
import { type Cedent, type Operation } from "@/src/domain/core/types";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import type { PortfolioTitle } from "@/src/domain/home/metrics";

export type ClientStatus = "Ativo" | "Em onboarding" | "Inativo" | "Sem comercial";

export type ClientRecord = {
  document: string;
  name: string;
  cedent: Cedent;
  link?: ClientLink;
  rep?: SalesRep;
  status: ClientStatus;
  limitSource: "Comitê" | "Cadastro";
};

/** Cedentes com o limite aprovado pelo comitê aplicado (fonte única para operação e painéis). */
export function effectiveCedents(commercial: CommercialState, base: Cedent[] = initialCedents): Cedent[] {
  return base.map(cedent => {
    const link = commercial.links.find(l => digits(l.document) === digits(cedent.document));
    if (!link || link.approvedLimit === cedent.creditLimit) return cedent;
    return { ...cedent, creditLimit: link.approvedLimit };
  });
}

export function buildRegistry(commercial: CommercialState, cedents: Cedent[]): ClientRecord[] {
  const records: ClientRecord[] = cedents.map(cedent => {
    const link = commercial.links.find(l => digits(l.document) === digits(cedent.document));
    const rep = link ? commercial.reps.find(r => r.id === link.repId) : undefined;
    return {
      document: cedent.document,
      name: cedent.name,
      cedent,
      link,
      rep,
      status: link ? link.status : "Sem comercial",
      limitSource: link ? "Comitê" : "Cadastro",
    };
  });
  // Contas novas convertidas no funil entram no cadastro como cedente em onboarding (sem histórico de crédito).
  commercial.links
    .filter(link => !cedents.some(c => digits(c.document) === digits(link.document)))
    .forEach(link => {
      records.push({
        document: link.document,
        name: link.clientName,
        link,
        rep: commercial.reps.find(r => r.id === link.repId),
        status: link.status,
        limitSource: "Comitê",
        cedent: {
          id: `ced-${digits(link.document)}`,
          document: link.document,
          name: link.clientName,
          score: 0,
          creditLimit: link.approvedLimit,
          usedLimit: 0,
          portfolioReceivable: 0,
          portfolioOverdue: 0,
          settlements: 0,
          lateSettlements: 0,
          averageDelayDays: 0,
          repurchases: 0,
          incidents: 0,
          publicStatus: "Cadastro em onboarding",
          scoreReasons: ["Conta nova: score ainda não calculado"],
        },
      });
    });
  return records.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Recompras efetivadas nas operações liberadas: evento da carteira do cedente. */
export function repurchaseEvents(operations: Operation[]): CarteiraEvent[] {
  return operations
    .filter(op => op.status === "Liberada ao financeiro")
    .flatMap(op => {
      const ids = op.pricingReview?.repurchaseTitleIds ?? [];
      if (!ids.length) return [];
      const titles = cedentPortfolioTitles.filter(t => ids.includes(t.id));
      const amount = titles.reduce((sum, t) => sum + t.faceAmount, 0);
      const released = op.releaseReview?.releasedAt?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const date = released ? `${released[3]}-${released[2]}-${released[1]}` : new Date().toISOString().slice(0, 10);
      return amount > 0
        ? [
            {
              kind: "Recompra" as const,
              document: op.document,
              clientName: op.cedent,
              date,
              amount,
              reference: `Aditivo ${op.aditivoNumber} · ${titles.length} título(s)`,
              operationId: op.id,
            },
          ]
        : [];
    });
}

export type RepPortfolio = {
  repId: string;
  clients: number;
  open: number;
  overdue: number;
  overdue30: number;
  titles: number;
};

/** Carteira em aberto por comercial (títulos do cedente atribuídos ao dono atual do cliente). */
export function portfolioByRep(titles: PortfolioTitle[], commercial: CommercialState, today: string): RepPortfolio[] {
  const map = new Map<string, RepPortfolio>();
  const clients = new Map<string, Set<string>>();
  titles.forEach(title => {
    const repId = repAt(commercial, title.ownerDocument, today);
    if (!repId) return;
    const row = map.get(repId) ?? { repId, clients: 0, open: 0, overdue: 0, overdue30: 0, titles: 0 };
    const late = Math.round(
      (new Date(`${today}T12:00:00`).getTime() - new Date(`${title.dueDate}T12:00:00`).getTime()) / 86_400_000,
    );
    row.open += title.amount;
    row.titles += 1;
    if (late > 0) row.overdue += title.amount;
    if (late > 30) row.overdue30 += title.amount;
    map.set(repId, row);
    const set = clients.get(repId) ?? new Set<string>();
    set.add(digits(title.ownerDocument));
    clients.set(repId, set);
  });
  return [...map.values()].map(row => ({ ...row, clients: clients.get(row.repId)?.size ?? 0 }));
}

export type CommissionPayment = {
  id: string;
  repName: string;
  amount: number;
  dueDate: string;
  status: FinanceTitle["status"];
  settledAt?: string;
};

/** Situação na tesouraria dos lançamentos de comissão enviados ao financeiro. */
export function commissionPayments(finance: FinanceState, ids: string[] = []): CommissionPayment[] {
  return ids.flatMap(id => {
    const title = finance.titles.find(t => t.id === id);
    return title
      ? [
          {
            id,
            repName: title.counterparty,
            amount: title.amount,
            dueDate: title.dueDate,
            status: title.status,
            settledAt: title.settledAt,
          },
        ]
      : [];
  });
}
