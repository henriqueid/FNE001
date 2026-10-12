/**
 * Política de qualidade de carteira: quais componentes entram no score de qualidade (0–1000)
 * de cedentes e sacados, com que peso e a partir de que valor cada um é "bom" ou "ruim".
 *
 * Os números abaixo são configuração de DEMONSTRAÇÃO (editáveis na tela de Risco),
 * não referência de mercado: cada instituição define os seus na própria política.
 */
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";

export type QualityComponentId =
  | "onTimeRate"
  | "averageDelay"
  | "repurchaseRate"
  | "extensionRate"
  | "overdue30Rate"
  | "topDebtorShare"
  | "protests"
  | "limitUse"
  | "bureauScore";

export type QualityComponentRule = {
  id: QualityComponentId;
  label: string;
  /** Como o valor aparece nos motivos ("atraso médio subiu de 4 para 11 dias"). */
  unit: "%" | "dias" | "pontos" | "qtde";
  /** Peso no índice (os pesos ativos são normalizados para somar 100). */
  weight: number;
  /** Valor em que o componente vale 100% (bom) e 0% (ruim); a escala entre eles é linear. */
  good: number;
  bad: number;
  /** Componente usado para sacados (quem paga) além de cedentes. */
  appliesToDebtors: boolean;
};

/** Faixa de provisão (PDD) por dias de atraso. */
export type ProvisionBand = { fromDays: number; rate: number };

/** Parâmetros dos indicadores de mercado das telas (todos da política, nunca fixos no código). */
export type IndicatorParameters = {
  /** % provisionado do saldo vencido a partir de cada faixa de atraso. */
  provisionBands: ProvisionBand[];
  /** Probabilidade de fechamento por etapa do funil comercial (%). */
  funnelProbability: Record<"Lead" | "Visita" | "Proposta" | "Comitê" | "Aprovado", number>;
  /** Faixas de inatividade de clientes (dias sem operar). */
  inactiveDays: [number, number, number];
  /** Revisão cadastral (KYC) e de limite vencem depois de quantos dias. */
  kycReviewDays: number;
  limitReviewDays: number;
};

export type QualityPolicy = {
  name: string;
  version: string;
  /** Meses de cada janela comparada (recente × anterior). */
  windowMonths: number;
  /** Variação mínima do score (escala 0–1000), em pontos, para aparecer como piorando ou melhorando. */
  minDelta: number;
  /**
   * Score a partir do qual o cliente está na faixa positiva. Não é editado aqui: vem das faixas de score
   * dos parâmetros operacionais (`scoreBands.positive`), as mesmas que a operação usa.
   */
  healthyIndex: number;
  /** Quantos clientes cada ranking mostra. */
  rankingSize: number;
  /** Faixas do índice HHI de concentração (0 a 10.000): até "moderate" = pulverizada; acima de "high" = concentrada. */
  hhiModerate: number;
  hhiHigh: number;
  components: QualityComponentRule[];
  indicators: IndicatorParameters;
};

export const demoQualityPolicy: QualityPolicy = {
  name: "Qualidade de carteira (demonstração)",
  version: "v1",
  windowMonths: 3,
  minDelta: 30,
  rankingSize: 10,
  healthyIndex: operationalParametersFor().scoreBands.positive,
  hhiModerate: 1500,
  hhiHigh: 2500,
  indicators: {
    provisionBands: [
      { fromDays: 1, rate: 1 },
      { fromDays: 31, rate: 10 },
      { fromDays: 61, rate: 30 },
      { fromDays: 91, rate: 50 },
      { fromDays: 181, rate: 100 },
    ],
    funnelProbability: { Lead: 10, Visita: 25, Proposta: 50, Comitê: 70, Aprovado: 90 },
    inactiveDays: [30, 60, 90],
    kycReviewDays: 365,
    limitReviewDays: 180,
  },
  components: [
    { id: "onTimeRate", label: "Liquidez no prazo", unit: "%", weight: 22, good: 95, bad: 70, appliesToDebtors: true },
    { id: "averageDelay", label: "Atraso médio", unit: "dias", weight: 16, good: 2, bad: 20, appliesToDebtors: true },
    { id: "repurchaseRate", label: "Recompras", unit: "%", weight: 14, good: 1, bad: 8, appliesToDebtors: false },
    { id: "extensionRate", label: "Prorrogações", unit: "%", weight: 8, good: 2, bad: 12, appliesToDebtors: true },
    {
      id: "overdue30Rate",
      label: "Vencido há mais de 30 dias",
      unit: "%",
      weight: 14,
      good: 0.5,
      bad: 10,
      appliesToDebtors: true,
    },
    {
      id: "topDebtorShare",
      label: "Concentração no maior sacado",
      unit: "%",
      weight: 8,
      good: 15,
      bad: 40,
      appliesToDebtors: false,
    },
    {
      id: "protests",
      label: "Protestos e apontamentos",
      unit: "qtde",
      weight: 8,
      good: 0,
      bad: 4,
      appliesToDebtors: true,
    },
    { id: "limitUse", label: "Uso do limite", unit: "%", weight: 5, good: 60, bad: 100, appliesToDebtors: false },
    {
      id: "bureauScore",
      label: "Score de bureau (externo)",
      unit: "pontos",
      weight: 5,
      good: 800,
      bad: 500,
      appliesToDebtors: true,
    },
  ],
};

/** Base neutra para uma organização real; os parâmetros devem ser homologados pela instituição. */
export const defaultQualityPolicy: QualityPolicy = {
  ...demoQualityPolicy,
  name: "Política de qualidade padrão",
  version: "v1.0",
  components: demoQualityPolicy.components.map(component => ({ ...component })),
  indicators: {
    ...demoQualityPolicy.indicators,
    provisionBands: demoQualityPolicy.indicators.provisionBands.map(band => ({ ...band })),
    funnelProbability: { ...demoQualityPolicy.indicators.funnelProbability },
    inactiveDays: [...demoQualityPolicy.indicators.inactiveDays],
  },
};

export function hhiLabel(hhi: number, policy: Pick<QualityPolicy, "hhiModerate" | "hhiHigh">) {
  return hhi > policy.hhiHigh ? "concentrada" : hhi > policy.hhiModerate ? "moderada" : "pulverizada";
}

/** % de provisão para um título com `days` dias de atraso (0 se não venceu). */
export function provisionRate(days: number, bands: ProvisionBand[]) {
  if (days <= 0) return 0;
  return [...bands]
    .sort((a, b) => a.fromDays - b.fromDays)
    .reduce((rate, b) => (days >= b.fromDays ? b.rate : rate), 0);
}
