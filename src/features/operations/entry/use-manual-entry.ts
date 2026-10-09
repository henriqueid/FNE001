/**
 * Estado e ações da digitação manual: tipo do recebível, busca e cadastro rápido
 * de sacado, rascunho do título, parcelamento, edição e exclusão dos títulos.
 */
import { type Debtor, type ManualEntryData, type Operation } from "@/src/domain/core/types";
import { useState } from "react";
import {
  buildInstallments,
  createEmptyEntry,
  type DebtorDraft,
  emptyDebtorDraft,
  type EntryDraftKey,
  formatTaxId,
  isDebtorFormValid,
  normalizeDocument,
  type ReceivableType,
  storedReceivableType,
} from "./manual-entry-model";

export function useManualEntry({
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
  const storedType = storedReceivableType(operation);
  const [receivableType, setReceivableType] = useState<ReceivableType | "">(storedType ?? "");
  const [entries, setEntries] = useState(operation.manualEntry?.entries ?? []);
  const initialDebtor = operation.manualEntry?.entries[0]
    ? (debtors.find(debtor => debtor.id === operation.manualEntry?.entries[0].debtorId) ?? null)
    : null;
  const [debtorQuery, setDebtorQuery] = useState(formatTaxId(initialDebtor?.document ?? ""));
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(initialDebtor);
  const [debtorSearched, setDebtorSearched] = useState(Boolean(initialDebtor));
  const [showDebtorForm, setShowDebtorForm] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(!operation.manualEntry?.entries.length);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [emptyEntry] = useState(() => createEmptyEntry(`manual-${Date.now()}`));
  const [draft, setDraft] = useState(emptyEntry);
  const [debtorDraft, setDebtorDraft] = useState<DebtorDraft>(emptyDebtorDraft);
  const hasSavedEntries = entries.length > 0;
  const debtorFormValid = isDebtorFormValid(debtorDraft, requireEmail, requirePhone);
  const setField = (field: EntryDraftKey, value: string | number) =>
    setDraft(current => ({ ...current, [field]: value }));

  function changeDebtorQuery(value: string) {
    setDebtorQuery(formatTaxId(value));
    setSelectedDebtor(null);
    setDebtorSearched(false);
  }
  function searchDebtor() {
    const found = debtors.find(debtor => normalizeDocument(debtor.document) === normalizeDocument(debtorQuery)) ?? null;
    setSelectedDebtor(found);
    setDebtorSearched(true);
    setShowDebtorForm(false);
    if (!found) setDebtorDraft(current => ({ ...current, document: debtorQuery }));
  }
  function openDebtorFormWithQuery() {
    setDebtorDraft(current => ({ ...current, document: debtorQuery }));
    setShowDebtorForm(true);
  }
  function registerDebtor() {
    if (!debtorFormValid) return;
    const debtor: Debtor = { id: `sacado-${Date.now()}`, ...debtorDraft, source: "Cadastro manual" };
    onRegisterDebtor(debtor);
    setSelectedDebtor(debtor);
    setDebtorQuery(formatTaxId(debtor.document));
    setShowDebtorForm(false);
  }
  function chooseType(type: ReceivableType) {
    if (hasSavedEntries && type !== receivableType) return;
    setReceivableType(type);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}` });
    setEditorOpen(true);
  }
  function completeDraft() {
    if (!selectedDebtor) return null;
    const document = receivableType === "Cheque" ? draft.documentNumber || draft.cmc7 : draft.documentNumber;
    if (!document.trim() || draft.amount <= 0 || !draft.dueDate) return null;
    return {
      ...draft,
      documentNumber: document,
      debtorId: selectedDebtor.id,
      debtorName: selectedDebtor.name,
      debtorDocument: selectedDebtor.document,
    };
  }
  function saveSingle() {
    const completed = completeDraft();
    if (!completed || !receivableType) return;
    const next = editingId
      ? entries.map(entry => (entry.id === editingId ? { ...completed, id: editingId } : entry))
      : [...entries, completed];
    setEntries(next);
    onSave({ receivableType, mode: "individual", entries: next });
    if (editingId) setEditorOpen(false);
    setEditingId(null);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}`, issueDate: draft.issueDate, dueDate: draft.dueDate });
  }
  function generateInstallments() {
    const completed = completeDraft();
    if (!completed || !receivableType || installments < 2) return;
    const generated = buildInstallments(completed, installments);
    const next = [...entries, ...generated];
    setEntries(next);
    onSave({ receivableType, mode: "parcelado", entries: next });
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}`, issueDate: completed.issueDate, dueDate: completed.dueDate });
    setInstallments(1);
  }
  function copyPrevious() {
    const previous = entries[entries.length - 1];
    if (!previous) return;
    setDraft({ ...emptyEntry, ...previous, id: `manual-${Date.now()}` });
    setEditingId(null);
    setSelectedDebtor(debtors.find(debtor => debtor.id === previous.debtorId) ?? selectedDebtor);
    setDebtorQuery(formatTaxId(previous.debtorDocument));
    setEditorOpen(true);
  }
  function editEntry(entry: ManualEntryData["entries"][number]) {
    setDraft({ ...emptyEntry, ...entry });
    setEditingId(entry.id);
    setSelectedDebtor(debtors.find(debtor => debtor.id === entry.debtorId) ?? null);
    setDebtorQuery(formatTaxId(entry.debtorDocument));
    setDebtorSearched(true);
    setEditorOpen(true);
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}` });
  }
  function deleteEntry(id: string) {
    if (!receivableType) return;
    const next = entries.filter(entry => entry.id !== id);
    setEntries(next);
    onSave({ receivableType, mode: operation.manualEntry?.mode ?? "individual", entries: next });
    if (editingId === id) {
      setEditingId(null);
      setDraft({ ...emptyEntry, id: `manual-${Date.now()}` });
    }
  }
  function deleteAllEntries() {
    if (!receivableType) return;
    setEntries([]);
    onSave({ receivableType, mode: operation.manualEntry?.mode ?? "individual", entries: [] });
    setEditingId(null);
    setDraft({ ...emptyEntry, id: `manual-${Date.now()}` });
    setSelectedDebtor(null);
    setDebtorQuery("");
    setDebtorSearched(false);
    setInstallments(1);
    setEditorOpen(true);
    setShowDeleteAll(false);
  }

  return {
    receivableType,
    entries,
    hasSavedEntries,
    debtorQuery,
    selectedDebtor,
    debtorSearched,
    showDebtorForm,
    setShowDebtorForm,
    requireEmail,
    setRequireEmail,
    requirePhone,
    setRequirePhone,
    debtorDraft,
    setDebtorDraft,
    debtorFormValid,
    installments,
    setInstallments,
    editingId,
    editorOpen,
    setEditorOpen,
    showDeleteAll,
    setShowDeleteAll,
    draft,
    setField,
    changeDebtorQuery,
    searchDebtor,
    openDebtorFormWithQuery,
    registerDebtor,
    chooseType,
    saveSingle,
    generateInstallments,
    copyPrevious,
    editEntry,
    cancelEdit,
    deleteEntry,
    deleteAllEntries,
  };
}
