/**
 * Parâmetros operacionais das etapas atuais (Risco, Lastro, Preço, Aprovação e filas da Central).
 *
 * Até a v7 estes números estavam espalhados no código das telas. Agora existe uma fonte única por
 * modalidade, lida por `operationalParametersFor`. Os valores são CONFIGURAÇÃO DE DEMONSTRAÇÃO herdada
 * do protótipo (mesmo comportamento de antes), não referência de mercado: cada instituição definirá
 * os seus na implantação. Regras avaliadas pelo motor (catálogo mestre + políticas versionadas) não
 * entram aqui; este arquivo cobre os parâmetros que as etapas legadas ainda usam diretamente.
 */
import { type InstitutionType, type Operation } from "@/src/domain/core/types";

export type OperationalParameters = {
  /** Faixas de score: abaixo de `attention` = crítico; a partir de `positive` = positivo. */
  scoreBands: { attention: number; positive: number };
  /** Prazo mínimo (dias corridos até o vencimento) para "Aprovar elegíveis" na etapa de Risco. */
  minimumTermDays: number;
  /** Prefixos de CFOP aceitos como circulação de mercadoria (duplicata). */
  cfopPrefixes: string[];
  /** Concentração do maior sacado na operação acima da qual a etapa de Risco pede intervenção (%). */
  riskConcentrationReference: number;
  /** Proporção de títulos sorteados para confirmação de lastro, por risco da operação. */
  lastroSampleRatio: Record<Operation["risk"], number>;
  /** Participação do título na operação a partir da qual ele é priorizado na amostra de lastro. */
  lastroRelevantShare: number;
  /** Piso de taxa mensal (% a.m.) por risco; abaixo dele a condição exige alçada comercial. */
  rateFloorByRisk: Record<Operation["risk"], number>;
  /** Índice mínimo de qualidade dos dados (automação assistida) para a prontidão da aprovação. */
  readinessMinAutomation: number;
  /** Índice de automação abaixo do qual a operação vai para a fila de intervenção da Central. */
  queueAutomationThreshold: number;
  /** Condição comercial sugerida ao abrir a etapa de Preço. */
  pricingDefaults: {
    monthlyRate: number;
    fundingCostMonthly: number;
    operationFee: number;
    feePerTitle: number;
    adValoremPercent: number;
    floatDays: number;
    minimumTermDays: number;
    guaranteePercentByRisk: Record<Operation["risk"], number>;
    regress: "Com regresso" | "Sem regresso";
    regressDays: number;
    coobligation: boolean;
  };
};

const base: OperationalParameters = {
  scoreBands: { attention: 600, positive: 700 },
  minimumTermDays: 15,
  cfopPrefixes: ["5", "6"],
  riskConcentrationReference: 20,
  lastroSampleRatio: { Baixo: 0.25, Médio: 0.5, Alto: 1 },
  lastroRelevantShare: 0.25,
  rateFloorByRisk: { Baixo: 1.4, Médio: 1.8, Alto: 2.4 },
  readinessMinAutomation: 70,
  queueAutomationThreshold: 80,
  pricingDefaults: {
    monthlyRate: 2.1,
    fundingCostMonthly: 1.2,
    operationFee: 0,
    feePerTitle: 12,
    adValoremPercent: 0,
    floatDays: 1,
    minimumTermDays: 5,
    guaranteePercentByRisk: { Baixo: 0, Médio: 2, Alto: 5 },
    regress: "Sem regresso",
    regressDays: 0,
    coobligation: false,
  },
};

export const operationalParametersByModality: Record<InstitutionType, OperationalParameters> = {
  Factoring: {
    ...base,
    pricingDefaults: {
      ...base.pricingDefaults,
      monthlyRate: 2.8,
      fundingCostMonthly: 1.45,
      operationFee: 150,
      adValoremPercent: 0.5,
      regress: "Com regresso",
      regressDays: 5,
      coobligation: true,
    },
  },
  FIDC: base,
  Securitizadora: base,
};

export const operationalParametersFor = (institution: InstitutionType = "Factoring") =>
  operationalParametersByModality[institution] ?? base;

export type ScoreBand = "Novo" | "Crítico" | "Atenção" | "Positivo";

/** Faixa de score pelas faixas configuradas. `undefined`/`null` = sacado ou cedente novo. */
export function scoreBand(
  score: number | undefined | null,
  bands: OperationalParameters["scoreBands"] = base.scoreBands,
): ScoreBand {
  if (score == null) return "Novo";
  return score >= bands.positive ? "Positivo" : score >= bands.attention ? "Atenção" : "Crítico";
}

/** Risco da operação derivado do score do cedente. */
export function riskFromScore(score: number, bands: OperationalParameters["scoreBands"] = base.scoreBands) {
  const band = scoreBand(score, bands);
  return (band === "Positivo" ? "Baixo" : band === "Atenção" ? "Médio" : "Alto") as Operation["risk"];
}

/** Dias corridos de calendário entre `today` e o vencimento (ISO); `null` sem vencimento. */
export function termDays(dueDate: string | undefined, today: string): number | null {
  if (!dueDate) return null;
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const ref = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(ref)) return null;
  return Math.round((due - ref) / 86_400_000);
}
