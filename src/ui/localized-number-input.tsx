"use client";

import { useState, type InputHTMLAttributes } from "react";

export function parseLocalizedNumber(raw: string) {
  const cleaned = raw.replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return undefined;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const grouping = decimal === "," ? /\./g : /,/g;
    normalized = cleaned.replace(grouping, "").replace(decimal, ".");
  } else if (comma >= 0) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if ((cleaned.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(cleaned))
    normalized = cleaned.replace(/\./g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function formatLocalizedNumber(value: number, decimals = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

export function LocalizedNumberInput({
  value,
  onValueChange,
  decimals = 2,
  min = 0,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onValueChange: (value: number) => void;
  decimals?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? (value === null ? "" : formatLocalizedNumber(value, decimals));

  return (
    <input
      {...inputProps}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      value={displayValue}
      onFocus={event => {
        setDraft(value === null ? "" : decimals ? String(value).replace(".", ",") : String(Math.round(value)));
        inputProps.onFocus?.(event);
      }}
      onChange={event => {
        const raw = event.target.value;
        setDraft(raw);
        const parsed = parseLocalizedNumber(raw);
        if (parsed !== undefined && parsed >= Number(min)) onValueChange(parsed);
      }}
      onBlur={event => {
        const parsed = parseLocalizedNumber(displayValue);
        const safe = parsed === undefined ? value : Math.max(Number(min), parsed);
        if (safe !== null && safe !== value) onValueChange(safe);
        setDraft(null);
        inputProps.onBlur?.(event);
      }}
    />
  );
}
