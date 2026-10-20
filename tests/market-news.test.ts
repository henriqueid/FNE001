/** Feeds públicos: datas verificáveis, links permitidos e falhas isoladas. */
import { describe, expect, it, vi } from "vitest";
import { createMarketNewsReader, parseOfficialNews } from "@/src/server/home/market-news";

const now = new Date("2026-10-20T12:00:00Z");
const feed = `<rss><channel><item><title>Crédito &amp; juros</title>
<link>https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/credito</link>
<pubDate>Tue, 20 Oct 2026 09:00:00 -0300</pubDate>
<description>&lt;p&gt;Crédito para empresas cresce.&lt;/p&gt;</description></item></channel></rss>`;
describe("notícias oficiais do radar", () => {
  it("lê RSS e remove marcação sem executar conteúdo da fonte", () => {
    expect(parseOfficialNews(feed, "Agência Brasil", now)[0]).toMatchObject({
      title: "Crédito & juros",
      summary: "Crédito para empresas cresce.",
      source: "Agência Brasil",
      publishedAt: now.toISOString(),
    });
  });
  it("lê Atom do BCB e RSS 1.0 da CVM", () => {
    const atom = `<feed><entry><title>Copom divulga decisão</title><updated>2026-10-19T12:00:00Z</updated>
    <link rel="alternate" href="https://www.bcb.gov.br/detalhenoticia/1/noticia"/><content type="html">Juros e crédito</content></entry></feed>`;
    const rdf = `<rdf:RDF><item><title>FIDC: nova consulta pública</title><link>https://www.gov.br/cvm/pt-br/noticia</link>
    <dc:date>2026-10-18T12:00:00Z</dc:date><description>Consulta sobre fundos.</description></item></rdf:RDF>`;
    expect(parseOfficialNews(atom, "BCB", now)[0].topic).toBe("Juros e crédito");
    expect(parseOfficialNews(rdf, "CVM", now)[0].topic).toBe("Regulação");
  });
  it("descarta links externos, datas futuras, antigas e ausentes", () => {
    expect(parseOfficialNews(feed.replace("agenciabrasil.ebc.com.br", "exemplo.com"), "Agência Brasil", now)).toEqual(
      [],
    );
    expect(parseOfficialNews(feed.replace("20 Oct 2026", "21 Oct 2026"), "Agência Brasil", now)).toEqual([]);
    expect(parseOfficialNews(feed.replace("20 Oct 2026", "20 Aug 2026"), "Agência Brasil", now)).toEqual([]);
    expect(parseOfficialNews(feed.replace(/<pubDate>.*?<\/pubDate>/, ""), "Agência Brasil", now)).toEqual([]);
  });
  it("filtra notícias gerais sem relação temática com economia ou crédito", () => {
    expect(
      parseOfficialNews(
        feed.replace("Crédito &amp; juros", "Resultado de campeonato esportivo"),
        "Agência Brasil",
        now,
      ),
    ).toEqual([]);
  });
  it("isola fonte indisponível e reutiliza consulta pública em cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(feed)).mockRejectedValueOnce(new Error("Offline"));
    fetcher.mockImplementation(async (url: string) => {
      if (!url.includes("agenciabrasil")) throw new Error("Offline");
      return new Response(feed);
    });
    const read = createMarketNewsReader(fetcher as typeof fetch, () => now);
    const result = await read();
    expect(result.items).toHaveLength(1);
    expect(result.unavailable).toEqual(expect.arrayContaining(["BCB", "CVM"]));
    await read();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([, options]) => options.redirect === "error")).toBe(true);
  });
});
