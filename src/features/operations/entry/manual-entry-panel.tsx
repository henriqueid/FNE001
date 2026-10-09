"use client";
/**
 * Painel de digitação manual de recebíveis: tipo, sacado, formulário do título ou
 * cheque, parcelas e grade digitada. O estado vive em `useManualEntry`.
 */
import { type Debtor, type ManualEntryData, type Operation } from "@/src/domain/core/types";
import { ChequeEntryForm } from "./cheque-entry-form";
import { DebtorLookup } from "./debtor-lookup";
import { DeleteEntriesModal } from "./delete-entries-modal";
import { EntriesGrid } from "./entries-grid";
import { EntryEditorBar } from "./entry-editor-bar";
import { EntryFormActions } from "./entry-form-actions";
import { QuickDebtorForm } from "./quick-debtor-form";
import { ReceivableTypeEmpty, ReceivableTypeTabs } from "./receivable-type-tabs";
import { TitleEntryForm } from "./title-entry-form";
import { useManualEntry } from "./use-manual-entry";

export function ManualEntryPanel({
  operation,
  debtors,
  onRegisterDebtor,
  onSave,
}: {
  operation: Operation;
  debtors: Debtor[];
  onRegisterDebtor: (debtor: Debtor) => void;
  onSave: (data: ManualEntryData) => void;
}) {
  const entry = useManualEntry({ operation, debtors, onRegisterDebtor, onSave });
  const { receivableType, entries, editorOpen, editingId, draft } = entry;
  const isCheque = receivableType === "Cheque";

  return (
    <div className="manual-entry-card compact-entry">
      <ReceivableTypeTabs receivableType={receivableType} locked={entry.hasSavedEntries} onChoose={entry.chooseType} />
      {!receivableType ? (
        <ReceivableTypeEmpty />
      ) : (
        <div className="entry-sheet">
          <EntryEditorBar
            editorOpen={editorOpen}
            editing={Boolean(editingId)}
            documentNumber={draft.documentNumber}
            onToggle={() => entry.setEditorOpen(open => !open)}
          />

          {editorOpen && (
            <div className="entry-editor-body">
              <DebtorLookup
                query={entry.debtorQuery}
                selectedDebtor={entry.selectedDebtor}
                searched={entry.debtorSearched}
                onQueryChange={entry.changeDebtorQuery}
                onSearch={entry.searchDebtor}
                onRegisterWithQuery={entry.openDebtorFormWithQuery}
                onOpenRegister={() => entry.setShowDebtorForm(true)}
              />
              {entry.showDebtorForm && (
                <QuickDebtorForm
                  draft={entry.debtorDraft}
                  requireEmail={entry.requireEmail}
                  requirePhone={entry.requirePhone}
                  valid={entry.debtorFormValid}
                  onDraftChange={entry.setDebtorDraft}
                  onRequireEmailChange={entry.setRequireEmail}
                  onRequirePhoneChange={entry.setRequirePhone}
                  onClose={() => entry.setShowDebtorForm(false)}
                  onSubmit={entry.registerDebtor}
                />
              )}

              <div className={`compact-document-fields ${isCheque ? "cheque" : ""}`}>
                {isCheque && <ChequeEntryForm draft={draft} onChange={entry.setField} />}
                {!isCheque && (
                  <TitleEntryForm receivableType={receivableType} draft={draft} onChange={entry.setField} />
                )}
              </div>
              <EntryFormActions
                editing={Boolean(editingId)}
                isCheque={isCheque}
                hasEntries={entries.length > 0}
                canSave={Boolean(entry.selectedDebtor)}
                installments={entry.installments}
                onCancelEdit={entry.cancelEdit}
                onCopyPrevious={entry.copyPrevious}
                onInstallmentsChange={entry.setInstallments}
                onGenerateInstallments={entry.generateInstallments}
                onSave={entry.saveSingle}
              />
            </div>
          )}

          {entries.length > 0 && (
            <EntriesGrid
              entries={entries}
              isCheque={isCheque}
              editorOpen={editorOpen}
              editingId={editingId}
              onEdit={entry.editEntry}
              onDelete={entry.deleteEntry}
              onDeleteAll={() => entry.setShowDeleteAll(true)}
            />
          )}
        </div>
      )}
      {entry.showDeleteAll && (
        <DeleteEntriesModal
          entries={entries}
          onClose={() => entry.setShowDeleteAll(false)}
          onConfirm={entry.deleteAllEntries}
        />
      )}
    </div>
  );
}
