/**
 * Analista de Mesa do Copiloto (simulado). Traduz a pergunta do operador numa ferramenta tipada
 * (explicar, simular, comparar), chama o motor determinístico e devolve a resposta com os números do motor.
 * Não aprova, não formaliza e não altera política. Na versão com IA real, só a interpretação do texto muda.
 */
import {
  bestConcentrationFix,
  centsToBRL,
  type DeskContext,
  type DeskScenario,
  nextScenario,
  percentBR,
} from "./desk-engine";

export type DeskReply = {
  tool?: string;
  paragraphs: string[];
  table?: { head: string[]; rows: string[][] };
};

export type DeskAnswer = {
  reply: DeskReply;
  scenario?: DeskScenario;
  /** A pergunta não é sobre o cenário. */ fallback?: boolean;
};

const signed = (cents: number) => `${cents >= 0 ? "+" : "−"}${centsToBRL(Math.abs(cents))}`;

function scenarioSummary(scenario: DeskScenario, previous: DeskScenario) {
  const { result } = scenario;
  const lines = [
    `Cenário v${scenario.version}: líquido ${centsToBRL(result.netCents)} (${signed(result.netCents - previous.result.netCents)}).`,
  ];
  lines.push(
    result.blockers.length ? `Ainda há ${result.blockers.length} impedimento(s).` : "Nenhum impedimento restante.",
  );
  if (result.exceptions.length)
    lines.push(`Continua pedindo alçada: ${result.exceptions.map(item => item.title).join("; ")}.`);
  else if (result.fastTrack) lines.push("Este cenário libera a aprovação rápida.");
  return lines;
}

export function answerDesk(text: string, context: DeskContext, scenarios: DeskScenario[]): DeskAnswer {
  const question = text.toLocaleLowerCase();
  const current = scenarios[scenarios.length - 1];
  const { result } = current;
  const { titles, policy } = context;
  const mentioned = titles.find(title =>
    title.document
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(part => part.length >= 3)
      .some(part => question.includes(part)),
  );
  const rateMatch = question.match(/(\d+(?:[.,]\d+)?)\s*%/) ?? question.match(/taxa\D*(\d+(?:[.,]\d+)?)/);

  if (/compar/.test(question)) {
    const last = scenarios.slice(-3);
    return {
      reply: {
        tool: `comparar_cenarios(${last.map(item => `v${item.version}`).join(", ")})`,
        paragraphs:
          last.length > 1 ? ["Últimos cenários lado a lado:"] : ["Ainda há só um cenário. Simule algo antes."],
        table:
          last.length > 1
            ? {
                head: ["", ...last.map(item => `v${item.version}`)],
                rows: [
                  ["Taxa", ...last.map(item => percentBR(item.ratePercent, 2))],
                  ["Títulos", ...last.map(item => String(item.result.count))],
                  ["Face", ...last.map(item => centsToBRL(item.result.faceCents))],
                  ["Líquido", ...last.map(item => centsToBRL(item.result.netCents))],
                  ["Maior sacado", ...last.map(item => percentBR(item.result.top.share))],
                  ["Via rápida", ...last.map(item => (item.result.fastTrack ? "Sim" : "Não"))],
                ],
              }
            : undefined,
      },
    };
  }

  if (/(retir|remov|tir[ae]|exclu)/.test(question) && (/duplicad/.test(question) || mentioned)) {
    const targets = /duplicad/.test(question)
      ? titles.filter(title => title.duplicate && current.included.includes(title.id))
      : titles.filter(title => title.id === mentioned?.id && current.included.includes(title.id));
    if (!targets.length) return { reply: { paragraphs: ["Esse título já está fora do cenário atual."] } };
    const names = targets.map(title => title.document).join(", ");
    const scenario = nextScenario(context, scenarios, {
      included: current.included.filter(id => !targets.some(title => title.id === id)),
      label: `Retirado ${names}`,
    });
    return {
      scenario,
      reply: {
        tool: `simular_cenario(retirar=[${names}])`,
        paragraphs: [`Retirei ${names} e recalculei.`, ...scenarioSummary(scenario, current)],
      },
    };
  }

  if (/(inclu|volt|recoloc)/.test(question) && mentioned) {
    if (current.included.includes(mentioned.id))
      return { reply: { paragraphs: [`${mentioned.document} já está no cenário.`] } };
    const scenario = nextScenario(context, scenarios, {
      included: [...current.included, mentioned.id],
      label: `Incluído ${mentioned.document}`,
    });
    return {
      scenario,
      reply: {
        tool: `simular_cenario(incluir=[${mentioned.document}])`,
        paragraphs: [`Incluí ${mentioned.document}.`, ...scenarioSummary(scenario, current)],
      },
    };
  }

  if (/(enquadr|ajust|sugest|o que (eu )?fa[çc]o|resolver)/.test(question)) {
    if (!result.exceptions.some(item => item.id === "concentration"))
      return {
        reply: {
          paragraphs: [
            `A concentração já está dentro do limite de ${policy.concentrationLimit}%.`,
            ...(result.exceptions.length
              ? [`Ainda pede alçada: ${result.exceptions.map(item => item.title).join("; ")}.`]
              : []),
          ],
        },
      };
    const fix = bestConcentrationFix(context, current);
    if (!fix)
      return {
        reply: {
          tool: "simular_cenario(teste)",
          paragraphs: [`Nenhuma retirada isolada enquadra a ${result.top.debtor}. O caminho é a alçada.`],
        },
      };
    return {
      reply: {
        tool: `simular_cenario(teste, retirar=[títulos ${result.top.debtor}])`,
        paragraphs: [
          `Testei no motor a retirada de cada título da ${result.top.debtor}. A menor que enquadra é ${fix.title.document} (${centsToBRL(fix.title.amountCents)}): a concentração cai para ${percentBR(fix.share)} e o líquido fica em ${centsToBRL(fix.result.netCents)}.`,
          "É uma recomendação. Se preferir manter o título, envie para alçada.",
        ],
      },
    };
  }

  if (rateMatch) {
    const ratePercent = Number(rateMatch[1].replace(",", "."));
    if (!(ratePercent > 0 && ratePercent < 20))
      return { reply: { paragraphs: ['Não entendi a taxa. Tente "simule taxa de 2,6%".'] } };
    const scenario = nextScenario(context, scenarios, { ratePercent, label: `Taxa ${percentBR(ratePercent, 2)} a.m.` });
    const paragraphs = [
      `Com ${percentBR(ratePercent, 2)} a.m., o deságio vai para ${centsToBRL(scenario.result.discountCents)} e o custo efetivo para ${percentBR(scenario.result.allInMonthly, 2)} a.m.`,
      ...scenarioSummary(scenario, current),
    ];
    if (ratePercent < policy.rateFloor)
      paragraphs.push(
        `Fica abaixo do piso de ${percentBR(policy.rateFloor, 2)}. Não apliquei nada por conta própria: o cenário exige alçada comercial.`,
      );
    return { scenario, reply: { tool: `simular_cenario(taxa=${percentBR(ratePercent, 2)})`, paragraphs } };
  }

  const directFinding = /score/.test(question)
    ? result.findings.find(item => item.id === "cedent-score")
    : /(limit|disponivel|disponível|cabe)/.test(question)
      ? result.findings.find(item => item.id === "cedent-limit")
      : undefined;
  if (directFinding)
    return {
      reply: {
        tool: `explicar_apontamento(${directFinding.id})`,
        paragraphs: [
          `${directFinding.title}. ${directFinding.detail}`,
          `Evidência: ${directFinding.evidence.toLocaleLowerCase()}. Política aplicada: ${policy.name} v${policy.version}.`,
        ],
      },
    };

  if (/(por ?que|porque|sinaliz|bloque|falta|problema|explic|cedo)/.test(question)) {
    const finding =
      result.findings.find(
        item =>
          item.id === "concentration" &&
          (/(concentr|sinaliz)/.test(question) ||
            result.top.debtor
              .toLocaleLowerCase()
              .split(" ")
              .some(word => word.length > 4 && question.includes(word))),
      ) ??
      result.findings.find(
        item => item.id.startsWith("dup") && (/duplic|bloque/.test(question) || item.id === `dup-${mentioned?.id}`),
      ) ??
      result.findings.find(item => item.id === "bureau" && /(boa vista|falta|consult)/.test(question)) ??
      result.findings.find(item => item.id === "rate-floor" && /taxa/.test(question)) ??
      result.findings.find(item => item.id.startsWith("term") && /(cedo|prazo|venc)/.test(question)) ??
      result.findings[0];
    if (!finding) return { reply: { paragraphs: ["Não há apontamentos no cenário atual."] } };
    if (finding.id === "concentration") {
      const debtorTitles = titles.filter(
        title => current.included.includes(title.id) && title.debtor === result.top.debtor,
      );
      const debtorCents = debtorTitles.reduce((sum, title) => sum + title.amountCents, 0);
      return {
        reply: {
          tool: "explicar_apontamento(regra=CONC-SACADO-001)",
          paragraphs: [
            `Fato: a ${result.top.debtor} soma ${centsToBRL(debtorCents)} em ${debtorTitles.length} títulos (${debtorTitles.map(title => title.document).join(", ")}), ${percentBR(result.top.share)} do valor de face do cenário v${current.version}.`,
            `Regra: CONC-SACADO-001 da política ${policy.name} v${policy.version} limita um sacado a ${policy.concentrationLimit}% da operação.`,
            "Leitura: não indica problema de pagamento do sacado; é um limite de diversificação. Posso testar ajustes que enquadrem.",
          ],
        },
      };
    }
    return {
      reply: {
        tool: `explicar_apontamento(${finding.id})`,
        paragraphs: [
          `${finding.title}. ${finding.detail}`,
          `Tipo de informação: ${finding.evidence.toLocaleLowerCase()}.`,
        ],
      },
    };
  }

  return {
    fallback: true,
    reply: {
      paragraphs: [
        "Posso explicar apontamentos, simular taxa, retirar ou incluir títulos e comparar cenários. Não aprovo operações nem altero a política.",
      ],
    },
  };
}

/** Sugestões de pergunta conforme o estado do cenário atual. */
export function deskSuggestions(scenarios: DeskScenario[]): string[] {
  const { result } = scenarios[scenarios.length - 1];
  const items: string[] = [];
  if (result.blockers.some(item => item.id.startsWith("dup"))) items.push("Retire o título duplicado");
  if (result.exceptions.some(item => item.id === "concentration")) {
    items.push(`Por que a ${result.top.debtor} foi sinalizada?`);
    items.push("O que eu ajusto para enquadrar?");
  }
  items.push("Simule taxa de 2,6%");
  if (scenarios.length > 1) items.push("Compare os cenários");
  return items.slice(0, 4);
}
