"use client";
/**
 * Cartão de documentos: pacote de formalização com o status de cada peça.
 * Clicar num documento alterna entre Pronto e Pendente.
 */
import { CheckIcon, ClockIcon } from "@/src/ui/icons";
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { type ApprovalDocument } from "./approval-model";

export function ApprovalDocuments({
  documents,
  readyDocuments,
  onToggleDocument,
  collapsed,
  onToggle,
}: SectionToggle & {
  documents: ApprovalDocument[];
  readyDocuments: number;
  onToggleDocument: (id: string) => void;
}) {
  return (
    <section className={`approval-card${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="DOCUMENTOS"
        title="Pacote de formalização"
        meta={
          <>
            {readyDocuments}/{documents.length}
          </>
        }
        toggleLabel="documentos"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <div className="approval-doc-list">
          {documents.map(item => (
            <button key={item.id} onClick={() => onToggleDocument(item.id)}>
              <span className={item.status === "Pronto" ? "ready" : "pending"}>
                {item.status === "Pronto" ? <CheckIcon /> : <ClockIcon />}
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.source}
                  {item.required ? " · obrigatório" : " · opcional"}
                </small>
              </span>
              <b>{item.status}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
