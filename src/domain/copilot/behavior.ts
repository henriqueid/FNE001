/** Eventos comportamentais e aprendizado explicável, sempre derivados de evidências do cliente. */
import type { Operation } from "@/src/domain/core/types";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import { normalizedQuestion } from "./analytics";

export type QueryKey =
  `${"debtor" | "owner" | "title" | "summary"}:${"balance" | "count"}:${"open" | "overdue" | "upcoming"}`;
export const isQueryKey = (value: unknown): value is QueryKey =>
  typeof value === "string" && /^(debtor|owner|title|summary):(balance|count):(open|overdue|upcoming)$/.test(value);
export type BehaviorEvent = {
  id: string;
  tenantId: string;
  company: string;
  actorId: string;
  entityId: string;
  kind:
    | "observation"
    | "confirmation"
    | "collection"
    | "promise"
    | "decision"
    | "payment"
    | "correction"
    | "feedback"
    | "guidance";
  text: string;
  at: string;
  evidenceRefs: string[];
  visibility: "private" | "company";
  status: "recorded" | "pending" | "validated" | "rejected" | "revoked";
  source: "memory" | "portfolio" | "operation" | "ledger" | "finance" | "commercial" | "task";
  validUntil?: string;
  reviewerId?: string;
  question?: string;
  queryKey?: QueryKey;
  outcome?: "payment_observed" | "pending";
};
export type Learning = {
  id: string;
  kind: "interpretation" | "outcome" | "guidance";
  text: string;
  evidenceRefs: string[];
  queryKey?: QueryKey;
  question?: string;
  company?: string;
  sampleSize: number;
};
export type MemoryDraft = Pick<BehaviorEvent, "company" | "entityId" | "text"> & {
  kind: "observation" | "correction" | "feedback" | "guidance";
  question?: string;
  queryKey?: QueryKey;
  visibility?: "private" | "company";
};

export function validateMemoryDraft(value: unknown): { ok: true; draft: MemoryDraft } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Registro inválido." };
  const draft = value as Partial<MemoryDraft>;
  if (
    !["observation", "correction", "feedback", "guidance"].includes(draft.kind ?? "") ||
    typeof draft.text !== "string" ||
    !draft.text.trim() ||
    draft.text.length > 2000 ||
    typeof draft.company !== "string" ||
    !draft.company.trim() ||
    draft.company.length > 200 ||
    typeof draft.entityId !== "string" ||
    !/^(title|operation|finance|visit|committee|task):.{1,200}$/.test(draft.entityId)
  )
    return { ok: false, error: "Informe tipo, conteúdo, empresa e entidade válidos." };
  if (
    draft.kind === "correction" &&
    (!isQueryKey(draft.queryKey) ||
      typeof draft.question !== "string" ||
      !draft.question.trim() ||
      draft.question.length > 2000)
  )
    return { ok: false, error: "A correção exige pergunta e consulta de destino válidas." };
  if (draft.visibility !== undefined && !["private", "company"].includes(draft.visibility))
    return { ok: false, error: "Visibilidade inválida." };
  return {
    ok: true,
    draft: {
      kind: draft.kind as MemoryDraft["kind"],
      text: draft.text.trim(),
      company: draft.company.trim(),
      entityId: draft.entityId,
      visibility: draft.visibility ?? "private",
      ...(draft.kind === "correction" ? { question: draft.question!.trim(), queryKey: draft.queryKey } : {}),
    },
  };
}

export function visibleMemories(
  events: BehaviorEvent[],
  principal: { tenantId: string; id: string; companyScopes: string[] },
  today: string,
) {
  return events.filter(
    event =>
      event.tenantId === principal.tenantId &&
      principal.companyScopes.some(
        scope => scope === "*" || scope.trim().toLowerCase() === event.company.trim().toLowerCase(),
      ) &&
      (event.visibility === "company" || event.actorId === principal.id) &&
      !["rejected", "revoked"].includes(event.status) &&
      (!event.validUntil || event.validUntil.slice(0, 10) >= today),
  );
}

export function deriveLearnings(events: BehaviorEvent[], today: string): Learning[] {
  const valid = events.filter(
    event =>
      !["rejected", "revoked"].includes(event.status) && (!event.validUntil || event.validUntil.slice(0, 10) >= today),
  );
  const corrections = valid.filter(
    event =>
      event.kind === "correction" &&
      event.status === "validated" &&
      event.reviewerId &&
      event.reviewerId !== event.actorId &&
      event.evidenceRefs.length &&
      isQueryKey(event.queryKey) &&
      event.question,
  );
  const learnings: Learning[] = [];
  valid
    .filter(
      event =>
        event.kind === "guidance" &&
        event.status === "validated" &&
        event.reviewerId &&
        event.reviewerId !== event.actorId &&
        event.evidenceRefs.length,
    )
    .forEach(event =>
      learnings.push({
        id: `guidance:${event.id}`,
        kind: "guidance",
        text: `Orientação revisada do cliente (não é política nem autorização): ${event.text}`,
        company: event.company,
        sampleSize: 1,
        evidenceRefs: [event.id],
      }),
    );
  const questions = new Map<string, BehaviorEvent[]>();
  corrections.forEach(event => {
    const key = `${event.company.toLowerCase()}:${normalizedQuestion(event.question!).trim()}`;
    questions.set(key, [...(questions.get(key) ?? []), event]);
  });
  questions.forEach(rows => {
    if (new Set(rows.map(row => row.queryKey)).size !== 1) return;
    learnings.push({
      id: `interpretation:${rows[0].id}`,
      kind: "interpretation",
      text: "Interpretação revisada para esta pergunta; o resultado é recalculado na posição atual.",
      queryKey: rows[0].queryKey,
      question: rows[0].question,
      company: rows[0].company,
      sampleSize: rows.length,
      evidenceRefs: rows.map(row => row.id),
    });
  });
  const promises = [
    ...new Map(
      valid
        .filter(event => event.kind === "promise" && event.source === "portfolio" && event.outcome)
        .map(event => [event.entityId, event]),
    ).values(),
  ];
  if (promises.length >= 3) {
    const observed = promises.filter(event => event.outcome === "payment_observed").length;
    learnings.push({
      id: "outcome:promises",
      kind: "outcome",
      sampleSize: promises.length,
      evidenceRefs: promises.map(event => event.id),
      text: `${observed} de ${promises.length} títulos com promessa possuem pagamento registrado após o contato. A amostra não comprova cumprimento integral ou causalidade e considera somente os registros consultados.`,
    });
  }
  return learnings;
}

export function projectBehavior(tenantId: string, portfolio: PortfolioState, operations: Operation[]): BehaviorEvent[] {
  const events: BehaviorEvent[] = [];
  portfolio.titles.forEach(title => {
    if (!title.company) return;
    const base = {
      tenantId,
      company: title.company,
      entityId: `title:${title.id}`,
      visibility: "company" as const,
      status: "recorded" as const,
      source: "portfolio" as const,
    };
    if (title.observation)
      events.push({
        ...base,
        id: `observation:${title.id}`,
        kind: "observation",
        actorId: "Registro da carteira",
        at: "",
        text: title.observation,
        evidenceRefs: [base.entityId],
      });
    if (title.confirmation.status !== "Não iniciada")
      events.push({
        ...base,
        id: `confirmation:${title.id}`,
        kind: "confirmation",
        actorId: title.confirmation.updatedBy ?? "Registro da carteira",
        at: title.confirmation.updatedAt ?? "",
        text: `${title.confirmation.status}: ${title.confirmation.notes ?? "Sem anotação"}`,
        evidenceRefs: [base.entityId],
      });
    title.collectionOccurrences.forEach(occurrence => {
      const evidenceRefs = [base.entityId, `collection:${occurrence.id}`];
      const payments = title.payments.filter(
        payment => payment.date > occurrence.chargedAt.slice(0, 10) && payment.amount > 0,
      );
      events.push({
        ...base,
        id: `collection:${title.id}:${occurrence.id}`,
        actorId: occurrence.createdBy,
        at: occurrence.createdAt,
        kind: occurrence.promiseDate ? "promise" : "collection",
        text: `${occurrence.outcome}. ${occurrence.notes}${occurrence.promiseDate ? ` Promessa declarada para ${occurrence.promiseDate}.` : ""}`,
        evidenceRefs: [...evidenceRefs, ...payments.map(payment => `payment:${payment.id}`)],
        ...(occurrence.promiseDate
          ? { outcome: payments.length ? ("payment_observed" as const) : ("pending" as const) }
          : {}),
      });
    });
    title.payments.forEach(payment =>
      events.push({
        ...base,
        id: `payment:${title.id}:${payment.id}`,
        kind: "payment",
        actorId: payment.createdBy,
        at: payment.createdAt,
        text: `Pagamento registrado em ${payment.date}: ${payment.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Meio: ${payment.method ?? "não informado"}.`,
        evidenceRefs: [base.entityId, `payment:${payment.id}`],
      }),
    );
  });
  operations.forEach(operation => {
    const base = {
      tenantId,
      company: operation.vehicle,
      entityId: `operation:${operation.id}`,
      visibility: "company" as const,
      status: "recorded" as const,
      source: "operation" as const,
      evidenceRefs: [`operation:${operation.id}`],
    };
    const review = operation.approvalReview;
    if (review?.observation)
      events.push({
        ...base,
        id: `operation-observation:${operation.id}`,
        kind: "observation",
        text: review.observation,
        actorId: review.submittedBy ?? operation.owner,
        at: review.submittedAt ?? "",
      });
    review?.approvals
      ?.filter(item => item.status !== "Pendente")
      .forEach(item =>
        events.push({
          ...base,
          id: `approval:${operation.id}:${item.id}`,
          kind: "decision",
          actorId: item.approver,
          at: item.decidedAt ?? "",
          text: `${item.role}: ${item.status}. ${item.note ?? ""} Decisão restrita a esta operação; não concede nova alçada.`,
        }),
      );
    if (review?.finalDecision)
      events.push({
        ...base,
        id: `decision:${operation.id}`,
        kind: "decision",
        actorId: review.finalDecision.decidedBy,
        at: review.finalDecision.decidedAt,
        text: `${review.finalDecision.outcome}: ${review.finalDecision.justification}`,
      });
    Object.entries(operation.lastroReview?.items ?? {}).forEach(([id, item]) => {
      if (item.confirmationNotes)
        events.push({
          ...base,
          id: `lastro:${operation.id}:${id}`,
          kind: "confirmation",
          actorId: item.updatedBy ?? "Registro de lastro",
          at: item.updatedAt ?? "",
          text: `${item.confirmation ?? "Pendente"}: ${item.confirmationNotes}`,
          evidenceRefs: [...base.evidenceRefs, `lastro:${id}`],
        });
    });
  });
  return events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
