"use client";
/**
 * Campos do cheque: CMC7, dados bancários, valor, datas e praça.
 */
import { EntryField, type EntryFieldChange } from "./entry-field";
import { type EntryDraft } from "./manual-entry-model";

export function ChequeEntryForm({ draft, onChange }: { draft: EntryDraft; onChange: EntryFieldChange }) {
  const fieldProps = { draft, onChange };
  return (
    <>
      <EntryField label="CMC7" fieldKey="cmc7" className="span-2" {...fieldProps} />
      <EntryField label="Banco" fieldKey="bank" {...fieldProps} />
      <EntryField label="Agência" fieldKey="agency" {...fieldProps} />
      <EntryField label="Conta" fieldKey="account" {...fieldProps} />
      <EntryField label="Comp." fieldKey="compensation" {...fieldProps} />
      <EntryField label="Nº cheque" fieldKey="documentNumber" {...fieldProps} />
      <EntryField label="Valor cheque" fieldKey="amount" type="number" {...fieldProps} />
      <EntryField label="Data emissão" fieldKey="issueDate" type="date" {...fieldProps} />
      <EntryField label="Bom para" fieldKey="dueDate" type="date" {...fieldProps} />
      <EntryField label="País" fieldKey="country" {...fieldProps} />
      <EntryField label="UF" fieldKey="state" {...fieldProps} />
      <EntryField label="Localidade" fieldKey="city" {...fieldProps} />
      <EntryField label="Observação" fieldKey="observation" className="span-2" {...fieldProps} />
    </>
  );
}
