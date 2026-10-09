/**
 * Gravação de um cadastro e propagação para os módulos que dependem dele.
 * Função pura: recebe o estado atual e devolve o novo estado de cada área, para que
 * o app aplique tudo de uma vez (e para que a regra seja testável sem React).
 */
import { linkClient, saveRep, transferClient } from "@/src/domain/commercial/actions";
import { repAt } from "@/src/domain/commercial/rules";
import type { CommercialState } from "@/src/domain/commercial/types";
import type { Debtor } from "@/src/domain/core/types";
import { onlyDigits, partyToDebtor, partyToSalesRep, validateParty, type Party } from "./parties";

export type PartySaveInput = {
  party: Party;
  saved: Party[];
  all: Party[];
  debtors: Debtor[];
  commercial: CommercialState;
  today: string;
  by: string;
};
export type PartySaveResult =
  | { ok: false; error: string }
  | { ok: true; saved: Party[]; debtors: Debtor[]; commercial: CommercialState; message: string };

export function saveParty({ party, saved, all, debtors, commercial, today, by }: PartySaveInput): PartySaveResult {
  const blocking = validateParty(party, all).filter(issue => issue.blocking);
  if (blocking.length) return { ok: false, error: blocking[0].message };

  const isNew = !saved.some(p => p.id === party.id);
  let next: Party = {
    ...party,
    origin: "Cadastro",
    updatedAt: today,
    history: [
      ...party.history,
      { at: today, by, action: isNew && party.origin === "Cadastro" ? "Cadastro criado" : "Cadastro atualizado" },
    ],
  };
  let nextCommercial = commercial;
  let nextDebtors = debtors;
  const effects: string[] = [];
  const doc = onlyDigits(next.document);

  // Sacado: fica disponível na digitação e no Risco, preservando histórico de crédito existente.
  if (next.roles.includes("sacado")) {
    const current = debtors.find(d => onlyDigits(d.document) === doc);
    const identity = partyToDebtor(next);
    nextDebtors = current
      ? debtors.map(d => (d === current ? { ...d, ...identity, id: d.id, source: d.source } : d))
      : [identity, ...debtors];
    effects.push("sacado disponível na digitação");
  }

  // Representante: cria ou atualiza o comercial correspondente.
  if (next.roles.includes("representante") && next.roleData.representante) {
    const existing =
      commercial.reps.find(r => r.id === next.roleData.representante?.repId) ??
      commercial.reps.find(r => onlyDigits(r.document) === doc);
    const rep = partyToSalesRep(next, existing?.since ?? today);
    if (rep) {
      const result = saveRep(nextCommercial, { ...rep, id: existing?.id ?? "" });
      if (result.error) return { ok: false, error: result.error };
      nextCommercial = result.state;
      const repId = existing?.id ?? nextCommercial.reps.find(r => onlyDigits(r.document) === doc)?.id;
      next = { ...next, roleData: { ...next.roleData, representante: { ...next.roleData.representante, repId } } };
      effects.push(existing ? "comercial atualizado" : "comercial criado no Comercial");
    }
  }

  // Cedente: vínculo com o comercial responsável (cria ou transfere).
  const cedente = next.roles.includes("cedente") ? next.roleData.cedente : undefined;
  if (cedente?.repId) {
    const link = nextCommercial.links.find(l => onlyDigits(l.document) === doc);
    if (!link) {
      const result = linkClient(nextCommercial, {
        document: next.document,
        clientName: next.name,
        repId: cedente.repId,
        origin: "Prospecção ativa",
        approvedLimit: cedente.creditLimit,
        city: next.address.city ? `${next.address.city}/${next.address.state}` : undefined,
      });
      if (result.error) return { ok: false, error: result.error };
      nextCommercial = result.state;
      effects.push("cedente vinculado ao comercial");
    } else if (repAt(nextCommercial, next.document, today) !== cedente.repId) {
      const result = transferClient(nextCommercial, link.id, cedente.repId, "Alterado no Cadastro", by);
      if (result.error) return { ok: false, error: result.error };
      nextCommercial = result.state;
      effects.push("cedente transferido de comercial");
    }
  }

  const nextSaved = isNew ? [...saved, next] : saved.map(p => (p.id === next.id ? next : p));
  const message = `${next.name} ${isNew && party.origin === "Cadastro" ? "cadastrado" : "atualizado"}${effects.length ? `: ${effects.join(", ")}` : ""}.`;
  return { ok: true, saved: nextSaved, debtors: nextDebtors, commercial: nextCommercial, message };
}
