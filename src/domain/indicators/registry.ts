/**
 * Indicadores do Cadastro: revisão cadastral (KYC) vencida ou a vencer em 30 dias, limites
 * com revisão vencida (último comitê aprovado mais antigo que a política), cedentes sem
 * operar e distribuição do score entre as faixas da política.
 */
import { type Committee } from "@/src/domain/commercial/types";
import { type IndicatorParameters } from "@/src/domain/risk/quality-policy";
import { daysFrom } from "./portfolio";

export function registryIndicators(
  parties: { document: string; name: string; updatedAt: string; isCedent: boolean; score?: number }[],
  committees: Committee[],
  lastOperation: Record<string, string>,
  today: string,
  params: Pick<IndicatorParameters, "kycReviewDays" | "limitReviewDays" | "inactiveDays">,
  scoreBands: { good: number; bad: number },
) {
  const kycAge = (p: (typeof parties)[number]) => daysFrom(p.updatedAt, today);
  const kycExpired = parties.filter(p => kycAge(p) > params.kycReviewDays);
  const kycSoon = parties.filter(p => kycAge(p) <= params.kycReviewDays && kycAge(p) > params.kycReviewDays - 30);
  const cedents = parties.filter(p => p.isCedent);
  const lastApproval = (doc: string) =>
    committees
      .filter(c => (c.document ?? "").replace(/\D/g, "") === doc.replace(/\D/g, "") && c.status.startsWith("Aprovado"))
      .map(c => c.decidedAt ?? c.date)
      .sort()
      .pop();
  const limitExpired = cedents.filter(p => {
    const last = lastApproval(p.document);
    return !last || daysFrom(last.slice(0, 10), today) > params.limitReviewDays;
  });
  const idle = cedents.filter(p => {
    const last = lastOperation[p.document.replace(/\D/g, "")];
    return !last || daysFrom(last, today) > params.inactiveDays[2];
  });
  const scored = cedents.filter(p => typeof p.score === "number");
  const mid = (scoreBands.good + scoreBands.bad) / 2;
  return {
    total: parties.length,
    kycExpired,
    kycSoon,
    limitExpired,
    idle,
    score: {
      good: scored.filter(p => (p.score ?? 0) >= scoreBands.good).length,
      fair: scored.filter(p => (p.score ?? 0) < scoreBands.good && (p.score ?? 0) >= mid).length,
      weak: scored.filter(p => (p.score ?? 0) < mid && (p.score ?? 0) >= scoreBands.bad).length,
      bad: scored.filter(p => (p.score ?? 0) < scoreBands.bad).length,
    },
  };
}
