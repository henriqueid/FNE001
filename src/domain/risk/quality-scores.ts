/**
 * Score de qualidade único (0–1000) para cedentes e sacados.
 *
 * O número que aparece no cadastro, na análise da operação, no painel de Risco e no panorama do
 * cliente é o mesmo: o score calculado pela política de qualidade (`quality.ts`) sobre o histórico
 * mensal do cliente. O score do bureau externo continua guardado à parte (`bureauScore`) e entra
 * no cálculo só como um dos componentes, com o peso da política.
 *
 * Clientes sem histórico (conta nova, sacado novo) ficam sem score calculado: o cadastro mostra "Novo".
 */
import { type Cedent, type Debtor } from "@/src/domain/core/types";
import { qualityTrend, type QualityHistory, type QualityTrend } from "./quality";
import { type QualityPolicy } from "./quality-policy";

const digits = (v: string) => v.replace(/\D/g, "");

/** Tendência de qualidade por documento (só dígitos). */
export function qualityByDocument(histories: QualityHistory[], policy: QualityPolicy) {
  return new Map(histories.map(h => [digits(h.document), qualityTrend(h, policy)] as const));
}

/** Motivos do score em linguagem direta, para o cadastro e a análise da operação. */
export function scoreReasons(t: QualityTrend): string[] {
  const head =
    Math.abs(t.delta) < 5
      ? `Score estável nos últimos meses (${Math.round(t.index)})`
      : `Score ${t.delta < 0 ? "caiu" : "subiu"} ${Math.round(Math.abs(t.delta))} pontos: ${Math.round(t.previousIndex)} → ${Math.round(t.index)}`;
  const moved = t.reasons.map(r => `${r.text} (${r.impact > 0 ? "+" : "−"}${Math.round(Math.abs(r.impact))} pts)`);
  // sem variação relevante: mostra os componentes que mais pesam contra o score hoje
  const weakest = moved.length
    ? []
    : [...t.components]
        .filter(c => c.scoreAfter < 0.75)
        .sort((a, b) => a.scoreAfter * a.weight - b.scoreAfter * b.weight)
        .slice(0, 2)
        .map(c => `${c.label}: ${c.afterText} (bom a partir de ${fmtRule(c)})`);
  return [head, ...moved, ...weakest];
}

const fmtRule = (c: QualityTrend["components"][number]) =>
  c.unit === "%" ? `${c.good}%` : c.unit === "dias" ? `${c.good} dias` : `${c.good}`;

/** Cedente com o score calculado (quando há histórico) e o score de bureau preservado. */
export function scoredCedent(cedent: Cedent, trend?: QualityTrend): Cedent {
  const bureauScore = cedent.bureauScore ?? (cedent.score || undefined);
  if (!trend) return { ...cedent, bureauScore };
  return { ...cedent, bureauScore, score: Math.round(trend.index), scoreReasons: scoreReasons(trend) };
}

/** Sacado com o score calculado; sacado novo (sem score nem liquidações) continua sem score. */
export function scoredDebtor(debtor: Debtor, trend?: QualityTrend): Debtor {
  const bureauScore = debtor.bureauScore ?? debtor.score;
  if (!trend) return { ...debtor, bureauScore };
  return { ...debtor, bureauScore, score: Math.round(trend.index), scoreReasons: scoreReasons(trend) };
}
