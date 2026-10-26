/** Data civil, sem normalização silenciosa de dias inexistentes pelo JavaScript. */
export function isFinanceDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function parseFinanceDate(value: string) {
  const text = value.trim();
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  const iso = local
    ? `${local[3].length === 2 ? `20${local[3]}` : local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`
    : text;
  return isFinanceDate(iso) ? iso : "";
}
