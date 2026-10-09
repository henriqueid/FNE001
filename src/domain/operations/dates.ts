/**
 * Datas e identificadores da operação (prefixo do aditivo AAAAMMDD, data de liberação e de originação).
 */
import { type Operation } from "@/src/domain/core/types";

export function datePrefix(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}`;
}

export function localDateISO(date = new Date()) {
  const prefix = datePrefix(date);
  return `${prefix.slice(0, 4)}-${prefix.slice(4, 6)}-${prefix.slice(6, 8)}`;
}

export function releaseDateISO(operation: Operation) {
  if (operation.status !== "Liberada ao financeiro") return null;
  const match = operation.releaseReview?.releasedAt?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function operationDateISO(operation: Operation) {
  const digits = operation.aditivoNumber.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return localDateISO();
}
