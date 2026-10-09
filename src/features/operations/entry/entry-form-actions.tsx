"use client";
/**
 * Ações do formulário de digitação: cancelar edição, copiar o título anterior,
 * parcelamento (fora de cheques) e adicionar/salvar o título.
 */

export function EntryFormActions({
  editing,
  isCheque,
  hasEntries,
  canSave,
  installments,
  onCancelEdit,
  onCopyPrevious,
  onInstallmentsChange,
  onGenerateInstallments,
  onSave,
}: {
  editing: boolean;
  isCheque: boolean;
  hasEntries: boolean;
  canSave: boolean;
  installments: number;
  onCancelEdit: () => void;
  onCopyPrevious: () => void;
  onInstallmentsChange: (value: number) => void;
  onGenerateInstallments: () => void;
  onSave: () => void;
}) {
  return (
    <div className="compact-entry-actions">
      {editing && (
        <button className="secondary-action" onClick={onCancelEdit}>
          Cancelar edição
        </button>
      )}
      <button className="secondary-action" disabled={!hasEntries} onClick={onCopyPrevious}>
        Copiar anterior
      </button>
      {!isCheque && (
        <label>
          <span>Parcelas</span>
          <input
            type="number"
            min="1"
            max="120"
            value={installments}
            onChange={event => onInstallmentsChange(Number(event.target.value))}
          />
        </label>
      )}
      {!isCheque && installments > 1 && (
        <button className="secondary-action" onClick={onGenerateInstallments}>
          Gerar {installments} parcelas
        </button>
      )}
      <button className="primary-action" disabled={!canSave} onClick={onSave}>
        {editing ? "Salvar alteração" : "Adicionar título"}
      </button>
    </div>
  );
}
