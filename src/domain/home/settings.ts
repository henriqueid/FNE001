// Parâmetros da Visão geral.
// Tudo o que aparece na página inicial é calculado a partir das operações, da carteira
// de títulos, dos cadastros e das pendências (ver home-metrics.ts). Aqui ficam apenas
// os parâmetros que, em produção, virão de Configurações e da conciliação bancária.

export type HomePeriod = "dia" | "semana" | "mes";
export type HomeProfile = "gestao" | "operacao" | "risco";

export const periodLabels: Record<HomePeriod, { tab: string; compare: string; range: string }> = {
  dia: { tab: "Dia", compare: "vs. dia anterior", range: "na posição" },
  semana: { tab: "Semana", compare: "vs. semana anterior", range: "nesta semana" },
  mes: { tab: "Mês", compare: "vs. mês anterior", range: "neste mês" },
};

export const profileLabels: Record<HomeProfile, { tab: string; description: string }> = {
  gestao: { tab: "Gestão", description: "Resultado, carteira, caixa e concentração" },
  operacao: { tab: "Operação", description: "Fila, pendências, prazos e produtividade" },
  risco: { tab: "Risco e cobrança", description: "Vencimentos, inadimplência, limites e alertas" },
};

export const homeSettings = {
  // Recebimento esperado dos vencimentos em cada cenário da curva de liquidez.
  recovery: { conservative: 0.8, base: 0.95, optimistic: 1 },
  // Janela do gráfico principal de caixa: dias realizados para trás e projetados para frente.
  timeline: { daysBack: 30, daysAhead: 60 },
  // Teto de concentração por sacado (regulamento/política).
  debtorConcentrationCap: 20,
  // Horários operacionais do dia.
  schedule: { committee: "11:00", collectionFile: "14:00", tedCutoff: "15:30", reconciliation: "17:00" },
};
