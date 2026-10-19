/** Converte encargos explícitos da conta em campos CNAB, com mês comercial de 30 dias e arredondamento em centavos. */
import type { CompanyBankAccount } from "@/src/domain/finance/model";
type Charges = Pick<
  NonNullable<CompanyBankAccount["collection"]>,
  "dailyInterestCents" | "monthlyInterestPercent" | "lateFinePercent" | "lateFineDaysAfterDue"
>;
function percentage(value: number, label: string, exclusiveHundred = false) {
  const scaled = Math.round(value * 100);
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (exclusiveHundred ? value >= 100 : value > 100) ||
    Math.abs(scaled / 100 - value) > 1e-9
  )
    throw new Error(`${label} inválido: use percentual com até duas casas decimais.`);
  return scaled;
}
export function resolveCollectionCharges(
  config: Charges,
  amountCents: number,
  dueDate: string,
): { dailyInterestCents: number; lateFine?: { percent: number; from: string } } {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 9999999999999)
    throw new Error("Valor nominal inválido para os encargos.");
  if (config.monthlyInterestPercent !== undefined && config.dailyInterestCents !== undefined)
    throw new Error("Escolha juros diários ou mensais, sem combinar as duas modalidades.");
  let dailyInterestCents: number;
  if (config.monthlyInterestPercent !== undefined) {
    const rate = percentage(config.monthlyInterestPercent, "Juros mensais");
    dailyInterestCents = Number((BigInt(amountCents) * BigInt(rate) + BigInt(150000)) / BigInt(300000));
  } else {
    if (
      !Number.isSafeInteger(config.dailyInterestCents) ||
      Number(config.dailyInterestCents) < 0 ||
      Number(config.dailyInterestCents) > 9999999999999
    )
      throw new Error("Informe os juros diários ou o percentual mensal, inclusive zero sem juros.");
    dailyInterestCents = config.dailyInterestCents!;
  }
  if (config.lateFinePercent === undefined || config.lateFinePercent === 0) return { dailyInterestCents };
  percentage(config.lateFinePercent, "Multa", true);
  const days = config.lateFineDaysAfterDue;
  if (!Number.isInteger(days) || Number(days) < 0 || Number(days) > 365)
    throw new Error("Informe o início da multa em dias inteiros após o vencimento (0 a 365).");
  const due = new Date(`${dueDate}T00:00:00Z`);
  if (
    !/^20\d{2}-\d{2}-\d{2}$/.test(dueDate) ||
    !Number.isFinite(due.getTime()) ||
    due.toISOString().slice(0, 10) !== dueDate
  )
    throw new Error("Vencimento inválido para multa.");
  due.setUTCDate(due.getUTCDate() + days!);
  const from = due.toISOString().slice(0, 10);
  if (!from.startsWith("20")) throw new Error("Início da multa fora do intervalo CNAB implementado.");
  return { dailyInterestCents, lateFine: { percent: config.lateFinePercent, from } };
}
