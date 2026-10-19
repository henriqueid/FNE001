/** Regressões dos arquivos de relatório: dados, escaping, números e paginação. */
import { describe, expect, it } from "vitest";
import { reportToXlsx } from "@/src/domain/reports/xlsx";
import { reportToPdf } from "@/src/domain/reports/pdf";
import type { ExportReport } from "@/src/domain/reports/model";
const report: ExportReport = {
  title: "Balancete e conciliação",
  scope: "Empresa São João & Filhos",
  from: "2026-10-01",
  to: "2026-10-18",
  generatedAt: "2026-10-18T12:00:00.000Z",
  sections: [
    {
      title: "Movimentação",
      columns: [
        { label: "Histórico", width: 3 },
        { label: "Débitos", format: "money" },
        { label: "Créditos", format: "money" },
      ],
      rows: [
        ["Ação <contrato> & (conta) \\ teste", 1234.56, 0],
        ['=HYPERLINK("evil")', 0, 1234.56],
        ["Totais do período", 1234.56, 1234.56],
      ],
    },
  ],
};
function files(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const result = new Map<string, string>();
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true),
      nameSize = view.getUint16(offset + 26, true),
      extra = view.getUint16(offset + 28, true);
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameSize));
    const start = offset + 30 + nameSize + extra;
    result.set(name, new TextDecoder().decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  return result;
}
describe("XLSX real", () => {
  it("contém pacote OOXML, células numéricas e texto seguro", () => {
    const content = files(reportToXlsx(report));
    expect(content.has("[Content_Types].xml")).toBe(true);
    expect(content.has("xl/workbook.xml")).toBe(true);
    const sheet = content.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("1234.56");
    expect(sheet).toContain("Ação &lt;contrato&gt; &amp;");
    expect(sheet).toContain("=HYPERLINK");
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain("Empresa São João &amp; Filhos");
  });
  it("rejeita números não finitos", () => {
    expect(() =>
      reportToXlsx({ ...report, sections: [{ ...report.sections[0], rows: [["Inválido", NaN, 0]] }] }),
    ).toThrow();
  });
});
describe("PDF real", () => {
  it("tem índice de objetos válido em offsets de bytes e texto escapado", () => {
    const bytes = reportToPdf(report);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.")).toBe(true);
    expect(text).toContain("/WinAnsiEncoding");
    expect(text).toContain("1234,56");
    expect(text).toContain("\\(conta\\)");
    expect(text).toContain("\\\\ teste");
    const offset = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(offset, offset + 4)).toBe("xref");
    for (const match of text.matchAll(/^(\d{10}) 00000 n /gm))
      expect(text.slice(Number(match[1]))).toMatch(/^\d+ 0 obj/);
  });
  it("preserva todas as linhas em múltiplas páginas com cabeçalhos repetidos", () => {
    const rows = Array.from({ length: 180 }, (_, i) => [
      `Linha ${i} com descrição que deve permanecer no relatório`,
      i,
      i,
    ]);
    const text = new TextDecoder().decode(reportToPdf({ ...report, sections: [{ ...report.sections[0], rows }] }));
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain("Linha 179");
    expect((text.match(/Movimenta/g) ?? []).length).toBeGreaterThan(1);
  });
  it("explicita substituição de caracteres fora de WinAnsi", () => {
    const text = new TextDecoder().decode(reportToPdf({ ...report, scope: "Empresa 漢字" }));
    expect(text).toContain("substitu");
  });
});
import { buildAccountingReport } from "@/src/domain/reports/accounting";
import { buildControlReport } from "@/src/domain/reports/controlleria";
import { buildControlChecks, buildReconciliationQueue } from "@/src/domain/controlleria/model";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { emptyFinance, seedFinance } from "@/src/domain/finance/setup";
import { post } from "@/src/domain/finance/ledger";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
describe("fontes e totais dos relatórios", () => {
  it("respeita empresa e período, mantém saldos anteriores e totais balanceados", () => {
    const state = emptyFinance();
    for (const [company, date, amount] of [
      ["Empresa A", "2026-09-30", 500],
      ["Empresa A", "2026-10-18", 250],
      ["Empresa B", "2026-10-18", 900],
    ] as const)
      post(
        state,
        {
          date,
          company,
          history: `Receita ${company}`,
          origin: { type: "Título", id: "CR-1" },
          lines: [
            { ledger: "1.1.3.01", debit: amount, credit: 0 },
            { ledger: "4.1.02", debit: 0, credit: amount },
          ],
        },
        "Teste",
      );
    const tb = buildAccountingReport(state, "Empresa A", "2026-10-01", "2026-10-18", "balancete");
    expect(tb.sections[0].rows.find(row => String(row[0]).startsWith("1.1.3.01"))?.slice(2)).toEqual([
      500, 250, 0, 750,
    ]);
    expect(tb.sections[0].rows.at(-1)).toEqual(["Totais do período", "", 0, 250, 250, 0]);
    const dre = buildAccountingReport(state, "Empresa A", "2026-10-01", "2026-10-18", "dre");
    expect(dre.sections[2].rows).toEqual([["Receitas menos despesas", 250]]);
    const journal = buildAccountingReport(state, "Empresa A", "2026-10-01", "2026-10-18", "diario");
    expect(journal.sections[0].rows).toHaveLength(3);
    expect(JSON.stringify(journal)).not.toContain("Empresa B");
    expect(journal.sections[0].rows.at(-1)?.slice(-2)).toEqual([250, 250]);
  });
  it("não soma exposições sobrepostas como se fossem posições diferentes", () => {
    const checks = [
      {
        id: "C1",
        titleId: "T1",
        ownerName: "Cedente",
        debtorName: "Sacado",
        documentNumber: "D1",
        dueDate: "2026-10-18",
        balance: 125.45,
        status: "Divergente",
        priority: "critica" as const,
        issue: "Valor diferente",
      },
    ];
    const report = buildControlReport("Empresa A", "2026-10-18", checks, [], []);
    expect(report.sections[0].rows[1]).toEqual(["Checagem pendente", 1, 125.45]);
    expect(report.sections[1].rows.at(-1)).toEqual(["Total da fila", "", "", "", "", "", 125.45]);
    expect(report.sections[0].title).toContain("sobrepor");
  });
});
it.skipIf(!process.env.STRATO_REPORT_QA_DIR)(
  "gera amostras para verificação independente em diretório privado",
  async () => {
    const state = seedFinance("2026-10-18");
    const data = buildAccountingReport(
      state,
      "Consolidado",
      "2026-09-01",
      "2026-10-18",
      "diario",
      "2026-10-18T12:00:00.000Z",
    );
    const root = process.env.STRATO_REPORT_QA_DIR!;
    await writeFile(join(root, "diario.pdf"), reportToPdf(data));
    await writeFile(join(root, "diario.xlsx"), reportToXlsx(data));
    await writeFile(join(root, "expected.json"), JSON.stringify(data));
    for (const view of ["balancete", "dre"] as const) {
      const accounting = buildAccountingReport(state, "Consolidado", "2026-09-01", "2026-10-18", view);
      await writeFile(join(root, `${view}.pdf`), reportToPdf(accounting));
      await writeFile(join(root, `${view}.xlsx`), reportToXlsx(accounting));
    }
    const titles = seedPortfolio([]).titles;
    const controls = buildControlReport(
      "Consolidado",
      "2026-10-18",
      buildControlChecks(titles, "2026-10-18"),
      [],
      buildReconciliationQueue(titles),
    );
    await writeFile(join(root, "controladoria.pdf"), reportToPdf(controls));
    await writeFile(join(root, "controladoria.xlsx"), reportToXlsx(controls));
    // Texto longo e caracteres portugueses exercitam paginação sem depender do volume da demonstração.
    const long = {
      ...report,
      sections: [
        {
          ...report.sections[0],
          rows: Array.from({ length: 180 }, (_, i) => [
            `Linha ${i} - Conciliação São João (contrato) com texto adicional preservado`,
            i + 0.25,
            i + 0.25,
          ]),
        },
      ],
    };
    await writeFile(join(root, "multipagina.pdf"), reportToPdf(long));
    await writeFile(join(root, "multipagina.xlsx"), reportToXlsx(long));
  },
);
it("recusa período impossível antes de exportar números vazios", () => {
  expect(() => buildAccountingReport(emptyFinance(), "Empresa A", "2026-02-30", "2026-03-01", "balancete")).toThrow();
});
