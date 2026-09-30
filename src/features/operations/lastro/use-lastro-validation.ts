/**
 * Estado e ações do painel de lastro: filtro da amostra, título em pré-checagem,
 * formulário de tentativa de contato, checklist e decisão documental.
 */
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { lastroAssessmentFor, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { useEffect, useState } from "react";
import {
  type AttemptChannel,
  type AttemptResult,
  type ChecklistKey,
  type ConfirmationScope,
  debtorKeyOf,
  type DivergenceReason,
  type EvidenceDecision,
  filterLastroRows,
  lastroIndicators,
  lastroTimestamp,
  type LastroFilter,
  noteKeyOf,
  whatsappPhoneFor,
} from "./lastro-model";

export function useLastroValidation({
  operation,
  debtors,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  onChange: (operation: Operation) => void;
}) {
  const [filter, setFilter] = useState<LastroFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});
  const [attemptChannel, setAttemptChannel] = useState<AttemptChannel>("Ligação");
  const [attemptResult, setAttemptResult] = useState<AttemptResult>("Sem contato");
  const [confirmationScope, setConfirmationScope] = useState<ConfirmationScope>("Nota");
  const [nextContactAt, setNextContactAt] = useState("");
  const [precheckNote, setPrecheckNote] = useState("");
  const [divergenceReason, setDivergenceReason] = useState<DivergenceReason>("");
  const [formFeedback, setFormFeedback] = useState("");
  const assessment = lastroAssessmentFor(operation, debtors);
  const selected = assessment.rows.find(row => row.title.id === selectedId);
  const selectedReview = selected ? operation.lastroReview?.items?.[selected.title.id] : undefined;
  const selectedPhone = selected?.debtor?.mobile ?? selected?.debtor?.phone;
  const whatsappPhone = whatsappPhoneFor(selected?.debtor);
  const visibleRows = filterLastroRows(assessment.rows, filter);
  const indicators = lastroIndicators(assessment);

  useEffect(() => {
    if (!selectedId) return;
    const review = operation.lastroReview?.items?.[selectedId];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia o formulário ao trocar o título selecionado
    setConfirmationScope(review?.confirmationScope ?? "Nota");
    setNextContactAt(review?.nextContactAt ?? "");
    setPrecheckNote(review?.confirmationNotes ?? review?.attachmentNotes ?? "");
    setDivergenceReason(review?.divergenceReason ?? "");
    setFormFeedback("");
    // Só a troca de título reinicia o formulário; mudanças no próprio registro não devem apagar o que está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function updateItem(id: string, change: Partial<LastroReviewItem>) {
    const current = operation.lastroReview?.items?.[id] ?? {};
    onChange({
      ...operation,
      lastroReview: {
        items: {
          ...operation.lastroReview?.items,
          [id]: {
            ...current,
            ...change,
            updatedAt: lastroTimestamp(),
            updatedBy: "Henrique",
          },
        },
      },
    });
  }

  function updateChecklist(id: string, key: ChecklistKey, checked: boolean) {
    const current = operation.lastroReview?.items?.[id];
    updateItem(id, { checklist: { ...current?.checklist, [key]: checked } });
  }

  function registerAttempt(id: string) {
    const current = operation.lastroReview?.items?.[id];
    const checklist = current?.checklist;
    if (
      attemptResult === "Confirmado" &&
      ![
        checklist?.identityConfirmed,
        checklist?.deliveryConfirmed,
        checklist?.amountAndDueDateConfirmed,
        checklist?.noDisputeReported,
      ].every(Boolean)
    ) {
      setFormFeedback("Para confirmar, conclua os quatro itens do checklist.");
      return;
    }
    if (["Confirmado com ressalva", "Recusado", "Telefone inválido"].includes(attemptResult) && !precheckNote.trim()) {
      setFormFeedback("Descreva a ressalva ou o motivo na observação da pré-checagem.");
      return;
    }
    if (attemptResult === "Sem contato" && !nextContactAt) {
      setFormFeedback("Informe quando será a próxima tentativa de contato.");
      return;
    }
    const at = lastroTimestamp();
    const baseTitle = assessment.rows.find(row => row.title.id === id)?.title;
    if (!baseTitle) return;
    const targetIds = assessment.rows
      .filter(row =>
        confirmationScope === "Sacado"
          ? debtorKeyOf(row.title) === debtorKeyOf(baseTitle)
          : debtorKeyOf(row.title) === debtorKeyOf(baseTitle) && noteKeyOf(row.title) === noteKeyOf(baseTitle),
      )
      .map(row => row.title.id);
    const attempt = {
      channel: attemptChannel,
      result: attemptResult,
      at,
      by: "Henrique",
      nextContactAt: nextContactAt || undefined,
    };
    const items = { ...operation.lastroReview?.items };
    targetIds.forEach(targetId => {
      const target = items[targetId] ?? {};
      items[targetId] = {
        ...target,
        confirmation: attemptResult,
        confirmationScope,
        confirmationNotes: precheckNote,
        nextContactAt: nextContactAt || undefined,
        checklist: current?.checklist,
        contactAttempts: (target.contactAttempts ?? 0) + 1,
        attempts: [...(target.attempts ?? []), attempt],
        updatedAt: at,
        updatedBy: "Henrique",
      };
    });
    onChange({ ...operation, lastroReview: { items } });
    setFormFeedback(`Tentativa registrada para ${targetIds.length} título(s) por ${confirmationScope.toLowerCase()}.`);
  }

  function setEvidenceDecision(decision: EvidenceDecision) {
    if (!selected) return;
    if (decision === "Divergente" && !divergenceReason) {
      setFormFeedback("Selecione o motivo da divergência documental.");
      return;
    }
    updateItem(selected.title.id, {
      evidenceDecision: decision,
      divergenceReason: decision === "Divergente" ? divergenceReason || undefined : undefined,
    });
    setFormFeedback(
      decision === "Validada"
        ? "Documento conferido."
        : decision === "Pendente"
          ? "Pendência documental registrada."
          : "Divergência documental registrada.",
    );
  }

  function savePrecheck(id: string) {
    updateItem(id, {
      confirmationNotes: precheckNote,
      nextContactAt: nextContactAt || undefined,
      confirmationScope,
    });
    setSelectedId(null);
  }

  function revealPhone(id: string) {
    setRevealedPhones(current => ({ ...current, [id]: true }));
  }

  return {
    assessment,
    indicators,
    filter,
    setFilter,
    visibleRows,
    selected,
    selectedReview,
    selectedPhone,
    whatsappPhone,
    setSelectedId,
    revealedPhones,
    revealPhone,
    attemptChannel,
    setAttemptChannel,
    attemptResult,
    setAttemptResult,
    confirmationScope,
    setConfirmationScope,
    nextContactAt,
    setNextContactAt,
    precheckNote,
    setPrecheckNote,
    divergenceReason,
    setDivergenceReason,
    formFeedback,
    updateItem,
    updateChecklist,
    registerAttempt,
    setEvidenceDecision,
    savePrecheck,
  };
}
