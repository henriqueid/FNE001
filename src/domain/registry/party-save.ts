/**
 * Gravação de um cadastro e propagação para os módulos que dependem dele.
 * Função pura: recebe o estado atual e devolve o novo estado de cada área, para que
 * o app aplique tudo de uma vez (e para que a regra seja testável sem React).
 */
import { assignAccountManager, linkClient, saveRep, transferClient } from "@/src/domain/commercial/actions";
import { repAt } from "@/src/domain/commercial/rules";
import type { CommercialState } from "@/src/domain/commercial/types";
import type { Debtor } from "@/src/domain/core/types";
import {
  onlyDigits,
  partyToDebtor,
  partyToSalesRep,
  validateParty,
  type Party,
  type PartyHistoryEntry,
} from "./parties";

export type PartySaveInput = {
  party: Party;
  saved: Party[];
  all: Party[];
  debtors: Debtor[];
  commercial: CommercialState;
  today: string;
  by: string;
  reason?: string;
  source?: string;
};
export type PartySaveResult =
  | { ok: false; error: string }
  | { ok: true; saved: Party[]; debtors: Debtor[]; commercial: CommercialState; message: string };

const auditIgnored = new Set(["history", "createdAt", "updatedAt", "origin"]);

function auditValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  return String(value);
}

function flattenParty(value: unknown, path = "", target = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value)) {
    if (value.every(item => typeof item !== "object" || item === null)) {
      target.set(path, value.length ? value.map(auditValue).join(", ") : "—");
      return target;
    }
    value.forEach((item, index) => {
      const key = typeof item === "object" && item && "id" in item ? String(item.id) : String(index + 1);
      flattenParty(item, `${path}[${key}]`, target);
    });
    if (!value.length) target.set(path, "—");
    return target;
  }
  if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, child]) => {
      if (!path && auditIgnored.has(key)) return;
      if (key === "id" && path.includes("[")) return;
      flattenParty(child, path ? `${path}.${key}` : key, target);
    });
    return target;
  }
  target.set(path, auditValue(value));
  return target;
}

export function partyChanges(before: Party, after: Party) {
  const previous = flattenParty(before);
  const current = flattenParty(after);
  return [...new Set([...previous.keys(), ...current.keys()])]
    .map(field => ({ field, from: previous.get(field) ?? "—", to: current.get(field) ?? "—" }))
    .filter(change => change.from !== change.to);
}

export function saveParty({
  party,
  saved,
  all,
  debtors,
  commercial,
  today,
  by,
  reason,
  source = "Cadastro",
}: PartySaveInput): PartySaveResult {
  const blocking = validateParty(party, all).filter(issue => issue.blocking);
  if (blocking.length) return { ok: false, error: blocking[0].message };

  const previous = saved.find(p => p.id === party.id);
  const isNew = !previous;
  if (!isNew && !reason?.trim()) return { ok: false, error: "Informe o motivo da alteração para manter a auditoria." };
  let next: Party = {
    ...party,
    origin: "Cadastro",
    updatedAt: today,
    history: previous?.history ?? party.history ?? [],
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
        managerId: cedente.managerId,
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
    const currentLink = nextCommercial.links.find(l => onlyDigits(l.document) === doc);
    if (currentLink && currentLink.approvedLimit !== cedente.creditLimit) {
      nextCommercial = {
        ...nextCommercial,
        links: nextCommercial.links.map(item =>
          item.id === currentLink.id ? { ...item, approvedLimit: cedente.creditLimit } : item,
        ),
      };
      effects.push("limite operacional atualizado");
    }
    if (currentLink && cedente.managerId && currentLink.managerId !== cedente.managerId) {
      const result = assignAccountManager(nextCommercial, currentLink.id, cedente.managerId);
      if (result.error) return { ok: false, error: result.error };
      nextCommercial = result.state;
      effects.push("gerente da conta atualizado");
    }
  }

  const history: PartyHistoryEntry[] = isNew
    ? [
        ...next.history,
        {
          at: today,
          by,
          action: party.origin === "Cadastro" ? "Cadastro criado" : "Cadastro consolidado",
          field: "cadastro",
          from: "—",
          to: "Criado",
          reason: "Cadastro inicial",
          origin: source,
        },
      ]
    : partyChanges(previous, next).map(change => ({
        at: today,
        by,
        action: "Campo alterado",
        ...change,
        reason: reason!.trim(),
        origin: source,
      }));
  if (!isNew && !history.length) return { ok: false, error: "Nenhuma alteração foi identificada no cadastro." };
  next = { ...next, history: isNew ? history : [...next.history, ...history] };

  const nextSaved = isNew ? [...saved, next] : saved.map(p => (p.id === next.id ? next : p));
  const message = `${next.name} ${isNew && party.origin === "Cadastro" ? "cadastrado" : "atualizado"}${effects.length ? `: ${effects.join(", ")}` : ""}.`;
  return { ok: true, saved: nextSaved, debtors: nextDebtors, commercial: nextCommercial, message };
}
