"use client";
/**
 * Filtros da amostra e grade de títulos do lastro, com evidência, critério de contato,
 * confirmação, responsável e ações (analisar/confirmar e anexar documento).
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { type LastroAssessmentRow, type LastroReviewItem } from "@/src/domain/operations/lastro";
import { CheckIcon } from "@/src/ui/icons";
import { confirmationClass, confirmationLabel, evidenceClass, type LastroFilter } from "./lastro-model";

export function LastroSampleToolbar({
  filter,
  totalCount,
  sampleSize,
  interventionCount,
  onFilterChange,
}: {
  filter: LastroFilter;
  totalCount: number;
  sampleSize: number;
  interventionCount: number;
  onFilterChange: (filter: LastroFilter) => void;
}) {
  return (
    <div className="lastro-toolbar">
      <div>
        <button className={filter === "all" ? "active" : ""} onClick={() => onFilterChange("all")}>
          Todos <b>{totalCount}</b>
        </button>
        <button className={filter === "sample" ? "active" : ""} onClick={() => onFilterChange("sample")}>
          Amostra obrigatória <b>{sampleSize}</b>
        </button>
        <button className={filter === "intervention" ? "active" : ""} onClick={() => onFilterChange("intervention")}>
          Intervenção <b>{interventionCount}</b>
        </button>
      </div>
      <small>Fora da amostra, o contato continua disponível como confirmação voluntária.</small>
    </div>
  );
}

function LastroSampleRow({
  row,
  review,
  onSelect,
  onUpdateItem,
}: {
  row: LastroAssessmentRow;
  review: LastroReviewItem | undefined;
  onSelect: (id: string) => void;
  onUpdateItem: (id: string, change: Partial<LastroReviewItem>) => void;
}) {
  return (
    <div
      className={`lastro-grid-row ${row.evidenceStatus.toLowerCase()} ${row.confirmation === "Recusado" ? "rejected" : ""}`}
    >
      <span>
        <strong>{row.title.documentNumber}</strong>
        <small>
          {row.title.debtorName} · {preciseMoney.format(row.title.amount)}
        </small>
      </span>
      <span>
        <b className={evidenceClass(row.evidenceStatus)}>{row.evidenceStatus}</b>
        <small>
          {row.automaticEvidence
            ? "Documento validado na origem"
            : row.attachmentName
              ? row.attachmentName
              : "Evidência principal ausente"}
        </small>
      </span>
      <span>
        {row.sampled ? (
          <>
            <b>Amostra obrigatória</b>
            <small>{row.reasons.join(" · ") || "Seleção estatística"}</small>
          </>
        ) : (
          <>
            <b>Fora da amostra obrigatória</b>
            <small>Contato voluntário disponível</small>
          </>
        )}
      </span>
      <span>
        <b className={confirmationClass(row.confirmation)}>{confirmationLabel(row)}</b>
        <small>
          {row.sampled
            ? "Confirmação obrigatória"
            : row.confirmation
              ? "Confirmação voluntária"
              : "Pode ser confirmado"}
        </small>
      </span>
      <span>
        <b>{review?.updatedBy ?? "Motor de regras"}</b>
        <small>{review?.updatedAt ?? "Agora"}</small>
      </span>
      <span className="lastro-row-actions">
        <button onClick={() => onSelect(row.title.id)}>{row.sampled ? "Analisar" : "Confirmar"}</button>
        {!row.automaticEvidence && row.evidenceStatus !== "Validada" && (
          <label>
            Anexar
            <input
              type="file"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onUpdateItem(row.title.id, { attachmentName: file.name, evidenceDecision: "Pendente" });
              }}
            />
          </label>
        )}
      </span>
    </div>
  );
}

export function LastroSampleGrid({
  rows,
  reviewItems,
  onSelect,
  onUpdateItem,
}: {
  rows: LastroAssessmentRow[];
  reviewItems: NonNullable<Operation["lastroReview"]>["items"];
  onSelect: (id: string) => void;
  onUpdateItem: (id: string, change: Partial<LastroReviewItem>) => void;
}) {
  return (
    <>
      <div className="lastro-grid-scroll">
        <div className="lastro-grid-head">
          <span>TÍTULO / SACADO</span>
          <span>EVIDÊNCIA</span>
          <span>CRITÉRIO DE CONTATO</span>
          <span>CONFIRMAÇÃO</span>
          <span>RESPONSÁVEL</span>
          <span>AÇÕES</span>
        </div>
        {rows.map(row => (
          <LastroSampleRow
            key={row.title.id}
            row={row}
            review={reviewItems?.[row.title.id]}
            onSelect={onSelect}
            onUpdateItem={onUpdateItem}
          />
        ))}
      </div>
      {!rows.length && (
        <div className="lastro-empty">
          <CheckIcon />
          <strong>Nenhuma intervenção neste filtro</strong>
          <span>Todos os títulos exibidos atendem aos critérios atuais.</span>
        </div>
      )}
    </>
  );
}
