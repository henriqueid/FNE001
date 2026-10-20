/** Feeds editoriais oficiais aprovados; cache público sem dados de clientes nem interpretação por IA. */
import type { MarketNews } from "@/src/domain/home/radar";

type NewsSource = MarketNews["source"];
const hosts: Record<NewsSource, string> = {
  BCB: "www.bcb.gov.br",
  CVM: "www.gov.br",
  "Agência Brasil": "agenciabrasil.ebc.com.br",
};
const decode = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, key: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[key] ?? "",
    );
const text = (value: string) =>
  decode(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tag = (xml: string, name: string) =>
  xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "";

function classification(title: string, source: NewsSource) {
  if (/fidc|securiti|receb[ií]ve|fundos|cvm|regula|resolu[cç]|consulta p[uú]blica/i.test(title) || source === "CVM")
    return { topic: "Regulação", relevance: "Acompanhar regras e divulgações aplicáveis a fundos e recebíveis." };
  if (/juros|selic|copom|cr[eé]dito|banc|financiamento|inadimpl/i.test(title))
    return {
      topic: "Juros e crédito",
      relevance: "Contexto para custo de captação, precificação e oferta de crédito.",
    };
  if (/infla|ipca|pre[cç]os|pib|atividade|economia|c[aâ]mbio|d[oó]lar/i.test(title))
    return { topic: "Economia", relevance: "Contexto para avaliar pressão sobre caixa e demanda das empresas." };
  return { topic: "Mercado", relevance: "Acompanhar cenário econômico e comunicados institucionais." };
}

export function parseOfficialNews(xml: string, source: NewsSource, now: Date): MarketNews[] {
  if (xml.length > 524288 || /<!DOCTYPE|<!ENTITY/i.test(xml)) return [];
  const entries = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0, 100);
  return entries.flatMap(([, , entry]) => {
    const title = text(tag(entry, "title")).slice(0, 220);
    if (
      source === "Agência Brasil" &&
      !/cr[eé]dito|juros|selic|copom|infla|ipca|econom|pib|c[aâ]mbio|d[oó]lar|fundos|mercado|banc|financ|inadimpl|receb[ií]ve|securiti|empres|ind[uú]str|fiscal|tribut|invest/i.test(
        title,
      )
    )
      return [];
    const linkTag = entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i);
    const link = decode(tag(entry, "link").trim() || linkTag?.[1] || "");
    const published = text(
      tag(entry, "pubDate") || tag(entry, "published") || tag(entry, "dc:date") || tag(entry, "updated"),
    );
    const date = new Date(published);
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" || url.hostname !== hosts[source] || url.username || url.password) return [];
      if (source === "CVM" && !url.pathname.startsWith("/cvm/")) return [];
      if (!title || !Number.isFinite(date.getTime()) || date > now || now.getTime() - date.getTime() > 30 * 86400000)
        return [];
      url.hash = "";
      const summary = text(tag(entry, "description") || tag(entry, "summary") || tag(entry, "content"));
      return [
        {
          id: url.href,
          title,
          summary: summary.slice(0, 180) + (summary.length > 180 ? "…" : ""),
          url: url.href,
          source,
          publishedAt: date.toISOString(),
          ...classification(title, source),
        },
      ];
    } catch {
      return [];
    }
  });
}

async function boundedXml(response: Response) {
  if (!response.ok || Number(response.headers.get("content-length")) > 524288 || !response.body)
    throw new Error("Feed indisponível");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    xml = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 524288) throw new Error("Feed excedeu limite");
      xml += decoder.decode(value, { stream: true });
    }
    return xml + decoder.decode();
  } finally {
    await reader.cancel();
  }
}

export function createMarketNewsReader(fetcher: typeof fetch = fetch, clock = () => new Date()) {
  type Result = { items: MarketNews[]; unavailable: string[]; checkedAt: string };
  let cached: { expires: number; value: Result } | undefined;
  let pending: Promise<Result> | undefined;
  return async function read(): Promise<Result> {
    const now = clock();
    if (cached && cached.expires > now.getTime()) return cached.value;
    if (pending) return pending;
    const sources: [NewsSource, string][] = [
      ["BCB", "https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias"],
      [
        "CVM",
        `https://www.gov.br/cvm/pt-br/assuntos/noticias/${now.getUTCFullYear()}/RSS?sort_on=effective&sort_order=reverse`,
      ],
      ["Agência Brasil", "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml"],
    ];
    pending = (async () => {
      const results = await Promise.all(
        sources.map(async ([source, url]) => {
          try {
            const response = await fetcher(url, {
              method: "GET",
              redirect: "error",
              signal: AbortSignal.timeout(6000),
              headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
            });
            const xml = await boundedXml(response);
            if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Feed inválido");
            return { source, items: parseOfficialNews(xml, source, now), ok: true };
          } catch {
            return { source, items: [] as MarketNews[], ok: false };
          }
        }),
      );
      const unique = new Map(results.flatMap(result => result.items).map(item => [item.url, item]));
      const value = {
        items: [...unique.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12),
        unavailable: results.filter(result => !result.ok).map(result => result.source),
        checkedAt: now.toISOString(),
      };
      cached = { expires: now.getTime() + (value.items.length ? 600000 : 60000), value };
      return value;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
export const readMarketNews = createMarketNewsReader();
