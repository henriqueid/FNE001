/**
 * Política de qualidade de carteira: quais componentes entram no índice de qualidade
 * de cedentes e sacados, com que peso e a partir de que valor cada um é "bom" ou "ruim".
 *
 * Os números abaixo são configuração de DEMONSTRAÇÃO (editáveis na tela de Risco),
 * não referência de mercado: cada instituição define os seus na própria política.
 */
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

export type QualityPolicy = {
  name: string;
  version: string;
  /** Meses de cada janela comparada (recente × anterior). */
  windowMonths: number;
  /** Variação mínima do índice, em pontos, para aparecer como piorando ou melhorando. */
  minDelta: number;
  /** Índice a partir do qual o cliente está em patamar saudável (melhora abaixo disso é só acompanhamento). */
  healthyIndex: number;
  /** Quantos clientes cada ranking mostra. */
  rankingSize: number;
  /** Faixas do índice HHI de concentração (0 a 10.000): até "moderate" = pulverizada; acima de "high" = concentrada. */
  hhiModerate: number;
  hhiHigh: number;
  components: QualityComponentRule[];
};

export const demoQualityPolicy: QualityPolicy = {
  name: "Qualidade de carteira (demonstração)",
  version: "v1",
  windowMonths: 3,
  minDelta: 3,
  rankingSize: 10,
  healthyIndex: 70,
  hhiModerate: 1500,
  hhiHigh: 2500,
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
      label: "Score de bureau",
      unit: "pontos",
      weight: 5,
      good: 800,
      bad: 500,
      appliesToDebtors: true,
    },
  ],
};

export function hhiLabel(hhi: number, policy: Pick<QualityPolicy, "hhiModerate" | "hhiHigh">) {
  return hhi > policy.hhiHigh ? "concentrada" : hhi > policy.hhiModerate ? "moderada" : "pulverizada";
}
