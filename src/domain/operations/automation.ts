/**
 * Índice de automação assistida da digitação manual (dados, sacados, evidências, consistência e origem).
 */
import { type ManualEntryData } from "@/src/domain/core/types";

export type AutomationBreakdown = {
  score: number;
  items: { label: string; points: number; maximum: number; detail: string }[];
};

export function manualAutomation(data?: ManualEntryData): AutomationBreakdown {
  const entries = data?.entries ?? [];
  if (!entries.length)
    return {
      score: 0,
      items: [
        { label: "Dados essenciais", points: 0, maximum: 30, detail: "Nenhum título salvo" },
        { label: "Sacados identificados", points: 0, maximum: 20, detail: "Nenhum sacado vinculado" },
        { label: "Evidências do recebível", points: 0, maximum: 20, detail: "Nenhuma evidência disponível" },
        { label: "Consistência", points: 0, maximum: 15, detail: "Aguardando títulos" },
        { label: "Origem dos dados", points: 5, maximum: 15, detail: "Digitação manual assistida" },
      ],
    };
  const requiredFilled = entries.reduce(
    (sum, entry) =>
      sum + [entry.documentNumber, entry.amount > 0, entry.issueDate, entry.dueDate].filter(Boolean).length,
    0,
  );
  const essential = Math.round((30 * requiredFilled) / (entries.length * 4));
  const identifiedCount = entries.filter(entry => entry.debtorId && entry.debtorDocument).length;
  const identified = Math.round((20 * identifiedCount) / entries.length);
  const evidenceCount = entries.filter(entry =>
    data?.receivableType === "Duplicata"
      ? Boolean(entry.nfeKey)
      : data?.receivableType === "Cheque"
        ? Boolean(entry.cmc7 && entry.bank && entry.account)
        : Boolean(entry.documentNumber),
  ).length;
  const evidence = Math.round((20 * evidenceCount) / entries.length);
  const signatures = entries.map(
    entry => `${entry.debtorDocument.replace(/\D/g, "")}|${entry.documentNumber.trim().toLowerCase()}`,
  );
  const duplicateCount = signatures.length - new Set(signatures).size;
  const consistency = Math.round(15 * (1 - duplicateCount / entries.length));
  const items = [
    {
      label: "Dados essenciais",
      points: essential,
      maximum: 30,
      detail: `${requiredFilled} de ${entries.length * 4} campos obrigatórios preenchidos`,
    },
    {
      label: "Sacados identificados",
      points: identified,
      maximum: 20,
      detail: `${identifiedCount} de ${entries.length} títulos vinculados`,
    },
    {
      label: "Evidências do recebível",
      points: evidence,
      maximum: 20,
      detail: `${evidenceCount} de ${entries.length} com evidência principal`,
    },
    {
      label: "Consistência",
      points: consistency,
      maximum: 15,
      detail: duplicateCount ? `${duplicateCount} possível duplicidade` : "Nenhuma duplicidade encontrada",
    },
    { label: "Origem dos dados", points: 5, maximum: 15, detail: "Digitação manual assistida" },
  ];
  return { score: items.reduce((sum, item) => sum + item.points, 0), items };
}
