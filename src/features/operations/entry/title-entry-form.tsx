"use client";
/**
 * Campos do título em papel (duplicata, promissória, transferibilidade e garantia).
 * Chave NF-e e CFOP aparecem apenas para duplicatas.
 */
import { EntryField, type EntryFieldChange } from "./entry-field";
import { type EntryDraft, type ReceivableType } from "./manual-entry-model";

export function TitleEntryForm({
  receivableType,
  draft,
  onChange,
}: {
  receivableType: ReceivableType;
  draft: EntryDraft;
  onChange: EntryFieldChange;
}) {
  const fieldProps = { draft, onChange };
  return (
    <>
      <EntryField label="Documento" fieldKey="documentNumber" {...fieldProps} />
      <EntryField label="Valor de face" fieldKey="amount" {...fieldProps} />
      <EntryField label="Valor desconto" fieldKey="discount" {...fieldProps} />
      <EntryField label="Data de emissão" fieldKey="issueDate" type="date" {...fieldProps} />
      <EntryField label="Data de vencimento" fieldKey="dueDate" type="date" {...fieldProps} />
      <EntryField label="Nosso número" fieldKey="ourNumber" {...fieldProps} />
      {receivableType === "Duplicata" && (
        <EntryField label="Chave NF-e" fieldKey="nfeKey" className="span-2" {...fieldProps} />
      )}
      {receivableType === "Duplicata" && <EntryField label="CFOPs" fieldKey="cfop" {...fieldProps} />}
      <EntryField label="Observação" fieldKey="observation" className="span-2" {...fieldProps} />
    </>
  );
}
