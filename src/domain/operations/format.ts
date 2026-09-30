/**
 * Formatação usada nas telas de operação (duração, datas curtas e valores do fluxo).
 */
import { preciseMoney } from "@/src/domain/core/format";

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function formatBrazilianDate(value?: string) {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function formatFlowMoney(value: number) {
  if (Math.abs(value) < 0.005) return preciseMoney.format(0);
  return `${value > 0 ? "+" : "−"} ${preciseMoney.format(Math.abs(value))}`;
}
