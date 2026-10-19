/** Lista fechada de indicadores BCB/SGS. Nunca envia pergunta, documentos ou dados de negócio. */
import { normalizedQuestion } from "@/src/domain/copilot/analytics";
const indicators = [
  { key: /\bcdi\b/, name: "CDI", series: 12, unit: "% ao dia" },
  { key: /\bselic\b/, name: "Meta Selic", series: 432, unit: "% ao ano" },
];
export type MarketResult =
  | { available: false; reason: string }
  | { available: true; name: string; unit: string; date: string; value: number; url: string };
export async function readMarketIndicator(
  question: string,
  today: string,
  fetcher: typeof fetch = fetch,
): Promise<MarketResult> {
  if (process.env.STRATO_MARKET_INDICATORS_ENABLED !== "true")
    return {
      available: false,
      reason:
        "A fonte de indicadores financeiros não está configurada para consulta neste ambiente. Não usarei conhecimento do modelo como cotação atual.",
    };
  const q = normalizedQuestion(question);
  if (/\bipca\b|\bigp.?m\b/.test(q))
    return {
      available: false,
      reason: "Esse indicador ainda não possui conector autorizado. Consulte CDI diário ou meta Selic separadamente.",
    };
  const matches = indicators.filter(indicator => indicator.key.test(q));
  if (matches.length !== 1)
    return {
      available: false,
      reason:
        "Escolha um indicador disponível por consulta: CDI diário ou meta Selic anual. Outros indicadores exigem inclusão explícita de sua fonte autorizada.",
    };
  if (/ontem|mes passado|ultimo mes|\bentre\b|\bdesde\b|\d{2}[/-]\d{2}|acumulad|anualiz/.test(q))
    return {
      available: false,
      reason:
        "Este conector consulta o último valor publicado, sem calcular acumulados ou converter períodos. Especifique uma consulta ao último CDI diário ou à meta Selic.",
    };
  const indicator = matches[0];
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${indicator.series}/dados/ultimos/1?formato=json`;
  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 16384)
      throw new Error("Indicador indisponível");
    const text = await response.text();
    if (text.length > 16384) throw new Error("Resposta excedeu o limite");
    const parsed: unknown = JSON.parse(text);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 1 ||
      typeof parsed[0]?.data !== "string" ||
      typeof parsed[0]?.valor !== "string"
    )
      throw new Error("Formato inválido");
    const [day, month, year] = parsed[0].data.split("/");
    const date = `${year}-${month}-${day}`;
    const instant = new Date(`${date}T12:00:00Z`);
    const value = Number(parsed[0].valor);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(instant.getTime()) ||
      instant.toISOString().slice(0, 10) !== date ||
      date > today ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1000
    )
      throw new Error("Ponto inválido");
    return { available: true, name: indicator.name, unit: indicator.unit, date, value, url };
  } catch {
    return {
      available: false,
      reason:
        "A fonte autorizada não forneceu um ponto válido para esta referência. Nenhum valor estimado ou de outra base será usado.",
    };
  }
}
