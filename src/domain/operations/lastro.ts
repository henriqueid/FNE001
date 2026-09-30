/**
 * Avaliação de lastro: amostra por risco, cobertura documental e situação de confirmação de cada título.
 */
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { type Debtor, type ManualEntry, type Operation } from "@/src/domain/core/types";

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
    | "Recusado"
    | "Telefone inválido";
  attachmentName?: string;
  reasons: string[];
};

export type LastroReviewItem = NonNullable<NonNullable<Operation["lastroReview"]>["items"]>[string];

export function lastroAssessmentFor(operation: Operation, debtorCatalog: Debtor[] = initialDebtors) {
  const entries = operation.manualEntry?.entries ?? [];
  const ratio = operation.risk === "Alto" ? 1 : operation.risk === "Médio" ? 0.5 : 0.25;
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
            ? Boolean(title.nfeKey && title.cfop && /^[56]/.test(title.cfop))
            : Boolean(title.documentNumber);
      const reasons = [
        !automaticEvidence ? "Evidência documental incompleta" : "",
        (debtor?.score ?? 700) < 600 ? "Sacado em faixa crítica" : "",
        operation.amount > 0 && title.amount / operation.amount >= 0.25 ? "Concentração relevante na operação" : "",
        title.cfop && !/^[56]/.test(title.cfop) ? "CFOP exige revisão" : "",
      ].filter(Boolean);
      return {
        title,
        debtor,
        automaticEvidence,
        reasons,
        priority:
          (automaticEvidence ? 0 : 100) +
          ((debtor?.score ?? 700) < 600 ? 60 : 0) +
          (title.amount / Math.max(1, operation.amount) >= 0.25 ? 30 : 0) +
          index / 100,
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const sampledIds = new Set(ranked.slice(0, sampleSize).map(item => item.title.id));
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
  const confirmed = sampled.filter(row => row.confirmation === "Confirmado").length;
  const divergences = rows.filter(
    row =>
      row.evidenceStatus === "Divergente" ||
      row.confirmation === "Recusado" ||
      row.confirmation === "Telefone inválido",
  ).length;
  return {
    rows,
    sampleSize,
    evidenceValid,
    confirmed,
    divergences,
    ready:
      rows.length > 0 &&
      evidenceValid === rows.length &&
      divergences === 0 &&
      sampled.every(row => row.confirmation === "Confirmado"),
  };
}
