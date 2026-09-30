/**
 * Tipos e funções puras do painel de lastro: filtros da amostra, chaves de agrupamento
 * (sacado/nota), classes de status e indicadores de cobertura e confirmação.
 */
import { type Debtor, type ManualEntry } from "@/src/domain/core/types";
import { type LastroAssessmentRow, type lastroAssessmentFor } from "@/src/domain/operations/lastro";

export type LastroAssessment = ReturnType<typeof lastroAssessmentFor>;
export type LastroFilter = "all" | "sample" | "intervention";
export type AttemptChannel = "Ligação" | "WhatsApp";
export type AttemptResult =
  "Contato iniciado" | "Sem contato" | "Confirmado" | "Confirmado com ressalva" | "Recusado" | "Telefone inválido";
export type ConfirmationScope = "Nota" | "Sacado";
export type DivergenceReason =
  | ""
  | "Documento ausente"
  | "Valor divergente"
  | "Vencimento divergente"
  | "Mercadoria ou serviço não reconhecido"
  | "Duplicidade"
  | "Documento inválido"
  | "Outro";
export type ChecklistKey =
  "identityConfirmed" | "deliveryConfirmed" | "amountAndDueDateConfirmed" | "noDisputeReported";
export type EvidenceDecision = "Validada" | "Pendente" | "Divergente";

/** Carimbo de data/hora usado nos registros da revisão. */
export const lastroTimestamp = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Chave do sacado do título (id ou documento). */
export const debtorKeyOf = (title: ManualEntry) => title.debtorId || title.debtorDocument;

/** Chave da nota do título (chave NF-e ou número base do documento). */
export const noteKeyOf = (title: ManualEntry) => title.nfeKey || title.documentNumber.split("/")[0];

/** Título que ainda exige intervenção do analista. */
export const needsIntervention = (row: LastroAssessmentRow) =>
  row.evidenceStatus !== "Validada" ||
  (row.sampled && row.confirmation !== "Confirmado") ||
  row.confirmation === "Recusado" ||
  row.confirmation === "Telefone inválido";

export const evidenceClass = (status: LastroAssessmentRow["evidenceStatus"]) =>
  status === "Validada" ? "positive" : status === "Divergente" ? "negative" : "warning-text";

export const confirmationClass = (confirmation: LastroAssessmentRow["confirmation"]) =>
  confirmation === "Confirmado"
    ? "positive"
    : confirmation === "Recusado" || confirmation === "Telefone inválido"
      ? "negative"
      : "warning-text";

export const confirmationLabel = (row: LastroAssessmentRow) =>
  row.confirmation ?? (row.sampled ? "Pendente" : "Não realizada");

/** Telefone no formato do wa.me (com DDI 55), ou vazio quando não há celular. */
export function whatsappPhoneFor(debtor: Debtor | undefined) {
  const whatsappContact =
    debtor?.whatsapp ?? debtor?.mobile ?? (debtor?.phone?.replace(/\D/g, "").length === 11 ? debtor.phone : undefined);
  return whatsappContact
    ? whatsappContact.replace(/\D/g, "").startsWith("55")
      ? whatsappContact.replace(/\D/g, "")
      : `55${whatsappContact.replace(/\D/g, "")}`
    : "";
}

export function filterLastroRows(rows: LastroAssessmentRow[], filter: LastroFilter) {
  return rows.filter(row =>
    filter === "sample" ? row.sampled : filter === "intervention" ? needsIntervention(row) : true,
  );
}

/** Indicadores exibidos no topo do painel. */
export function lastroIndicators(assessment: LastroAssessment) {
  const coverage = assessment.rows.length ? Math.round((assessment.evidenceValid / assessment.rows.length) * 100) : 0;
  const sampledDebtors = [...new Set(assessment.rows.filter(row => row.sampled).map(row => debtorKeyOf(row.title)))];
  const confirmedDebtors = sampledDebtors.filter(key =>
    assessment.rows
      .filter(row => row.sampled && debtorKeyOf(row.title) === key)
      .every(row => row.confirmation === "Confirmado"),
  ).length;
  const sampledNotes = [
    ...new Set(
      assessment.rows.filter(row => row.sampled).map(row => `${debtorKeyOf(row.title)}:${noteKeyOf(row.title)}`),
    ),
  ];
  const optionalConfirmed = assessment.rows.filter(row => !row.sampled && row.confirmation === "Confirmado").length;
  const interventionCount = assessment.rows.filter(needsIntervention).length;
  return { coverage, sampledDebtors, confirmedDebtors, sampledNotes, optionalConfirmed, interventionCount };
}
