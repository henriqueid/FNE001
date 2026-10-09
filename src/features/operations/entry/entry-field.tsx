"use client";
/**
 * Campo rotulado do rascunho do título. Valor e desconto usam máscara de moeda;
 * campos com limite numérico aceitam apenas dígitos.
 */
import {
  type EntryDraft,
  type EntryDraftKey,
  formatCurrency,
  numericLimits,
  parseCurrency,
} from "./manual-entry-model";

export type EntryFieldChange = (field: EntryDraftKey, value: string | number) => void;

export function EntryField({
  label,
  fieldKey,
  draft,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  fieldKey: EntryDraftKey;
  draft: EntryDraft;
  onChange: EntryFieldChange;
  type?: string;
  className?: string;
}) {
  const isCurrency = fieldKey === "amount" || fieldKey === "discount";
  const numericLimit = numericLimits[fieldKey];
  const value = isCurrency ? formatCurrency(Number(draft[fieldKey])) : String(draft[fieldKey] ?? "");
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type={isCurrency ? "text" : type}
        inputMode={isCurrency ? "decimal" : numericLimit ? "numeric" : undefined}
        maxLength={numericLimit}
        value={value}
        onChange={event =>
          onChange(
            fieldKey,
            isCurrency
              ? parseCurrency(event.target.value)
              : numericLimit
                ? event.target.value.replace(/\D/g, "").slice(0, numericLimit)
                : event.target.value,
          )
        }
      />
    </label>
  );
}
