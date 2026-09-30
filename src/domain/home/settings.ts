// Parâmetros da Visão geral.
// Tudo o que aparece na página inicial é calculado a partir das operações, da carteira
// de títulos, dos cadastros e das pendências (ver home-metrics.ts). Aqui ficam apenas
// os parâmetros que, em produção, virão de Configurações e da conciliação bancária.

export type HomePeriod = "dia" | "semana" | "mes";
export type HomeProfile = "gestao" | "operacao" | "risco";

export const periodLabels: Record<HomePeriod, { tab: string; compare: string; range: string }> = {
  dia: { tab: "Hoje", compare: "vs. ontem", range: "hoje" },
  semana: { tab: "Semana", compare: "vs. semana anterior", range: "nesta semana" },
  mes: { tab: "Mês", compare: "vs. mês anterior", range: "neste mês" },
};

export const profileLabels: Record<HomeProfile, { tab: string; description: string }> = {
  gestao: { tab: "Gestão", description: "Resultado, carteira, caixa e concentração" },
  operacao: { tab: "Operação", description: "Fila, pendências, prazos e produtividade" },
  risco: { tab: "Risco e cobrança", description: "Vencimentos, inadimplência, limites e alertas" },
};

export const homeSettings = {
  // Meta de originação por período (Configurações › Metas).
  volumeTarget: { dia: 1_500_000, semana: 7_500_000, mes: 30_000_000 } as Record<HomePeriod, number>,
  // Participação de cada empresa/veículo na meta consolidada (recorte por empresa).
  vehicleTargetShare: {
    "Lastro Prime FIDC · Classe Sênior": 0.35,
    "Aurora Recebíveis FIDC · Classe Única": 0.2,
    "Órbita Securitizadora S.A.": 0.15,
    "Lastro Fomento Mercantil": 0.3,
  } as Record<string, number>,
  // Recebimento esperado dos vencimentos em cada cenário da curva de liquidez.
  recovery: { conservative: 0.8, base: 0.95, optimistic: 1 },
  // Teto de concentração por sacado (regulamento/política).
  debtorConcentrationCap: 20,
  // Horários operacionais do dia.
  schedule: { committee: "11:00", collectionFile: "14:00", tedCutoff: "15:30", reconciliation: "17:00" },
};
