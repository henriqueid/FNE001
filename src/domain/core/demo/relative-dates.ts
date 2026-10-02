/**
 * Datas relativas da demonstração: as sementes foram escritas para o dia-âncora
 * (quarta, 30/09/2026 — o último evento realizado nas sementes). No app, todas as datas das sementes andam junto com o dia de hoje,
 * para a demonstração nunca ficar vazia ("nenhuma operação neste mês").
 *
 * Sob os testes (Vitest) o deslocamento é zero: as sementes ficam fixas e os testes
 * continuam determinísticos.
 */
export const DEMO_ANCHOR = "2026-09-30";
/**
 * Dia em que as operações em andamento das sementes "entraram" (prefixo do nº do aditivo).
 * As telas dizem "Hoje, 09:42", então esse dia passa a ser hoje.
 */
export const DEMO_ORIGINATION_ANCHOR = "2026-09-25";

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

function computeShift(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (env?.VITEST) return 0;
  const now = new Date();
  const [y, m, d] = DEMO_ANCHOR.split("-").map(Number);
  return Math.round((utc(now.getFullYear(), now.getMonth() + 1, now.getDate()) - utc(y, m, d)) / DAY);
}

/** Dias somados às datas das sementes (0 nos testes). */
export const DEMO_SHIFT_DAYS = computeShift();

const daysBetweenIso = (from: string, to: string) => {
  const [a, b] = [from, to].map(iso => iso.split("-").map(Number));
  return Math.round((utc(b[0], b[1], b[2]) - utc(a[0], a[1], a[2])) / DAY);
};
/** O nº do aditivo anda um pouco mais: as operações em andamento entram hoje. */
const ORIGINATION_EXTRA = daysBetweenIso(DEMO_ORIGINATION_ANCHOR, DEMO_ANCHOR);

const pad = (n: number) => String(n).padStart(2, "0");
function shifted(y: number, m: number, d: number, days: number) {
  const t = new Date(utc(y, m, d) + days * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Desloca datas ISO (AAAA-MM-DD), brasileiras (DD/MM/AAAA) e o prefixo de data do nº do aditivo. */
export function shiftDateText(text: string, days = DEMO_SHIFT_DAYS): string {
  if (!days) return text;
  const aditivo = /^(20\d{2})(\d{2})(\d{2})(\d{3})$/.exec(text);
  if (aditivo) {
    const r = shifted(+aditivo[1], +aditivo[2], +aditivo[3], days + ORIGINATION_EXTRA);
    return `${r.y}${pad(r.m)}${pad(r.d)}${aditivo[4]}`;
  }
  return text
    .replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (all, y, m, d) => {
      if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return all;
      const r = shifted(+y, +m, +d, days);
      return `${r.y}-${pad(r.m)}-${pad(r.d)}`;
    })
    .replace(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/g, (all, d, m, y) => {
      if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return all;
      const r = shifted(+y, +m, +d, days);
      return `${pad(r.d)}/${pad(r.m)}/${r.y}`;
    });
}

/** Cópia profunda com todas as datas de texto deslocadas. */
export function shiftDemoDates<T>(value: T, days = DEMO_SHIFT_DAYS): T {
  if (!days) return value;
  if (typeof value === "string") return shiftDateText(value, days) as T;
  if (Array.isArray(value)) return value.map(v => shiftDemoDates(v, days)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDemoDates(v, days)])) as T;
  }
  return value;
}
