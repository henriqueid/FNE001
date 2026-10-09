"use client";
/**
 * Grade dos títulos digitados, com resumo (quantidade e total) e colunas próprias
 * para cheques ou para títulos em papel.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type ManualEntry } from "@/src/domain/core/types";
import { entriesTotal, formatTaxId } from "./manual-entry-model";

type EntryRowProps = {
  entry: ManualEntry;
  editing: boolean;
  onEdit: (entry: ManualEntry) => void;
  onDelete: (id: string) => void;
};

function EntryRowActions({ entry, onEdit, onDelete }: Omit<EntryRowProps, "editing">) {
  return (
    <span className="title-row-actions">
      <button onClick={() => onEdit(entry)}>Editar</button>
      <button onClick={() => onDelete(entry.id)}>Excluir</button>
    </span>
  );
}

function ChequeRow({ entry, editing, onEdit, onDelete }: EntryRowProps) {
  return (
    <p className={`cheque-grid ${editing ? "editing" : ""}`}>
      <span>
        <b>{entry.documentNumber}</b>
        <small>{entry.cmc7 || "CMC7 não informado"}</small>
      </span>
      <span>
        <b>{entry.debtorName || "Sacado pendente"}</b>
        <small>{formatTaxId(entry.debtorDocument)}</small>
      </span>
      <b>{preciseMoney.format(entry.amount)}</b>
      <span>
        <b>{entry.bank || "—"}</b>
        <small>Ag. {entry.agency || "—"}</small>
      </span>
      <span>
        <b>{entry.account || "—"}</b>
        <small>Comp. {entry.compensation || "—"}</small>
      </span>
      <span>{entry.issueDate || "—"}</span>
      <span>{entry.dueDate || "—"}</span>
      <span>{[entry.city, entry.state].filter(Boolean).join(" / ") || "—"}</span>
      <span title={entry.observation}>{entry.observation || "—"}</span>
      <EntryRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
    </p>
  );
}

function PaperRow({ entry, editing, onEdit, onDelete }: EntryRowProps) {
  return (
    <p className={`paper-grid ${editing ? "editing" : ""}`}>
      <span>
        <b>{entry.documentNumber}</b>
      </span>
      <span>
        <b>{entry.debtorName || "Sacado pendente"}</b>
        <small>{formatTaxId(entry.debtorDocument)}</small>
      </span>
      <b>{preciseMoney.format(entry.amount)}</b>
      <span>{preciseMoney.format(entry.discount || 0)}</span>
      <span>{entry.issueDate || "—"}</span>
      <span>{entry.dueDate || "—"}</span>
      <span>{entry.ourNumber || "—"}</span>
      <span>
        <b>{entry.nfeKey || "—"}</b>
        <small>{entry.cfop ? `CFOP ${entry.cfop}` : "CFOP não informado"}</small>
      </span>
      <span title={entry.observation}>{entry.observation || "—"}</span>
      <EntryRowActions entry={entry} onEdit={onEdit} onDelete={onDelete} />
    </p>
  );
}

export function EntriesGrid({
  entries,
  isCheque,
  editorOpen,
  editingId,
  onEdit,
  onDelete,
  onDeleteAll,
}: {
  entries: ManualEntry[];
  isCheque: boolean;
  editorOpen: boolean;
  editingId: string | null;
  onEdit: (entry: ManualEntry) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="compact-saved-list">
      <div className="saved-list-summary">
        <div>
          <strong>{entries.length} títulos digitados</strong>
          <small>{editorOpen ? "Formulário aberto" : "Visualização da carteira digitada"}</small>
        </div>
        <div className="saved-list-summary-actions">
          <span>{preciseMoney.format(entriesTotal(entries))}</span>
          <button onClick={onDeleteAll}>Excluir todos</button>
        </div>
      </div>
      <div className="saved-list-scroll">
        {isCheque ? (
          <>
            <div className="saved-list-head cheque-grid">
              <span>CHEQUE / CMC7</span>
              <span>SACADO / DOCUMENTO</span>
              <span>VALOR</span>
              <span>BANCO / AGÊNCIA</span>
              <span>CONTA / COMP.</span>
              <span>EMISSÃO</span>
              <span>BOM PARA</span>
              <span>PRAÇA</span>
              <span>OBSERVAÇÃO</span>
              <span>AÇÕES</span>
            </div>
            {entries.map(entry => (
              <ChequeRow
                key={entry.id}
                entry={entry}
                editing={editingId === entry.id}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </>
        ) : (
          <>
            <div className="saved-list-head paper-grid">
              <span>DOCUMENTO</span>
              <span>SACADO / CPF-CNPJ</span>
              <span>VALOR</span>
              <span>DESCONTO</span>
              <span>EMISSÃO</span>
              <span>VENCIMENTO</span>
              <span>NOSSO Nº</span>
              <span>NF-e / CFOP</span>
              <span>OBSERVAÇÃO</span>
              <span>AÇÕES</span>
            </div>
            {entries.map(entry => (
              <PaperRow
                key={entry.id}
                entry={entry}
                editing={editingId === entry.id}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
