/**
 * Funções puras da digitação manual: máscaras (CPF/CNPJ, CEP, telefone, moeda),
 * rascunhos vazios, validação do cadastro rápido de sacado e geração de parcelas.
 */
import { type ManualEntry, type ManualEntryData, type Operation } from "@/src/domain/core/types";

export type ReceivableType = ManualEntryData["receivableType"];

export const normalizeDocument = (value: string) => value.replace(/\D/g, "");

export const formatTaxId = (value: string) => {
  const digits = normalizeDocument(value).slice(0, 14);
  if (digits.length <= 11)
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

export const formatZip = (value: string) =>
  normalizeDocument(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");

export const formatPhone = (value: string) => {
  const digits = normalizeDocument(value).slice(0, 11);
  return digits.length > 10
    ? digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const parseCurrency = (value: string) => Number(value.replace(/\D/g, "")) / 100;

/** Tipo salvo na operação, convertendo nomes legados para os tipos atuais. */
export function storedReceivableType(operation: Operation): ReceivableType | undefined {
  const legacyType = operation.manualEntry?.receivableType as string | undefined;
  return legacyType === "Duplicata / nota fiscal" || legacyType === "Pedido"
    ? "Duplicata"
    : legacyType === "Desconto Trustee/Garantia"
      ? "Garantia"
      : operation.manualEntry?.receivableType;
}

export const createEmptyEntry = (id: string) => ({
  id,
  documentNumber: "",
  amount: 0,
  dueDate: "",
  debtorId: "",
  debtorName: "",
  debtorDocument: "",
  discount: 0,
  issueDate: "",
  nfeKey: "",
  ourNumber: "",
  cfop: "",
  observation: "",
  cmc7: "",
  bank: "",
  agency: "",
  account: "",
  compensation: "",
  country: "Brasil",
  state: "",
  city: "",
});

export type EntryDraft = ReturnType<typeof createEmptyEntry>;
export type EntryDraftKey = keyof EntryDraft;

export const emptyDebtorDraft = {
  document: "",
  name: "",
  tradeName: "",
  address: "",
  number: "",
  district: "",
  city: "",
  state: "",
  zipCode: "",
  email: "",
  phone: "",
};

export type DebtorDraft = typeof emptyDebtorDraft;

export function isDebtorFormValid(debtorDraft: DebtorDraft, requireEmail: boolean, requirePhone: boolean) {
  return (
    [
      debtorDraft.document,
      debtorDraft.name,
      debtorDraft.address,
      debtorDraft.number,
      debtorDraft.district,
      debtorDraft.city,
      debtorDraft.state,
      debtorDraft.zipCode,
    ].every(value => value.trim()) &&
    (!requireEmail || Boolean(debtorDraft.email.trim())) &&
    (!requirePhone || Boolean(debtorDraft.phone.trim()))
  );
}

/** Limite de dígitos dos campos numéricos do formulário. */
export const numericLimits: Partial<Record<EntryDraftKey, number>> = {
  cmc7: 30,
  bank: 3,
  agency: 5,
  account: 14,
  compensation: 3,
  nfeKey: 44,
};

export const receivableTypes: { value: ReceivableType; label: string }[] = [
  { value: "Duplicata", label: "Duplicatas" },
  { value: "Cheque", label: "Cheques" },
  { value: "Nota promissória", label: "Promissórias" },
  { value: "Transferibilidade", label: "Transferibilidade" },
  { value: "Garantia", label: "Garantia" },
];

export const entriesTotal = (entries: ManualEntry[]) => entries.reduce((sum, entry) => sum + entry.amount, 0);

/**
 * Divide o título em parcelas mensais. Valor e desconto são rateados em centavos e o
 * resíduo fica na última parcela.
 */
export function buildInstallments<T extends ManualEntry>(completed: T, installments: number) {
  const totalCents = Math.round(completed.amount * 100);
  const base = Math.floor(totalCents / installments);
  // O desconto informado vale para o total e é rateado entre as parcelas (antes era repetido em cada uma).
  const discountCents = Math.round((completed.discount ?? 0) * 100);
  const discountBase = Math.floor(discountCents / installments);
  return Array.from({ length: installments }, (_, index) => {
    const date = new Date(`${completed.dueDate}T12:00:00`);
    date.setMonth(date.getMonth() + index);
    return {
      ...completed,
      id: `manual-${Date.now()}-${index}`,
      documentNumber: `${completed.documentNumber}/${String(index + 1).padStart(3, "0")}`,
      amount: (index === installments - 1 ? totalCents - base * (installments - 1) : base) / 100,
      discount: (index === installments - 1 ? discountCents - discountBase * (installments - 1) : discountBase) / 100,
      dueDate: date.toISOString().slice(0, 10),
    };
  });
}
