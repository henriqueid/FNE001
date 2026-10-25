/**
 * Consulta do Copiloto à base do STRATO: carteira, cedentes, sacados, operações e política.
 * Interpreta a pergunta, escolhe a consulta (ferramenta), lê os dados recebidos e responde com fatos e
 * a fonte de cada número. Não altera nada. Na versão com IA real, só a interpretação do texto muda;
 * as consultas continuam sendo estas.
 */
import { type Cedent, type Operation } from "@/src/domain/core/types";
import { formatEligibilityValue } from "@/src/domain/eligibility/engine";
import { type EligibilityOperator, type EligibilityPolicy, type MasterRule } from "@/src/domain/eligibility/model";

const OPERATOR: Record<EligibilityOperator, string> = {
  EQ: "igual a",
  NE: "diferente de",
  GT: "acima de",
  GTE: "no mínimo",
  LT: "abaixo de",
  LTE: "no máximo",
  IN: "um de",
  NOT_IN: "fora de",
};
const OUTCOME = { ALERTA: "alerta", EXCECAO: "exige alçada", REPROVADO: "reprova" } as const;
import { type OperationalParameters } from "@/src/domain/eligibility/operational-parameters";
import { type PortfolioTitle } from "@/src/domain/home/metrics";
import { pendingDecisionsFor } from "@/src/domain/eligibility/authority-queue";
import { type DeskReply } from "./desk-assistant";
import { analyzePortfolioQuestion } from "./analytics";
import { specificAnswer } from "./specific-answer";

const CLOSED: Operation["status"][] = ["Cancelada", "Liberada ao financeiro"];

export type SystemKnowledge = {
  operations: Operation[];
  cedents: Cedent[];
  titles: PortfolioTitle[];
  policies: EligibilityPolicy[];
  rules: MasterRule[];
  parameters: OperationalParameters;
  /** Data de referência (AAAA-MM-DD); o domínio não lê o relógio. */
  today: string;
};

const versionLabel = (policy: EligibilityPolicy) =>
  `${policy.name} ${/^v/i.test(policy.version) ? policy.version : `v${policy.version}`}`;
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: number, digits = 1) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const dateBR = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
const digits = (value: string) => value.replace(/\D/g, "");
const dayNumber = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86400000;
const daysFrom = (today: string, iso: string) => Math.round(dayNumber(iso) - dayNumber(today));

const STOP = new Set([
  "ltda",
  "sa",
  "s.a.",
  "s.a",
  "me",
  "epp",
  "eireli",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "comercio",
  "comercial",
  "industria",
  "rede",
  "grupo",
  "servicos",
]);

function nameScore(question: string, name: string) {
  const words = plain(name)
    .split(/[^a-z0-9.]+/)
    .filter(word => word && !STOP.has(word));
  return words.filter(word => new RegExp(`(^|[^a-z0-9])${word.replace(/\./g, "\\.")}([^a-z0-9]|$)`).test(question))
    .length;
}

function bestByName<T>(question: string, items: T[], name: (item: T) => string) {
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = nameScore(question, name(item));
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

function cedentAnswer(cedent: Cedent, kb: SystemKnowledge): DeskReply {
  const owned = kb.titles.filter(title => digits(title.ownerDocument) === digits(cedent.document));
  const overdue = owned.filter(title => title.dueDate < kb.today);
  const open = kb.operations.filter(
    op => digits(op.document) === digits(cedent.document) && !CLOSED.includes(op.status),
  );
  const hasScore = cedent.score > 0;
  const hasCreditLimit = cedent.creditLimit > 0;
  const available = cedent.creditLimit - cedent.usedLimit;
  return {
    tool: `consultar_cadastro(cedente="${cedent.name}")`,
    paragraphs: [
      `${cedent.name} (${cedent.document}): ${hasScore ? `score ${cedent.score} de 1000` : "score interno ainda não calculado"}${cedent.bureauScore ? `, birô ${cedent.bureauScore} em campo separado` : ""}.`,
      hasCreditLimit
        ? `Limite ${brl(cedent.creditLimit)}, usado ${brl(cedent.usedLimit)} (${pct((cedent.usedLimit / cedent.creditLimit) * 100)}), disponível ${brl(available)}.`
        : "Limite de crédito ainda não disponível: aguarda definição no cadastro ou aprovação do comitê.",
      `Carteira: ${owned.length} título(s) em aberto somando ${brl(owned.reduce((sum, title) => sum + title.amount, 0))}${overdue.length ? `, ${overdue.length} vencido(s) (${brl(overdue.reduce((sum, title) => sum + title.amount, 0))})` : ", nenhum vencido"}.`,
      `Histórico: ${cedent.settlements} liquidações, ${cedent.lateSettlements} com atraso, atraso médio de ${cedent.averageDelayDays} dias, ${cedent.repurchases} recompra(s).`,
      open.length
        ? `Operações na mesa: ${open.map(op => `${op.aditivoNumber || op.id} (${op.status})`).join("; ")}.`
        : "Nenhuma operação aberta na mesa.",
    ],
  };
}

function debtorAnswer(name: string, kb: SystemKnowledge): DeskReply {
  const rows = kb.titles.filter(title => title.debtorName === name);
  const total = rows.reduce((sum, title) => sum + title.amount, 0);
  const all = kb.titles.reduce((sum, title) => sum + title.amount, 0);
  const overdue = rows.filter(title => title.dueDate < kb.today);
  const next = rows.filter(title => title.dueDate >= kb.today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const owners = Array.from(new Set(rows.map(title => title.ownerName)));
  return {
    tool: `consultar_carteira(sacado="${name}")`,
    paragraphs: [
      `${name}: ${rows.length} título(s) em aberto, ${brl(total)} (${pct(all ? (total / all) * 100 : 0)} da carteira).`,
      `Cedentes: ${owners.join(", ")}.`,
      overdue.length
        ? `${overdue.length} vencido(s), somando ${brl(overdue.reduce((sum, title) => sum + title.amount, 0))}.`
        : "Nenhum título vencido.",
      next ? `Próximo vencimento: ${dateBR(next.dueDate)}, ${brl(next.amount)} (${next.reference}).` : "",
    ].filter(Boolean),
  };
}

function topDebtors(kb: SystemKnowledge, limit = 5) {
  const total = kb.titles.reduce((sum, title) => sum + title.amount, 0);
  const map = new Map<string, number>();
  kb.titles.forEach(title => map.set(title.debtorName, (map.get(title.debtorName) ?? 0) + title.amount));
  return {
    total,
    rows: Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit),
  };
}

function policyAnswer(question: string, kb: SystemKnowledge): DeskReply {
  const active = kb.policies.filter(policy => policy.status === "ATIVA");
  const words = plain(question)
    .split(/[^a-z0-9]+/)
    .filter(
      word => word.length >= 4 && !["qual", "quais", "politica", "regra", "regras", "minimo", "maximo"].includes(word),
    );
  const synonyms: Record<string, string[]> = {
    concentracao: ["concentra"],
    sacado: ["sacado", "devedor"],
    sacados: ["sacado", "devedor"],
    prazo: ["prazo", "venc"],
    taxa: ["taxa"],
    score: ["score"],
    limite: ["limite"],
  };
  /** Cada palavra da pergunta vira um grupo de alternativas; a regra precisa atender todos os grupos. */
  const groups = words.map(word => synonyms[word] ?? [word.slice(0, 6)]);
  const matches: string[][] = [];
  for (const policy of active)
    for (const binding of policy.bindings) {
      if (!binding.enabled) continue;
      const rule = kb.rules.find(item => item.id === binding.ruleId);
      if (!rule) continue;
      const text = plain(`${rule.name} ${rule.description} ${rule.variable} ${rule.category}`);
      if (groups.length && groups.every(group => group.some(key => text.includes(key))))
        matches.push([
          rule.name,
          `${OPERATOR[binding.operator ?? rule.defaultOperator]} ${formatEligibilityValue(binding.parameter, rule.variable)}`,
          `${OUTCOME[binding.failureOutcome]}${binding.overrideAuthority ? ` (${binding.overrideAuthority})` : ""}`,
          versionLabel(policy),
        ]);
    }

  const params = kb.parameters;
  const paramLines: string[] = [];
  const q = plain(question);
  if (/taxa|piso/.test(q))
    paramLines.push(
      `Piso de taxa por risco: baixo ${pct(params.rateFloorByRisk.Baixo, 2)}, médio ${pct(params.rateFloorByRisk.Médio, 2)}, alto ${pct(params.rateFloorByRisk.Alto, 2)} a.m. Abaixo disso exige alçada comercial.`,
    );
  if (/prazo/.test(q)) paramLines.push(`Prazo mínimo para aprovar elegíveis: ${params.minimumTermDays} dias corridos.`);
  if (/score|faixa/.test(q))
    paramLines.push(
      `Faixas de score: abaixo de ${params.scoreBands.attention} é crítico; a partir de ${params.scoreBands.positive} é positivo.`,
    );
  if (/lastro|amostra/.test(q))
    paramLines.push(
      `Amostra de lastro: risco baixo ${pct(params.lastroSampleRatio.Baixo * 100, 0)}, médio ${pct(params.lastroSampleRatio.Médio * 100, 0)}, alto ${pct(params.lastroSampleRatio.Alto * 100, 0)} dos títulos.`,
    );

  if (!matches.length && !paramLines.length)
    return {
      tool: "consultar_politica()",
      paragraphs: [
        `Políticas ativas: ${active.map(policy => `${versionLabel(policy)} (${policy.bindings.filter(item => item.enabled).length} regras)`).join("; ") || "nenhuma"}.`,
        'Pergunte por um tema, por exemplo "concentração de sacado", "piso de taxa" ou "prazo mínimo".',
      ],
    };
  // Agrupa a mesma regra com o mesmo parâmetro em várias políticas numa linha só.
  const grouped = new Map<string, { rule: string; rest: string; policies: string[] }>();
  matches.forEach(([rule, parameter, outcome, policy]) => {
    const key = `${rule}|${parameter}|${outcome}`;
    const item = grouped.get(key) ?? { rule, rest: `${parameter}; se não cumprir, ${outcome}`, policies: [] };
    item.policies.push(policy);
    grouped.set(key, item);
  });
  return {
    tool: `consultar_politica(tema="${words.join(" ")}")`,
    paragraphs: [
      ...paramLines,
      ...Array.from(grouped.values())
        .slice(0, 6)
        .map(item => `${item.rule}: ${item.rest}. Vale em ${item.policies.join(", ")}.`),
    ],
  };
}

export function answerSystemQuestion(text: string, kb: SystemKnowledge): DeskReply {
  const specific = specificAnswer(text, kb);
  if (specific) return specific;
  const q = plain(text);
  const numbers = digits(text);
  const analysis = /(maior|mais|ranking|vencid|resumo.*carteira|quant.*titulo)/.test(q)
    ? analyzePortfolioQuestion(text, kb.titles, kb.today)
    : null;
  if (analysis)
    return {
      tool:
        analysis.query.group === "summary"
          ? "consultar_carteira(resumo)"
          : analysis.query.group === "debtor"
            ? "consultar_carteira(agrupar=sacado)"
            : analysis.query.group === "owner"
              ? "consultar_carteira(agrupar=cedente)"
              : "consultar_carteira(situacao=vencidos)",
      paragraphs: analysis.clarification
        ? [analysis.clarification]
        : [
            `${analysis.title}: ${analysis.titleCount} títulos, ${brl(analysis.totalBalance)}. ${analysis.criterion}`,
            ...analysis.warnings,
          ],
      table:
        !analysis.clarification && analysis.query.group !== "summary"
          ? {
              head: ["Entidade", "CPF/CNPJ", "Saldo", "Títulos", "Participação"],
              rows: analysis.rows.map(row => [
                row.name,
                row.document || "Não identificado",
                brl(row.balance),
                String(row.count),
                pct(row.share),
              ]),
            }
          : undefined,
    };

  const cedent =
    (numbers.length >= 8 ? kb.cedents.find(item => digits(item.document).startsWith(numbers)) : undefined) ??
    bestByName(q, kb.cedents, item => item.name);
  const debtorNames = Array.from(new Set(kb.titles.map(title => title.debtorName)));
  const debtor = bestByName(q, debtorNames, name => name);

  if (
    /(politic|regra|piso|prazo minimo|faixa de score|amostra|lastro|alcada)/.test(q) &&
    !/(operac|mesa|aditivo)/.test(q) &&
    !cedent &&
    !debtor
  )
    return policyAnswer(text, kb);

  if (cedent && (!debtor || nameScore(q, cedent.name) >= nameScore(q, debtor))) return cedentAnswer(cedent, kb);
  if (debtor) return debtorAnswer(debtor, kb);

  if (/(vencid|atrasad|inadimpl)/.test(q)) {
    const rows = kb.titles.filter(title => title.dueDate < kb.today).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((sum, title) => sum + title.amount, 0);
    return {
      tool: "consultar_carteira(situacao=vencidos)",
      paragraphs: rows.length
        ? [`${rows.length} título(s) vencido(s) em ${dateBR(kb.today)}, somando ${brl(total)}. Os maiores:`]
        : [`Nenhum título vencido em ${dateBR(kb.today)}.`],
      table: rows.length
        ? {
            head: ["Sacado", "Cedente", "Vencimento", "Valor"],
            rows: rows
              .slice(0, 6)
              .map(title => [title.debtorName, title.ownerName, dateBR(title.dueDate), brl(title.amount)]),
          }
        : undefined,
    };
  }

  if (/(vence|vencimento|a vencer)/.test(q)) {
    const horizon = /hoje/.test(q) ? 0 : /amanha/.test(q) ? 1 : /mes|30/.test(q) ? 30 : 7;
    const rows = kb.titles
      .filter(title => {
        const days = daysFrom(kb.today, title.dueDate);
        return days >= 0 && days <= horizon;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const label = horizon === 0 ? "hoje" : horizon === 1 ? "até amanhã" : `nos próximos ${horizon} dias`;
    return {
      tool: `consultar_carteira(vencimento<=${horizon}d)`,
      paragraphs: [
        rows.length
          ? `${rows.length} título(s) vencem ${label}, somando ${brl(rows.reduce((sum, title) => sum + title.amount, 0))}.`
          : `Nenhum título vence ${label}.`,
      ],
      table: rows.length
        ? {
            head: ["Vencimento", "Sacado", "Cedente", "Valor"],
            rows: rows
              .slice(0, 8)
              .map(title => [dateBR(title.dueDate), title.debtorName, title.ownerName, brl(title.amount)]),
          }
        : undefined,
    };
  }

  if (/(maior|concentra|top|ranking)/.test(q) && /sacad|devedor|concentra/.test(q)) {
    const { total, rows } = topDebtors(kb);
    return {
      tool: "consultar_carteira(agrupar=sacado)",
      paragraphs: [`Maiores sacados da carteira (${brl(total)} no total):`],
      table: {
        head: ["Sacado", "Valor", "Participação"],
        rows: rows.map(([name, amount]) => [name, brl(amount), pct(total ? (amount / total) * 100 : 0)]),
      },
    };
  }

  if (/(limite)/.test(q)) {
    const rows = kb.cedents
      .filter(item => item.creditLimit > 0)
      .map(item => ({ item, use: (item.usedLimit / item.creditLimit) * 100 }))
      .sort((a, b) => b.use - a.use)
      .slice(0, 6);
    return {
      tool: "consultar_cadastro(ordenar=uso_do_limite)",
      paragraphs: ["Uso do limite por cedente:"],
      table: {
        head: ["Cedente", "Limite", "Usado", "Uso"],
        rows: rows.map(({ item, use }) => [item.name, brl(item.creditLimit), brl(item.usedLimit), pct(use)]),
      },
    };
  }

  if (/(score|risco|pior|melhor)/.test(q) && /cedent|cliente|score/.test(q)) {
    const rows = kb.cedents.filter(item => item.score > 0).sort((a, b) => a.score - b.score);
    return {
      tool: "consultar_cadastro(ordenar=score)",
      paragraphs: [
        `Score dos cedentes (0 a 1000). Faixas da política: crítico abaixo de ${kb.parameters.scoreBands.attention}, positivo a partir de ${kb.parameters.scoreBands.positive}.`,
      ],
      table: {
        head: ["Cedente", "Score", "Atraso médio"],
        rows: rows.map(item => [item.name, String(item.score), `${item.averageDelayDays} d`]),
      },
    };
  }

  if (/(operac|mesa|aditivo|alcada|bloque|liberar|pendent)/.test(q)) {
    const statusFilter = /alcada|aprova/.test(q)
      ? (op: Operation) => pendingDecisionsFor(op).length > 0
      : /bloque|impedi/.test(q)
        ? (op: Operation) => op.blockers > 0
        : /liber/.test(q)
          ? (op: Operation) => /liberar/i.test(op.status)
          : (op: Operation) => !CLOSED.includes(op.status);
    const rows = kb.operations.filter(op => op.status !== "Cancelada" && statusFilter(op));
    return {
      tool: "consultar_operacoes()",
      paragraphs: [
        rows.length
          ? `${rows.length} operação(ões), somando ${brl(rows.reduce((sum, op) => sum + op.amount, 0))}:`
          : "Nenhuma operação nessa situação.",
      ],
      table: rows.length
        ? {
            head: ["Operação", "Cedente", "Situação", "Valor"],
            rows: rows.slice(0, 8).map(op => [op.aditivoNumber || op.id, op.cedent, op.status, brl(op.amount)]),
          }
        : undefined,
    };
  }

  if (/(carteira|resumo|total|quanto|quantos|quantas|saldo|posicao|titul)/.test(q)) {
    const total = kb.titles.reduce((sum, title) => sum + title.amount, 0);
    const overdue = kb.titles.filter(title => title.dueDate < kb.today);
    const term = total
      ? kb.titles.reduce((sum, title) => sum + title.amount * Math.max(0, daysFrom(kb.today, title.dueDate)), 0) / total
      : 0;
    const { rows } = topDebtors(kb, 1);
    return {
      tool: "consultar_carteira(resumo)",
      paragraphs: [
        `Carteira em ${dateBR(kb.today)}: ${kb.titles.length} títulos, ${brl(total)}, prazo médio a vencer de ${Math.round(term)} dias.`,
        `Vencidos: ${overdue.length} título(s), ${brl(overdue.reduce((sum, title) => sum + title.amount, 0))}.`,
        rows[0] ? `Maior sacado: ${rows[0][0]}, ${pct(total ? (rows[0][1] / total) * 100 : 0)} da carteira.` : "",
      ].filter(Boolean),
    };
  }

  return {
    paragraphs: [
      "Ainda não sei responder isso. Posso consultar a carteira (vencidos, vencimentos, maiores sacados), um cedente ou sacado pelo nome ou CNPJ, operações na mesa e regras da política.",
    ],
  };
}

export const systemSuggestions = [
  "Resumo da carteira",
  "Quais títulos estão vencidos?",
  "Maiores sacados da carteira",
  "Qual a regra de concentração de sacado?",
];
