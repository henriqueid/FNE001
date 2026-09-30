/**
 * Dados de demonstração do Comercial, gerados relativos a hoje com semente fixa (sempre coerentes entre execuções).
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { addDays, todayIso } from "@/src/domain/finance/ledger";
import { round2 } from "./calendar";
import { defaultRules } from "./rules";
import {
  type CommercialState,
  type FunnelStage,
  type LinkOrigin,
  type SalesRep,
  type Visit,
  type VisitKind,
} from "./types";

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const reps: Omit<SalesRep, "since">[] = [
  {
    id: "rep-1",
    name: "Rafael Menezes",
    initials: "RM",
    role: "Executivo comercial",
    kind: "CLT",
    region: "Sul · PR e SC",
    email: "rafael.menezes@lastrofomento.com.br",
    phone: "(41) 99812-4410",
    document: "318.442.908-10",
    company: "Lastro Fomento Mercantil",
    monthlyGoal: 58_000,
    active: true,
  },
  {
    id: "rep-2",
    name: "Camila Duarte",
    initials: "CD",
    role: "Executiva comercial",
    kind: "CLT",
    region: "Sudeste · interior de SP e MG",
    email: "camila.duarte@lastrofomento.com.br",
    phone: "(19) 99720-1184",
    document: "271.905.338-42",
    company: "Lastro Fomento Mercantil",
    monthlyGoal: 42_000,
    active: true,
  },
  {
    id: "rep-3",
    name: "Bruno Teixeira",
    initials: "BT",
    role: "Gerente comercial",
    kind: "CLT",
    region: "São Paulo capital · grandes contas",
    email: "bruno.teixeira@lastrofomento.com.br",
    phone: "(11) 99455-9021",
    document: "205.118.674-33",
    company: "Lastro Fomento Mercantil",
    monthlyGoal: 115_000,
    active: true,
  },
  {
    id: "rep-4",
    name: "PL Assessoria (Patrícia Lemos)",
    initials: "PL",
    role: "Agente de negócios",
    kind: "Agente autônomo",
    region: "Oeste do PR e MS",
    email: "patricia@plassessoria.com.br",
    phone: "(45) 99901-7788",
    document: "41.228.905/0001-09",
    company: "Lastro Fomento Mercantil",
    monthlyGoal: 14_000,
    flatRate: 20,
    active: true,
  },
];

// [nome, documento, comercial, dias desde o vínculo, origem, limite, volume mensal, taxa a.m., segmento, cidade, dias desde a última operação (inativos), sem operação ainda]
export type SeedClient = [
  string,
  string,
  string,
  number,
  LinkOrigin,
  number,
  number,
  number,
  string,
  string,
  number?,
  boolean?,
];

// [nome, documento, comercial, dias desde o vínculo, origem, limite, volume mensal, taxa a.m., segmento, cidade, dias desde a última operação (inativos), sem operação ainda]
export const clients: SeedClient[] = [
  [
    "GZ Transportes Ltda",
    "52.927.676/0001-29",
    "rep-1",
    420,
    "Prospecção ativa",
    1_500_000,
    620_000,
    2.1,
    "Transporte e logística",
    "Curitiba/PR",
  ],
  [
    "Mundo das Canecas Fantasia",
    "59.264.846/0001-81",
    "rep-2",
    16,
    "Inbound",
    500_000,
    150_000,
    3.1,
    "Varejo e brindes",
    "Campinas/SP",
  ],
  [
    "Metalúrgica Vale do Aço Ltda",
    "12.482.991/0001-75",
    "rep-1",
    250,
    "Indicação",
    900_000,
    360_000,
    2.7,
    "Metalurgia",
    "Joinville/SC",
  ],
  [
    "Alimentos Horizonte S.A.",
    "08.411.620/0001-25",
    "rep-3",
    610,
    "Prospecção ativa",
    3_200_000,
    1_350_000,
    1.75,
    "Alimentos",
    "São Paulo/SP",
  ],
  [
    "Distribuidora Nova Serra",
    "33.907.118/0001-57",
    "rep-2",
    52,
    "Indicação",
    1_100_000,
    330_000,
    2.4,
    "Distribuição",
    "Uberlândia/MG",
  ],
  [
    "Rede Clínica Integra",
    "44.362.223/0001-74",
    "rep-3",
    300,
    "Carteira transferida",
    5_000_000,
    1_700_000,
    1.95,
    "Saúde",
    "São Paulo/SP",
  ],
  [
    "Têxtil Serra Gaúcha Ltda",
    "27.614.330/0001-23",
    "rep-1",
    22,
    "Prospecção ativa",
    450_000,
    160_000,
    2.9,
    "Têxtil",
    "Blumenau/SC",
  ],
  [
    "Agro Campos Verdes Ltda",
    "19.884.012/0001-54",
    "rep-4",
    38,
    "Indicação",
    700_000,
    240_000,
    2.5,
    "Insumos agrícolas",
    "Cascavel/PR",
  ],
  [
    "Plásticos Ribeira Indústria",
    "30.552.781/0001-98",
    "rep-4",
    160,
    "Prospecção ativa",
    600_000,
    190_000,
    2.8,
    "Plásticos",
    "Toledo/PR",
  ],
  [
    "Construtora Alvorada Ltda",
    "22.019.447/0001-45",
    "rep-2",
    210,
    "Prospecção ativa",
    1_400_000,
    420_000,
    2.3,
    "Construção civil",
    "Ribeirão Preto/SP",
  ],
  [
    "Farma Distribuição Sul",
    "15.730.662/0001-94",
    "rep-1",
    75,
    "Inbound",
    800_000,
    280_000,
    2.35,
    "Farmacêutico",
    "Londrina/PR",
  ],
  [
    "Logística Meridiano Ltda",
    "36.118.905/0001-08",
    "rep-3",
    9,
    "Indicação",
    0,
    0,
    2.2,
    "Transporte e logística",
    "Guarulhos/SP",
    undefined,
    true,
  ],
  [
    "Móveis Carvalho & Filhos",
    "40.771.230/0001-79",
    "rep-4",
    6,
    "Prospecção ativa",
    0,
    0,
    2.9,
    "Moveleiro",
    "Dourados/MS",
    undefined,
    true,
  ],
  [
    "Eletro Paraná Comércio",
    "11.905.346/0001-55",
    "rep-2",
    390,
    "Prospecção ativa",
    600_000,
    210_000,
    2.6,
    "Varejo de eletro",
    "Franca/SP",
    64,
  ],
  [
    "Gráfica Pontual Ltda",
    "09.338.114/0001-10",
    "rep-1",
    510,
    "Indicação",
    350_000,
    110_000,
    3.0,
    "Gráfico",
    "Maringá/PR",
    41,
  ],
  [
    "Cerealista Boa Safra",
    "28.604.559/0001-40",
    "rep-3",
    27,
    "Prospecção ativa",
    2_000_000,
    540_000,
    1.9,
    "Agronegócio",
    "Campinas/SP",
  ],
];

// [nome, documento, comercial, dias desde o vínculo, origem, limite, volume mensal, taxa a.m., segmento, cidade, dias desde a última operação (inativos), sem operação ainda]
export const committeeMembers = ["Henrique (diretoria)", "Luciana Prado (risco)", "Otávio Reis (jurídico)"];

// [nome, documento, comercial, dias desde o vínculo, origem, limite, volume mensal, taxa a.m., segmento, cidade, dias desde a última operação (inativos), sem operação ainda]

export function seedCommercial(today = todayIso()): CommercialState {
  const r = rng(20260929);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];
  const state: CommercialState = {
    version: 1,
    reps: reps.map((x, i) => ({ ...x, since: addDays(today, -[900, 700, 1200, 420][i]) })),
    links: [],
    deals: [],
    visits: [],
    committees: [],
    prospects: [],
    rules: defaultRules,
    closings: {},
    seq: 1000,
  };
  let bordero = 3100;
  clients.forEach(
    ([name, document, repId, sinceDays, origin, limit, volume, rate, segment, city, lastOpDays, noOps], ci) => {
      const since = addDays(today, -sinceDays);
      state.links.push({
        id: `lk-${ci + 1}`,
        clientName: name,
        document,
        repId,
        since,
        origin,
        status: noOps ? "Em onboarding" : lastOpDays && lastOpDays > 30 ? "Inativo" : "Ativo",
        approvedLimit: limit,
        segment,
        city,
        transfers:
          origin === "Carteira transferida"
            ? [{ from: "rep-1", to: repId, at: since, by: "Henrique", reason: "Reorganização das grandes contas" }]
            : [],
      });
      // comitê do limite inicial
      const firstDecision = addDays(since, -Math.max(2, Math.round(r() * 6)));
      state.committees.push({
        id: `cm-${ci + 1}`,
        date: noOps ? addDays(today, ci % 2 ? 2 : 4) : firstDecision,
        clientName: name,
        document,
        repId,
        request: "Limite inicial",
        requested: noOps ? [900_000, 380_000][ci % 2] : Math.round((limit * (1 + r() * 0.3)) / 50_000) * 50_000,
        approved: noOps ? undefined : limit,
        rate: noOps ? undefined : rate,
        status: noOps ? "Em pauta" : r() > 0.72 ? "Aprovado com ressalvas" : "Aprovado",
        commercialOpinion: noOps
          ? `${segment}, faturamento recorrente e sacados pulverizados. Cliente quer começar em até 15 dias.`
          : `Relacionamento de ${origin.toLowerCase()}, carteira de sacados de primeira linha.`,
        riskOpinion: noOps
          ? ci % 2
            ? "Favorável com limite menor e checagem 100% nas 3 primeiras operações."
            : undefined
          : "Favorável.",
        conditions: noOps
          ? undefined
          : r() > 0.5
            ? "Checagem de 100% dos títulos nas primeiras 3 operações; concentração máxima de 25% por sacado."
            : undefined,
        members: committeeMembers,
        decidedAt: noOps ? undefined : firstDecision,
        decidedBy: noOps ? undefined : "Henrique",
        history: [
          {
            at: addDays(firstDecision, -3),
            by: state.reps.find(x => x.id === repId)!.name,
            action: "Enviado ao comitê",
            detail: "Pedido de limite inicial",
          },
          ...(noOps
            ? []
            : [
                {
                  at: firstDecision,
                  by: "Henrique",
                  action: "Decisão registrada",
                  detail: `Limite aprovado de ${limit.toLocaleString("pt-BR")}`,
                },
              ]),
        ],
      });
      if (noOps) return;
      // negócios: intervalo de 5 a 13 dias, desde o vínculo (ou 210 dias atrás)
      const start = addDays(today, -Math.min(sinceDays - 2, 210));
      const end = addDays(today, -(lastOpDays ?? 0));
      let d = addDays(start, Math.round(r() * 4));
      while (d <= end) {
        const face = round2((volume / 3) * (0.55 + r() * 0.9));
        const term = 1 + r() * 0.8;
        const titles = Math.max(3, Math.round(face / (8_000 + r() * 14_000)));
        const discount = round2(((face * rate) / 100) * term);
        const fees = round2(titles * 14 + 180);
        const repurchased = r() > 0.95 ? round2(face * (0.05 + r() * 0.12)) : undefined;
        state.deals.push({
          id: `dl-${++state.seq}`,
          date: d,
          bordero: String(++bordero).padStart(7, "0"),
          clientName: name,
          document,
          repId,
          vehicle: pick(destinations).name,
          face,
          discount,
          fees,
          revenue: round2(discount + fees),
          rate,
          titles,
          repurchased,
        });
        d = addDays(d, 5 + Math.round(r() * 8));
      }
      // aumento de limite para as contas mais antigas
      if (sinceDays > 200) {
        const at = addDays(today, -Math.round(20 + r() * 90));
        const ok = r() > 0.3;
        state.committees.push({
          id: `cm-${ci + 1}b`,
          date: at,
          clientName: name,
          document,
          repId,
          request: "Aumento de limite",
          requested: Math.round((limit * 0.4) / 50_000) * 50_000,
          approved: ok ? Math.round((limit * 0.25) / 50_000) * 50_000 : 0,
          rate,
          status: ok ? "Aprovado com ressalvas" : "Reprovado",
          commercialOpinion: "Cliente cresceu o faturamento e pediu mais limite para a safra.",
          riskOpinion: ok ? "Favorável a 60% do pedido." : "Desfavorável: aumento de atrasos nos últimos 60 dias.",
          conditions: ok ? "Aprovado 60% do pedido; revisão em 90 dias." : undefined,
          members: committeeMembers,
          decidedAt: at,
          decidedBy: "Henrique",
          history: [
            {
              at: addDays(at, -2),
              by: state.reps.find(x => x.id === repId)!.name,
              action: "Enviado ao comitê",
              detail: "Pedido de aumento de limite",
            },
            { at, by: "Henrique", action: "Decisão registrada", detail: ok ? "Aprovado com ressalvas" : "Reprovado" },
          ],
        });
      }
    },
  );
  // pauta em aberto além dos limites iniciais
  state.committees.push({
    id: "cm-p1",
    date: addDays(today, 2),
    clientName: "Rede Clínica Integra",
    document: "44.362.223/0001-74",
    repId: "rep-3",
    request: "Aumento de limite",
    requested: 1_500_000,
    status: "Em pauta",
    commercialOpinion:
      "Novo contrato com operadora de saúde, recebíveis de 90 dias. Potencial de R$ 700 mil/mês a mais.",
    riskOpinion: "Desfavorável no momento: 82% do limite usado e R$ 298 mil vencidos. Sugere aguardar a regularização.",
    members: committeeMembers,
    history: [
      {
        at: addDays(today, -1),
        by: "Bruno Teixeira",
        action: "Enviado ao comitê",
        detail: "Pedido de aumento de R$ 1,5 mi",
      },
    ],
  });
  state.committees.push({
    id: "cm-p2",
    date: addDays(today, 2),
    clientName: "Alimentos Horizonte S.A.",
    document: "08.411.620/0001-25",
    repId: "rep-3",
    request: "Taxa especial",
    requested: 0,
    rate: 1.55,
    status: "Em pauta",
    commercialOpinion: "Concorrente ofereceu 1,55% a.m. Cliente é o maior volume da carteira e tem risco baixo.",
    riskOpinion: "Favorável; spread segue positivo sobre o custo de captação.",
    members: committeeMembers,
    history: [{ at: today, by: "Bruno Teixeira", action: "Enviado ao comitê", detail: "Taxa especial de 1,55% a.m." }],
  });

  // visitas: passadas (últimos 50 dias) e futuras (próximos 20)
  const places: Record<string, string> = Object.fromEntries(clients.map(c => [c[0], c[9]]));
  const prospectsSeed: [string, string, FunnelStage, number, LinkOrigin, string][] = [
    ["Transportadora Rota Azul", "rep-1", "Lead", 300_000, "Inbound", "Ligar para marcar visita"],
    ["Madeireira Três Pinheiros", "rep-1", "Visita", 220_000, "Prospecção ativa", "Visita agendada"],
    ["Indústria Química Paraná", "rep-1", "Proposta", 650_000, "Indicação", "Enviar proposta de taxa"],
    ["Auto Peças Horizonte", "rep-2", "Lead", 180_000, "Prospecção ativa", "Qualificar faturamento"],
    ["Laticínios Serra da Canastra", "rep-2", "Proposta", 480_000, "Indicação", "Reunião com o financeiro do cliente"],
    ["Calçados Franca Premium", "rep-2", "Visita", 260_000, "Prospecção ativa", "Visita agendada"],
    ["Hospital Santa Luzia", "rep-3", "Proposta", 1_900_000, "Indicação", "Aguardando balanço 2025"],
    [
      "Distribuidora Atacadão Leste",
      "rep-3",
      "Comitê",
      1_200_000,
      "Prospecção ativa",
      "Documentação completa, pautar no comitê",
    ],
    ["Embalagens Vale Verde", "rep-3", "Lead", 400_000, "Inbound", "Primeiro contato"],
    ["Cooperativa Agro Oeste", "rep-4", "Visita", 900_000, "Indicação", "Visita agendada"],
    [
      "Frigorífico Pantanal",
      "rep-4",
      "Proposta",
      1_100_000,
      "Prospecção ativa",
      "Proposta enviada, aguardando retorno",
    ],
    ["Posto Rodovia Sul", "rep-4", "Aprovado", 350_000, "Prospecção ativa", "Cadastrar e fazer a 1ª operação"],
  ];
  prospectsSeed.forEach(([name, repId, stage, potential, source, nextStep], i) =>
    state.prospects.push({
      id: `pp-${i + 1}`,
      name,
      repId,
      stage,
      potential,
      source,
      nextStep,
      createdAt: addDays(today, -Math.round(8 + r() * 70)),
      updatedAt: addDays(today, -Math.round(r() * 10)),
    }),
  );
  const kinds: VisitKind[] = ["Relacionamento", "Relacionamento", "Pós-venda", "Renegociação", "Cobrança"];
  state.reps.forEach(rep => {
    const mine = state.links.filter(l => l.repId === rep.id);
    const leads = state.prospects.filter(p => p.repId === rep.id);
    for (let i = 0; i < 12; i++) {
      const past = i < 8;
      const date = past ? addDays(today, -Math.round(1 + r() * 48)) : addDays(today, Math.round(1 + r() * 19));
      const isLead = r() > 0.55 && leads.length;
      const target = isLead ? pick(leads).name : pick(mine).clientName;
      const status: Visit["status"] = !past
        ? "Agendada"
        : r() > 0.88
          ? "Cancelada"
          : r() > 0.9
            ? "Não realizada"
            : "Realizada";
      state.visits.push({
        id: `vs-${++state.seq}`,
        date,
        time: `${String(8 + Math.floor(r() * 9)).padStart(2, "0")}:${r() > 0.5 ? "30" : "00"}`,
        repId: rep.id,
        target,
        document: isLead ? undefined : mine.find(m => m.clientName === target)?.document,
        kind: isLead ? "Prospecção" : pick(kinds),
        status,
        address: places[target] ?? rep.region.split("·")[1]?.trim() ?? rep.region,
        outcome:
          status === "Realizada"
            ? isLead
              ? pick([
                  "Pediu proposta",
                  "Enviou documentos para cadastro",
                  "Sem interesse no momento",
                  "Voltar após o balanço",
                ])
              : pick([
                  "Cliente deve aumentar o volume no próximo mês",
                  "Renegociou a taxa",
                  "Apresentou novos sacados",
                  "Sem novidades",
                  "Reclamou do prazo de liberação",
                ])
            : undefined,
      });
    }
    // uma visita de hoje para cada comercial, para a agenda do dia
    state.visits.push({
      id: `vs-${++state.seq}`,
      date: today,
      time: rep.id === "rep-1" ? "10:00" : rep.id === "rep-2" ? "14:30" : rep.id === "rep-3" ? "16:00" : "09:30",
      repId: rep.id,
      target: leads[0]?.name ?? mine[0].clientName,
      kind: "Prospecção",
      status: "Agendada",
      address: rep.region,
    });
  });
  // visitas atrasadas (agendadas no passado e não registradas)
  state.visits.push({
    id: `vs-${++state.seq}`,
    date: addDays(today, -3),
    time: "15:00",
    repId: "rep-2",
    target: "Auto Peças Horizonte",
    kind: "Prospecção",
    status: "Agendada",
    address: "Franca/SP",
  });
  state.visits.push({
    id: `vs-${++state.seq}`,
    date: addDays(today, -1),
    time: "11:00",
    repId: "rep-4",
    target: "Cooperativa Agro Oeste",
    kind: "Prospecção",
    status: "Agendada",
    address: "Cascavel/PR",
  });
  state.visits.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  state.deals.sort((a, b) => a.date.localeCompare(b.date));
  return state;
}
