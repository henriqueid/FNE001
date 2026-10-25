/** Extremos pedidos no singular usam métricas disponíveis e respondem sem ranking geral. */
import type { DeskReply } from "./desk-assistant";
import type { SystemKnowledge } from "./system-query";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function specificAnswer(text: string, knowledge: SystemKnowledge): DeskReply | null {
  const q = normalize(text);
  if (/politic|regra|ranking|relatorio|liste|listar|lista|top\s*\d/.test(q)) return null;
  if (/\b(clientes|cedentes|scores)\b/.test(q) && !/\b(qual|quem|cliente|cedente|sedente)\b/.test(q)) return null;
  const metric = /score/.test(q) ? "score" : /liquidez/.test(q) ? "liquidez" : undefined;
  if (!metric) return null;
  const qualifier = "(menor|maior|pior|melhor|mais baixo|mais alto|mais baixa|mais alta)";
  const before = new RegExp(`${qualifier}\\s+(?:(?:indice|nivel)\\s+(?:de\\s+)?)?${metric}\\b`).exec(q);
  const after = new RegExp(`\\b${metric}\\s+(?:(?:e|esta|for|o|a)\\s+)*${qualifier}`).exec(q);
  const requested = before?.[1] ?? after?.[1];
  if (!requested) return null;
  const direction = /menor|mais baix|pior/.test(requested) ? "minimo" : "maximo";
  const tool = `consultar_cadastro(metrica=${metric},extremo=${direction})`;
  if (
    /\b(mes|meses|semanas?|anos?|ultim[a-z]*|ontem|periodo|trimestr[a-z]*|semestr[a-z]*|desde|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|(?:19|20)\d{2})\b|\d{4}-\d{2}|\d{1,2}\/\d{1,2}/.test(
      q,
    )
  )
    return {
      tool,
      paragraphs: [
        `Não consigo comparar ${metric === "score" ? "o score" : "a liquidez"} nesse período: esta fonte fornece apenas ${metric === "score" ? "o score da posição atual" : "o histórico agregado de liquidações, sem datas para aplicar esse recorte"}.`,
      ],
    };
  const rows = knowledge.cedents.flatMap(cedent => {
    if (metric === "score")
      return Number.isFinite(cedent.score) && cedent.score > 0 && cedent.score <= 1000
        ? [{ cedent, value: cedent.score, onTime: 0, total: 0 }]
        : [];
    const onTime = cedent.portfolioMetrics?.settledOnTime.amount;
    const late = cedent.portfolioMetrics?.settledLate.amount;
    if (
      onTime === undefined ||
      late === undefined ||
      !Number.isFinite(onTime) ||
      !Number.isFinite(late) ||
      onTime < 0 ||
      late < 0 ||
      onTime + late <= 0
    )
      return [];
    return [{ cedent, value: (onTime / (onTime + late)) * 100, onTime, total: onTime + late }];
  });
  if (!rows.length)
    return {
      tool,
      paragraphs: [
        `Não consigo identificar ${metric === "score" ? "o cliente com esse score" : "o cedente com esse índice de liquidez"}: não há ${metric === "score" ? "scores calculados" : "valores históricos de liquidações pontuais e atrasadas"} disponíveis para comparar. Ausência de dado não é zero.`,
      ],
    };
  const extreme =
    direction === "minimo" ? Math.min(...rows.map(row => row.value)) : Math.max(...rows.map(row => row.value));
  const winners = rows
    .filter(row => Math.abs(row.value - extreme) < 1e-9)
    .sort((a, b) => a.cedent.name.localeCompare(b.cedent.name, "pt-BR"));
  const value =
    metric === "score"
      ? `${extreme} de 1000`
      : `${extreme.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const label =
    metric === "score"
      ? `${direction === "minimo" ? "Menor" : "Maior"} score interno`
      : `${direction === "minimo" ? "Menor" : "Melhor"} liquidez no vencimento`;
  const names = winners.map(row => `${row.cedent.name} (${row.cedent.document})`).join("; ");
  const date = knowledge.today.split("-").reverse().join("/");
  return {
    tool,
    paragraphs: [
      `${winners.length > 1 ? "Há empate: " : ""}${names} — ${label.toLowerCase()}: ${value}.`,
      metric === "score"
        ? `Comparação entre ${rows.length} cedente(s) com score interno calculado, na posição de ${date}. Não é score de birô.`
        : `Critério: valor liquidado no prazo ÷ (valor liquidado no prazo + valor liquidado em atraso). ${winners.map(row => `${row.cedent.name}: ${money(row.onTime)} ÷ ${money(row.total)}`).join("; ")}. Histórico agregado disponível na posição de ${date}, sem filtro de período.`,
      ...(rows.length < knowledge.cedents.length
        ? [
            `${knowledge.cedents.length - rows.length} cedente(s) sem dados válidos para essa métrica ficaram fora da comparação.`,
          ]
        : []),
    ],
  };
}
