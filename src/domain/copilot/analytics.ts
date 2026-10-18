/** Consultas completas e auditáveis da carteira; a IA não calcula nem ordena os resultados. */
import type { PortfolioTitle } from "@/src/domain/home/metrics";

export type PortfolioQuery = {
  group: "debtor" | "owner" | "title" | "summary";
  metric: "balance" | "count";
  bucket: "open" | "overdue" | "upcoming";
  entityDocument?: string;
};
export type AnalyticsRow = {
  key: string;
  name: string;
  document: string;
  balance: number;
  count: number;
  share: number;
  titleIds: string[];
  companies: string[];
};
export type PortfolioAnalysis = {
  query: PortfolioQuery;
  title: string;
  criterion: string;
  referenceDate: string;
  totalBalance: number;
  titleCount: number;
  rows: AnalyticsRow[];
  warnings: string[];
  clarification?: string;
  evidenceTitleIds?: string[];
};
export const normalizedQuestion = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const digits = (text: string) => text.replace(/\D/g, "");
const cents = (value: number) => Math.round(value * 100);
const validDate = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const nameInQuestion = (question: string, name: string) => {
  const normalized = normalizedQuestion(name)
    .replace(/\b(ltda|s\.a\.?|eireli|epp)\b/g, "")
    .trim();
  if (normalized.length < 3) return false;
  const index = question.indexOf(normalized);
  return (
    index >= 0 &&
    (index === 0 || !/[a-z0-9]/.test(question[index - 1])) &&
    !/[a-z0-9]/.test(question[index + normalized.length] ?? "")
  );
};

export function analyzePortfolioQuestion(
  question: string,
  titles: PortfolioTitle[],
  today: string,
): PortfolioAnalysis | null {
  const q = normalizedQuestion(question);
  if (!/carteira|sacad|cedent|devedor|titulo|concentr|vencid|atrasad|inadimpl/.test(q)) return null;
  if (/politic|regra|piso|alcada|score|limite/.test(q)) return null;
  const overdue = /vencid|atrasad|inadimpl/.test(q);
  const upcoming = !overdue && /a vencer|vencimento|vence/.test(q);
  const group = /cedent/.test(q)
    ? "owner"
    : /sacad|devedor|concentr/.test(q)
      ? "debtor"
      : overdue || upcoming
        ? "title"
        : "summary";
  const metric =
    /quantidade|quantos|quantas|mais titulos|maior numero/.test(q) && !/valor|saldo|montante/.test(q)
      ? "count"
      : "balance";
  const query: PortfolioQuery = { group, metric, bucket: overdue ? "overdue" : upcoming ? "upcoming" : "open" };
  const requestedDocument = question.match(
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  )?.[0];
  const matches = titles.filter(title => nameInQuestion(q, group === "owner" ? title.ownerName : title.debtorName));
  const matchedDocuments = [
    ...new Set(matches.map(title => digits(group === "owner" ? title.ownerDocument : title.debtorDocument))),
  ];
  if (requestedDocument) query.entityDocument = digits(requestedDocument);
  else if (matchedDocuments.length === 1) query.entityDocument = matchedDocuments[0];
  const result: PortfolioAnalysis = {
    query,
    referenceDate: today,
    totalBalance: 0,
    titleCount: 0,
    rows: [],
    warnings: [],
    evidenceTitleIds: [],
    title:
      group === "summary"
        ? "Posição da carteira"
        : `${group === "owner" ? "Cedentes" : group === "debtor" ? "Sacados" : "Títulos"} · ${overdue ? "vencidos" : upcoming ? "a vencer" : "saldo em aberto"}`,
    criterion: `${metric === "count" ? "Quantidade de títulos" : "Saldo em aberto"}; ${overdue ? "vencimento anterior à data de referência" : upcoming ? "vencimento na data de referência ou posterior" : "todos os títulos com saldo"}. Participação sobre o saldo do conjunto consultado.`,
  };
  if (/historico|recorrenc|costuma|mais atrasam|mais atrasa|dias de atraso|atraso medio/.test(q)) {
    result.clarification =
      "Essa pergunta exige histórico de pagamentos e um critério de atraso recorrente. A posição atual de saldo não permite responder quem mais atrasa. Consulte o comportamento registrado ou informe se deseja apenas os títulos atualmente vencidos.";
    return result;
  }
  if (!requestedDocument && matchedDocuments.length > 1) {
    result.clarification =
      "Há mais de um documento para esse nome. Informe o CPF/CNPJ completo no filtro de documento para evitar misturar homônimos.";
    return result;
  }
  if (
    /mes passado|ultimo mes|semana|trimestre|\bano\b|\bentre\b|\bdesde\b|\bempresa\b|\bveiculo\b|\bhoje\b|\bamanha\b|\bultim[oa]s?\b|\bdias\b/.test(
      q,
    ) ||
    /\b(na|no|da|do)\s+(?!carteira\b|sistema\b|cliente\b|meu\b|minha\b|total\b|saldo\b|conjunto\b|ambiente\b|sacado\b|cedente\b)[a-z]/.test(
      q,
    ) ||
    /\d{2}[/.-]\d{2}/.test(q.replace(requestedDocument ?? "\u0000", ""))
  ) {
    result.clarification =
      "Esta pergunta contém um filtro que precisa ser definido. Use os filtros da análise para escolher empresa e documento; para períodos históricos é necessária uma posição histórica, não apenas a carteira atual.";
    return result;
  }
  if (
    !query.entityDocument &&
    /\b(sacado|cedente)\s+(?!(mais|com|por|em|tem|possui|e|esta|do|da|a|o)\b)[a-z]/.test(q)
  ) {
    result.clarification =
      "Não identifiquei esse nome com segurança na carteira autorizada. Informe o documento completo no filtro para consultar a entidade correta.";
    return result;
  }
  const map = new Map<string, { row: AnalyticsRow; balanceCents: number }>();
  let invalid = 0,
    unidentified = 0,
    totalCents = 0;
  titles.forEach(title => {
    if (!Number.isFinite(title.amount) || title.amount < 0 || !validDate(title.dueDate)) {
      invalid++;
      return;
    }
    if (cents(title.amount) <= 0) return;
    if ((overdue && title.dueDate >= today) || (upcoming && title.dueDate < today)) return;
    const document = digits(group === "owner" ? title.ownerDocument : title.debtorDocument);
    const name = group === "owner" ? title.ownerName : title.debtorName;
    const identified = document.length === 11 || document.length === 14;
    const key =
      group === "title" || group === "summary"
        ? `title:${title.id}`
        : identified
          ? `document:${document}`
          : `unidentified:${title.id}`;
    if (!identified) unidentified++;
    const entry = map.get(key) ?? {
      row: {
        key,
        name: group === "title" || group === "summary" ? `${title.reference} · ${title.debtorName}` : name,
        document: identified ? document : "",
        balance: 0,
        count: 0,
        share: 0,
        titleIds: [],
        companies: [],
      },
      balanceCents: 0,
    };
    entry.balanceCents += cents(title.amount);
    entry.row.count++;
    entry.row.titleIds.push(title.id);
    if (title.vehicle && !entry.row.companies.includes(title.vehicle)) entry.row.companies.push(title.vehicle);
    map.set(key, entry);
    totalCents += cents(title.amount);
    result.titleCount++;
    result.evidenceTitleIds!.push(title.id);
  });
  result.totalBalance = totalCents / 100;
  result.rows = [...map.values()]
    .map(({ row, balanceCents }) => ({
      ...row,
      balance: balanceCents / 100,
      share: totalCents ? (balanceCents / totalCents) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        (metric === "count" ? b.count - a.count : b.balance - a.balance) ||
        b.balance - a.balance ||
        a.key.localeCompare(b.key),
    );
  if (query.entityDocument) result.rows = result.rows.filter(row => row.document === query.entityDocument);
  if (invalid)
    result.warnings.push(`${invalid} registro(s) com valor ou data inválidos foram excluídos. A posição é incompleta.`);
  if (unidentified)
    result.warnings.push(
      `${unidentified} título(s) sem documento válido: mantidos separadamente, sem unir nomes iguais.`,
    );
  return result;
}
