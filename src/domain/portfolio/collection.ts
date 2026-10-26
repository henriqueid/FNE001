/**
 * Fila operacional de cobrança e checagem. Converte a posição dos títulos em ações priorizadas,
 * sem guardar estado derivado: a fila é sempre recalculada a partir da carteira e da data de trabalho.
 */
import { daysBetween } from "@/src/domain/home/metrics";
import { portfolioBalance, type PortfolioTitleRecord } from "./model";

export type CollectionQueue = "cobranca" | "checagem";
export type CollectionPriority = "critica" | "alta" | "media" | "baixa";
export type CollectionReason =
  | "promessa-vencida"
  | "retorno-vencido"
  | "vencido"
  | "vence-hoje"
  | "preventivo"
  | "divergencia"
  | "confirmacao-pendente";

export type CollectionAction = {
  id: string;
  titleId: string;
  queue: CollectionQueue;
  priority: CollectionPriority;
  score: number;
  reason: CollectionReason;
  label: string;
  detail: string;
  suggestedAction: string;
  dueAt: string;
  balance: number;
  daysLate: number;
};

type CollectionTitle = Omit<PortfolioTitleRecord, "source"> & { source: string };

const closedStatuses = new Set(["Pago", "Recomprado", "Cancelado"]);

function datePart(value?: string) {
  return value?.slice(0, 10) ?? "";
}

function collectionActionFor(title: CollectionTitle, today: string): CollectionAction | null {
  if (closedStatuses.has(title.status) || portfolioBalance(title) <= 0) return null;
  const daysLate = daysBetween(title.dueDate, today);
  const last = title.collectionOccurrences?.at(-1);
  const promiseDate = last?.outcome === "Promessa de pagamento" ? last.promiseDate : undefined;
  const followUp = datePart(last?.nextContactAt);
  const balance = portfolioBalance(title);

  if (promiseDate && promiseDate < today) {
    const overdue = daysBetween(promiseDate, today);
    return {
      id: `collection:${title.id}:promise`,
      titleId: title.id,
      queue: "cobranca",
      priority: "critica",
      score: 500 + overdue,
      reason: "promessa-vencida",
      label: "Promessa vencida",
      detail: `Pagamento prometido há ${overdue} dia(s).`,
      suggestedAction: "Ligar para o sacado e renegociar ou escalar a cobrança.",
      dueAt: promiseDate,
      balance,
      daysLate,
    };
  }

  if (followUp && followUp <= today) {
    const overdue = daysBetween(followUp, today);
    return {
      id: `collection:${title.id}:follow-up`,
      titleId: title.id,
      queue: "cobranca",
      priority: overdue > 0 ? "alta" : "media",
      score: 400 + overdue,
      reason: "retorno-vencido",
      label: overdue > 0 ? "Retorno atrasado" : "Retorno para hoje",
      detail: overdue > 0 ? `Retorno agendado há ${overdue} dia(s).` : "Retorno agendado para hoje.",
      suggestedAction: "Retomar o contato pelo canal da última ocorrência.",
      dueAt: followUp,
      balance,
      daysLate,
    };
  }

  if (daysLate > 0) {
    const critical = daysLate > 30;
    const high = daysLate > 5;
    return {
      id: `collection:${title.id}:overdue`,
      titleId: title.id,
      queue: "cobranca",
      priority: critical ? "critica" : high ? "alta" : "media",
      score: (critical ? 350 : high ? 300 : 250) + daysLate,
      reason: "vencido",
      label: critical ? `Vencido há ${daysLate} dias` : `D+${daysLate}`,
      detail: followUp
        ? `Retorno agendado para ${followUp.split("-").reverse().join("/")}.`
        : last
          ? "Sem retorno agendado após a última cobrança."
          : "Título vencido sem cobrança registrada.",
      suggestedAction: critical
        ? "Revisar protesto, negativação ou recompra com o cedente."
        : high
          ? "Cobrança formal por telefone e e-mail."
          : "Enviar lembrete e confirmar a previsão de pagamento.",
      dueAt: title.dueDate,
      balance,
      daysLate,
    };
  }

  if (daysLate === 0) {
    return {
      id: `collection:${title.id}:today`,
      titleId: title.id,
      queue: "cobranca",
      priority: "alta",
      score: 220,
      reason: "vence-hoje",
      label: "Vence hoje",
      detail: last ? "Confirmar a liquidação prometida." : "Título sem contato preventivo registrado.",
      suggestedAction: "Confirmar pagamento e reenviar boleto, se necessário.",
      dueAt: today,
      balance,
      daysLate,
    };
  }

  if (daysLate >= -3) {
    return {
      id: `collection:${title.id}:preventive`,
      titleId: title.id,
      queue: "cobranca",
      priority: "baixa",
      score: 100 + daysLate,
      reason: "preventivo",
      label: `Vence em ${-daysLate} dia(s)`,
      detail: "Janela de contato preventivo da régua.",
      suggestedAction: "Enviar lembrete com boleto e confirmar o recebimento.",
      dueAt: title.dueDate,
      balance,
      daysLate,
    };
  }

  return null;
}

function confirmationActionFor(title: CollectionTitle, today: string): CollectionAction | null {
  if (closedStatuses.has(title.status) || portfolioBalance(title) <= 0) return null;
  const status = title.confirmation?.status ?? "Não iniciada";
  if (status === "Confirmado") return null;
  const daysLate = daysBetween(title.dueDate, today);
  if (status === "Não iniciada" && daysLate < -7) return null;
  const divergent = status === "Divergente";
  const notFound = status === "Não localizado";
  return {
    id: `confirmation:${title.id}`,
    titleId: title.id,
    queue: "checagem",
    priority: divergent ? "critica" : notFound || daysLate >= 0 ? "alta" : "media",
    score: (divergent ? 480 : notFound ? 380 : daysLate >= 0 ? 330 : 180) + Math.max(0, daysLate),
    reason: divergent ? "divergencia" : "confirmacao-pendente",
    label: divergent ? "Divergência aberta" : status === "Não iniciada" ? "Checagem não iniciada" : status,
    detail: divergent
      ? title.confirmation.notes || "A Controladoria registrou divergência no título."
      : `Confirmação do sacado necessária ${daysLate >= 0 ? "antes da cobrança" : "antes do vencimento"}.`,
    suggestedAction: divergent
      ? "Analisar a divergência com cedente e sacado antes de avançar."
      : "Contatar o sacado e confirmar entrega, valor e vencimento.",
    dueAt: daysLate >= 0 ? today : title.dueDate,
    balance: portfolioBalance(title),
    daysLate,
  };
}

export function buildCollectionQueue(titles: CollectionTitle[], today: string): CollectionAction[] {
  return titles
    .flatMap(title => [collectionActionFor(title, today), confirmationActionFor(title, today)])
    .filter((action): action is CollectionAction => action !== null)
    .sort((left, right) => right.score - left.score || right.balance - left.balance);
}
