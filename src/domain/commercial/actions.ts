/**
 * Ações do Comercial (funções puras que devolvem `{ state, error?, message? }`): visitas, comitês, funil,
 * transferência e vínculo de clientes, comerciais e fechamento de comissões.
 */
import { digits, monthLabel, monthOf, stamp } from "./calendar";
import { computeCommission } from "./rules";
import { committeeMembers } from "./seed";
import {
  type CommercialState,
  type Committee,
  type CommitteeStatus,
  type CResult,
  type Deal,
  type FunnelStage,
  funnelStages,
  type LinkOrigin,
  type Prospect,
  type SalesRep,
  type Visit,
} from "./types";
import { addDays, todayIso } from "@/src/domain/finance/ledger";

export const nextId = (s: CommercialState, p: string) => {
  s.seq += 1;
  return `${p}-${s.seq}`;
};

export function scheduleVisit(state: CommercialState, v: Omit<Visit, "id" | "status">): CResult {
  if (!v.target.trim()) return { state, error: "Informe o cliente ou prospect." };
  if (!v.date) return { state, error: "Informe a data." };
  const s = { ...state, visits: [...state.visits] };
  s.visits.push({ ...v, id: nextId(s, "vs"), status: "Agendada" });
  s.visits.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { state: s, message: `Visita agendada para ${v.date.split("-").reverse().join("/")} às ${v.time}.` };
}

export function recordVisit(
  state: CommercialState,
  id: string,
  patch: Pick<Visit, "status"> & Partial<Pick<Visit, "outcome" | "nextStep" | "notes">>,
): CResult {
  if (patch.status === "Realizada" && !patch.outcome?.trim())
    return { state, error: "Descreva o resultado da visita." };
  if ((patch.status === "Cancelada" || patch.status === "Não realizada") && !patch.notes?.trim())
    return { state, error: "Informe o motivo." };
  return {
    state: { ...state, visits: state.visits.map(v => (v.id === id ? { ...v, ...patch } : v)) },
    message: `Visita marcada como ${patch.status.toLowerCase()}.`,
  };
}

export function submitCommittee(
  state: CommercialState,
  c: Pick<
    Committee,
    "clientName" | "document" | "repId" | "request" | "requested" | "rate" | "commercialOpinion" | "date"
  >,
  by: string,
): CResult {
  if (!c.clientName.trim()) return { state, error: "Informe o cliente." };
  if (!c.commercialOpinion.trim())
    return { state, error: "Escreva o parecer comercial: é o que o comitê lê primeiro." };
  if (c.request !== "Taxa especial" && !(c.requested > 0)) return { state, error: "Informe o valor solicitado." };
  const s = { ...state, committees: [...state.committees] };
  s.committees.push({
    ...c,
    id: nextId(s, "cm"),
    status: "Em pauta",
    members: committeeMembers,
    history: [{ at: stamp(), by, action: "Enviado ao comitê", detail: c.request }],
  });
  const p = s.prospects.find(x => x.name === c.clientName && !x.lost);
  if (p && funnelStages.indexOf(p.stage) < funnelStages.indexOf("Comitê"))
    s.prospects = s.prospects.map(x =>
      x.id === p.id ? { ...x, stage: "Comitê", updatedAt: todayIso(), nextStep: "Em pauta no comitê" } : x,
    );
  return { state: s, message: "Pedido incluído na pauta do comitê." };
}

export function decideCommittee(
  state: CommercialState,
  id: string,
  d: {
    status: Exclude<CommitteeStatus, "Em pauta">;
    approved?: number;
    rate?: number;
    conditions?: string;
    riskOpinion?: string;
    date?: string;
  },
  by: string,
): CResult {
  const c = state.committees.find(x => x.id === id);
  if (!c || c.status !== "Em pauta") return { state, error: "Pauta não encontrada ou já decidida." };
  if (
    (d.status === "Aprovado" || d.status === "Aprovado com ressalvas") &&
    c.request !== "Taxa especial" &&
    !(Number(d.approved) > 0)
  )
    return { state, error: "Informe o valor aprovado." };
  if (
    (d.status === "Aprovado com ressalvas" || d.status === "Reprovado" || d.status === "Adiado") &&
    !d.conditions?.trim()
  )
    return {
      state,
      error: d.status === "Aprovado com ressalvas" ? "Descreva as ressalvas." : "Registre o motivo da decisão.",
    };
  const at = todayIso();
  const approvedFlow = d.status === "Aprovado" || d.status === "Aprovado com ressalvas";
  let s: CommercialState = {
    ...state,
    committees: state.committees.map(x =>
      x.id !== id
        ? x
        : d.status === "Adiado"
          ? {
              ...x,
              date: d.date || addDays(x.date, 7),
              conditions: d.conditions,
              history: [
                ...x.history,
                {
                  at: stamp(),
                  by,
                  action: "Adiado",
                  detail: `${d.conditions} · nova data ${d.date || addDays(x.date, 7)}`,
                },
              ],
            }
          : {
              ...x,
              status: d.status,
              approved: d.approved,
              rate: d.rate ?? x.rate,
              conditions: d.conditions,
              riskOpinion: d.riskOpinion || x.riskOpinion,
              decidedAt: at,
              decidedBy: by,
              history: [
                ...x.history,
                {
                  at: stamp(),
                  by,
                  action: "Decisão registrada",
                  detail:
                    d.status +
                    (d.approved
                      ? ` · ${d.approved.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ""),
                },
              ],
            },
    ),
  };
  if (d.status === "Adiado") {
    s.committees = s.committees.map(x => (x.id === id ? { ...x, status: "Em pauta" } : x));
    return { state: s, message: "Pauta adiada." };
  }
  if (approvedFlow) {
    const link = s.links.find(
      l => (c.document && digits(l.document) === digits(c.document)) || l.clientName === c.clientName,
    );
    if (link && d.approved) {
      const resulting = c.request === "Aumento de limite" ? link.approvedLimit + d.approved : d.approved;
      s = { ...s, links: s.links.map(l => (l.id !== link.id ? l : { ...l, approvedLimit: resulting })) };
      s = {
        ...s,
        committees: s.committees.map(x =>
          x.id !== id
            ? x
            : {
                ...x,
                history: [
                  ...x.history,
                  {
                    at: stamp(),
                    by: "Sistema",
                    action: "Cadastro atualizado",
                    detail: `Limite do cedente no cadastro: ${resulting.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
                  },
                ],
              },
        ),
      };
    }
    s = {
      ...s,
      prospects: s.prospects.map(p =>
        p.name === c.clientName && !p.lost
          ? { ...p, stage: "Aprovado", updatedAt: at, nextStep: "Cadastrar e fazer a 1ª operação" }
          : p,
      ),
    };
  }
  return { state: s, message: `Decisão registrada: ${d.status.toLowerCase()}.` };
}

export function moveProspect(
  state: CommercialState,
  id: string,
  stage: FunnelStage | "Perdido",
  reason?: string,
): CResult {
  if (stage === "Perdido" && !reason?.trim()) return { state, error: "Informe o motivo da perda." };
  return {
    state: {
      ...state,
      prospects: state.prospects.map(p =>
        p.id !== id
          ? p
          : stage === "Perdido"
            ? { ...p, lost: reason, updatedAt: todayIso() }
            : { ...p, stage, updatedAt: todayIso() },
      ),
    },
    message: stage === "Perdido" ? "Oportunidade marcada como perdida." : `Oportunidade movida para ${stage}.`,
  };
}

export function addProspect(
  state: CommercialState,
  p: Pick<Prospect, "name" | "repId" | "potential" | "source" | "nextStep">,
): CResult {
  if (!p.name.trim()) return { state, error: "Informe o nome da empresa." };
  const s = { ...state, prospects: [...state.prospects] };
  s.prospects.push({ ...p, id: nextId(s, "pp"), stage: "Lead", createdAt: todayIso(), updatedAt: todayIso() });
  return { state: s, message: "Oportunidade criada no funil." };
}

/** Converte um prospect aprovado em conta nova vinculada ao comercial. */
export function convertProspect(
  state: CommercialState,
  id: string,
  input: { document: string; approvedLimit: number; segment: string; city: string },
): CResult {
  const p = state.prospects.find(x => x.id === id);
  if (!p) return { state, error: "Oportunidade não encontrada." };
  if (digits(input.document).length !== 14) return { state, error: "Informe o CNPJ completo." };
  if (state.links.some(l => digits(l.document) === digits(input.document)))
    return { state, error: "Este CNPJ já está vinculado a um comercial." };
  const s = { ...state, links: [...state.links] };
  s.links.push({
    id: nextId(s, "lk"),
    clientName: p.name,
    document: input.document,
    repId: p.repId,
    since: todayIso(),
    origin: p.source,
    status: "Em onboarding",
    approvedLimit: input.approvedLimit,
    segment: input.segment,
    city: input.city,
    transfers: [],
  });
  s.prospects = s.prospects.filter(x => x.id !== id);
  return { state: s, message: `${p.name} virou conta nova de ${state.reps.find(r => r.id === p.repId)?.name}.` };
}

export function transferClient(
  state: CommercialState,
  linkId: string,
  to: string,
  reason: string,
  by: string,
): CResult {
  const link = state.links.find(l => l.id === linkId);
  if (!link) return { state, error: "Cliente não encontrado." };
  if (link.repId === to) return { state, error: "O cliente já é deste comercial." };
  if (!reason.trim()) return { state, error: "Informe o motivo da transferência." };
  return {
    state: {
      ...state,
      links: state.links.map(l =>
        l.id !== linkId
          ? l
          : { ...l, repId: to, transfers: [...l.transfers, { from: l.repId, to, at: todayIso(), by, reason }] },
      ),
    },
    message: "Cliente transferido. Os negócios anteriores continuam com o comercial antigo.",
  };
}

export function saveRep(state: CommercialState, rep: SalesRep): CResult {
  if (!rep.name.trim()) return { state, error: "Informe o nome." };
  if (!(rep.monthlyGoal >= 0)) return { state, error: "Meta inválida." };
  const exists = state.reps.some(r => r.id === rep.id);
  const s = { ...state };
  if (exists) s.reps = state.reps.map(r => (r.id === rep.id ? rep : r));
  else {
    s.seq += 1;
    s.reps = [
      ...state.reps,
      {
        ...rep,
        id: `rep-${s.seq}`,
        initials: rep.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(w => w[0])
          .join("")
          .toUpperCase(),
      },
    ];
  }
  return { state: s, message: exists ? "Comercial atualizado." : "Comercial cadastrado." };
}

export function closeCommission(state: CommercialState, deals: Deal[], month: string, by: string): CResult {
  if (state.closings[month]) return { state, error: "Esta competência já está fechada." };
  if (month >= monthOf(todayIso()))
    return { state, error: "Só é possível fechar competências encerradas. O mês corrente fica como prévia." };
  const lines = computeCommission(state, deals, month);
  return {
    state: {
      ...state,
      closings: {
        ...state.closings,
        [month]: { month, status: "Fechada", closedAt: stamp(), closedBy: by, lines, rules: state.rules },
      },
    },
    message: `Comissões de ${monthLabel(month)} fechadas.`,
  };
}

export function reopenCommission(state: CommercialState, month: string): CResult {
  const c = state.closings[month];
  if (!c) return { state, error: "Competência aberta." };
  if (c.status === "Enviada ao financeiro")
    return { state, error: "Já foi enviada ao financeiro. Exclua os lançamentos a pagar lá antes de reabrir." };
  const closings = { ...state.closings };
  delete closings[month];
  return { state: { ...state, closings }, message: "Competência reaberta." };
}

export function commercialToCsv(rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${rows.map(r => r.map(esc).join(";")).join("\n")}\n`;
}

/** Vincula ao comercial um cedente que já está no cadastro (sem passar pelo funil). */
export function linkClient(
  state: CommercialState,
  input: {
    document: string;
    clientName: string;
    repId: string;
    origin: LinkOrigin;
    approvedLimit: number;
    segment?: string;
    city?: string;
  },
): CResult {
  if (!input.repId) return { state, error: "Escolha o comercial responsável." };
  if (state.links.some(l => digits(l.document) === digits(input.document)))
    return { state, error: "Este CNPJ já tem comercial responsável. Use Transferir." };
  const s = { ...state, links: [...state.links] };
  s.links.push({
    id: nextId(s, "lk"),
    clientName: input.clientName,
    document: input.document,
    repId: input.repId,
    since: todayIso(),
    origin: input.origin,
    status: input.approvedLimit > 0 ? "Ativo" : "Em onboarding",
    approvedLimit: input.approvedLimit,
    segment: input.segment ?? "—",
    city: input.city ?? "—",
    transfers: [],
  });
  return {
    state: s,
    message: `${input.clientName} vinculado a ${state.reps.find(r => r.id === input.repId)?.name}. Operações novas já nascem com este comercial.`,
  };
}
