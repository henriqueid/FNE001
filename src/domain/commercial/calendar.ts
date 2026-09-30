/**
 * Utilitários de data e número do Comercial (competência mensal, metas por período, arredondamento).
 */
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const monthOf = (iso: string) => iso.slice(0, 7);

export const monthStart = (month: string) => `${month}-01`;

export function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00`));

export const monthShort = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${month}-15T12:00:00`)).replace(".", "");

export const stamp = () =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );

export const digits = (v?: string) => (v ?? "").replace(/\D/g, "");

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
}

/** Meses de meta no intervalo: meses cheios contam 1, parciais contam proporcionalmente aos dias. */
export function goalMonths(from: string, to: string) {
  let total = 0,
    m = monthOf(from);
  while (m <= monthOf(to)) {
    const s = monthStart(m) < from ? from : monthStart(m),
      e = monthEnd(m) > to ? to : monthEnd(m);
    total += (daysBetween(s, e) + 1) / (daysBetween(monthStart(m), monthEnd(m)) + 1);
    m = shiftMonth(m, 1);
  }
  return total;
}

export const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
