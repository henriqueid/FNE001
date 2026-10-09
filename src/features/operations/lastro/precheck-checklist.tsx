"use client";
/**
 * Checklist objetivo da confirmação obtida na pré-checagem (identidade, entrega,
 * valor/vencimento e ausência de disputa).
 */
import { type LastroAssessmentRow, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { Badge } from "@/src/features/operations/components/status";
import { type ChecklistKey, confirmationLabel } from "./lastro-model";

const checklistItems: { key: ChecklistKey; label: string }[] = [
  { key: "identityConfirmed", label: "Identidade do sacado confirmada" },
  { key: "deliveryConfirmed", label: "Entrega ou serviço reconhecido" },
  { key: "amountAndDueDateConfirmed", label: "Valor e vencimento conferidos" },
  { key: "noDisputeReported", label: "Sem devolução, disputa ou compensação" },
];

export function PrecheckChecklist({
  selected,
  review,
  onToggle,
}: {
  selected: LastroAssessmentRow;
  review: LastroReviewItem | undefined;
  onToggle: (key: ChecklistKey, checked: boolean) => void;
}) {
  const checkedCount = checklistItems.filter(item => review?.checklist?.[item.key]).length;
  return (
    <section className="precheck-confirmation">
      <div className="precheck-section-title">
        <div>
          <span>CONFIRMAÇÃO OBTIDA</span>
          <strong>Checklist objetivo da pré-checagem</strong>
          <small>
            Marque o que o sacado confirmou. Para registrar &quot;Confirmado&quot; basta um item; os quatro são o ideal.
            {` ${checkedCount} de ${checklistItems.length} marcado(s).`}
          </small>
        </div>
        <Badge
          tone={
            selected.confirmation === "Confirmado"
              ? "ready"
              : selected.confirmation === "Recusado" || selected.confirmation === "Telefone inválido"
                ? "cancelled"
                : "attention"
          }
        >
          {confirmationLabel(selected)}
        </Badge>
      </div>
      <div className="precheck-checklist">
        {checklistItems.map(item => (
          <label key={item.key}>
            <input
              type="checkbox"
              checked={Boolean(review?.checklist?.[item.key])}
              onChange={event => onToggle(item.key, event.target.checked)}
            />{" "}
            {item.label}
          </label>
        ))}
      </div>
    </section>
  );
}
