/**
 * Avaliação de lastro: amostra por risco, cobertura documental e situação de confirmação de cada título.
 */
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { isDemoOperation } from "@/src/domain/core/demo/operations";
import { type Debtor, type ManualEntry, type Operation } from "@/src/domain/core/types";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";

export type LastroAssessmentRow = {
  title: ManualEntry;
  debtor?: Debtor;
  sampled: boolean;
  automaticEvidence: boolean;
  evidenceStatus: "Validada" | "Pendente" | "Divergente";
  confirmation?:
    | "Pendente"
    | "Contato iniciado"
    | "Sem contato"
    | "Confirmado"
    | "Confirmado com ressalva"
    | "Não confirmado"
    | "Não confirma para terceiros"
    | "Recusado"
    | "Telefone inválido";
  attachmentName?: string;
  reasons: string[];
};

export type LastroReviewItem = NonNullable<NonNullable<Operation["lastroReview"]>["items"]>[string];

/**
 * Resultados que encerram a tentativa de confirmação sem uma confirmação plena: o título
 * da amostra deixa de travar o lastro, mas segue como exceção para a alçada na Aprovação.
 * Sempre exigem observação na pré-checagem.
 */
export const lastroExceptionResults = [
  "Confirmado com ressalva",
  "Não confirmado",
  "Não confirma para terceiros",
] as const;

export const isLastroException = (confirmation?: LastroAssessmentRow["confirmation"]) =>
  (lastroExceptionResults as readonly string[]).includes(confirmation ?? "");

/** Título da amostra com a confirmação resolvida: confirmado ou registrado como exceção. */
export const isConfirmationResolved = (row: Pick<LastroAssessmentRow, "confirmation">) =>
  row.confirmation === "Confirmado" || isLastroException(row.confirmation);

export function lastroAssessmentFor(
  operation: Operation,
  debtorCatalog: Debtor[] = isDemoOperation(operation) ? initialDebtors : [],
) {
  const required = operation.lastroPrecheckRequired ?? false;
  const status = operation.lastroReview?.status ?? (required ? "Pendente" : "Dispensado");
  const entries = operation.manualEntry?.entries ?? [];
  const { lastroSampleRatio, lastroRelevantShare, scoreBands, cfopPrefixes } = operationalParametersFor(
    operation.institution,
  );
  const cfopAccepted = (cfop?: string) => Boolean(cfop && cfopPrefixes.some(prefix => cfop.startsWith(prefix)));
  /** Sem score, o sacado é tratado como fora da faixa crítica (mesmo comportamento da v7). */
  const critical = (debtor?: Debtor) => (debtor?.score ?? scoreBands.positive) < scoreBands.attention;
  const client = operation.clientOperationalParameters;
  const ratio = Math.max(
    lastroSampleRatio[operation.risk],
    (client?.samplePercent ?? 0) / 100,
    (client?.minimumConfirmationCountPercent ?? 0) / 100,
  );
  const sampleSize = entries.length ? Math.max(1, Math.ceil(entries.length * ratio)) : 0;
  const ranked = entries
    .map((title, index) => {
      const debtor = debtorCatalog.find(
        item =>
          item.id === title.debtorId || item.document.replace(/\D/g, "") === title.debtorDocument.replace(/\D/g, ""),
      );
      const automaticEvidence =
        operation.manualEntry?.receivableType === "Cheque"
          ? Boolean(title.cmc7 && title.bank && title.account)
          : operation.manualEntry?.receivableType === "Duplicata"
            ? Boolean(title.nfeKey && cfopAccepted(title.cfop))
            : Boolean(title.documentNumber);
      const reasons = [
        !automaticEvidence ? "Evidência documental incompleta" : "",
        critical(debtor) ? "Sacado em faixa crítica" : "",
        operation.amount > 0 && title.amount / operation.amount >= lastroRelevantShare
          ? "Concentração relevante na operação"
          : "",
        title.cfop && !cfopAccepted(title.cfop) ? "CFOP exige revisão" : "",
      ].filter(Boolean);
      return {
        title,
        debtor,
        automaticEvidence,
        reasons,
        priority:
          (automaticEvidence ? 0 : 100) +
          (critical(debtor) ? 60 : 0) +
          (title.amount / Math.max(1, operation.amount) >= lastroRelevantShare ? 30 : 0) +
          index / 100,
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const sampledIds = new Set(ranked.slice(0, sampleSize).map(item => item.title.id));
  if (client?.minimumConfirmationAmountPercent) {
    const target =
      entries.reduce((sum, title) => sum + title.amount, 0) * (client.minimumConfirmationAmountPercent / 100);
    let covered = 0;
    [...entries]
      .sort((a, b) => b.amount - a.amount)
      .some(title => {
        sampledIds.add(title.id);
        covered += title.amount;
        return covered >= target;
      });
  }
  const rows: LastroAssessmentRow[] = entries.map(title => {
    const base = ranked.find(item => item.title.id === title.id)!;
    const review = operation.lastroReview?.items?.[title.id];
    return {
      title,
      debtor: base.debtor,
      automaticEvidence: base.automaticEvidence,
      sampled: sampledIds.has(title.id),
      evidenceStatus: review?.evidenceDecision ?? (base.automaticEvidence ? "Validada" : "Pendente"),
      confirmation: review?.confirmation,
      attachmentName: review?.attachmentName,
      reasons: base.reasons,
    };
  });
  const evidenceValid = rows.filter(row => row.evidenceStatus === "Validada").length;
  const sampled = rows.filter(row => row.sampled);
  const confirmedRows = rows.filter(row => row.confirmation === "Confirmado");
  const confirmed = sampled.filter(row => row.confirmation === "Confirmado").length;
  const exceptions = sampled.filter(row => isLastroException(row.confirmation));
  const divergences = rows.filter(
    row =>
      row.evidenceStatus === "Divergente" ||
      row.confirmation === "Recusado" ||
      row.confirmation === "Telefone inválido",
  ).length;
  const totalAmount = rows.reduce((sum, row) => sum + row.title.amount, 0);
  const confirmedAmount = confirmedRows.reduce((sum, row) => sum + row.title.amount, 0);
  const confirmationCountPercent = rows.length ? (confirmedRows.length / rows.length) * 100 : 0;
  const confirmationAmountPercent = totalAmount ? (confirmedAmount / totalAmount) * 100 : 0;
  const minimumConfirmationCountPercent = client?.minimumConfirmationCountPercent ?? 0;
  const minimumConfirmationAmountPercent = client?.minimumConfirmationAmountPercent ?? 0;
  const minimumConfirmedTitles = client?.minimumConfirmedTitles ?? 0;
  const confirmationMinimumMet =
    confirmedRows.length >= minimumConfirmedTitles &&
    confirmationCountPercent >= minimumConfirmationCountPercent &&
    confirmationAmountPercent >= minimumConfirmationAmountPercent;
  const failureAction = client?.confirmationFailureAction ?? "Enviar para alçada";
  const blocksForConfirmation =
    !confirmationMinimumMet && ["Bloquear", "Solicitar nova amostra"].includes(failureAction);
  const hasFinalOpinion = ["Favorável", "Favorável com ressalvas", "Desfavorável"].includes(status);
  return {
    required,
    status,
    opinion: operation.lastroReview?.opinion ?? "",
    rows,
    sampleSize: sampledIds.size,
    evidenceValid,
    confirmed,
    divergences,
    /** Títulos da amostra registrados como exceção (ressalva, não confirmado, não confirma para terceiros). */
    exceptions,
    confirmationCountPercent,
    confirmationAmountPercent,
    minimumConfirmationCountPercent,
    minimumConfirmationAmountPercent,
    minimumConfirmedTitles,
    confirmationMinimumMet,
    confirmationFailureAction: failureAction,
    /** Confirmações, evidências e checklist apoiam o parecer, mas não bloqueiam a etapa. */
    ready: !required || hasFinalOpinion,
    supportingChecksComplete:
      rows.length > 0 &&
      evidenceValid === rows.length &&
      divergences === 0 &&
      sampled.every(isConfirmationResolved) &&
      !blocksForConfirmation,
  };
}
