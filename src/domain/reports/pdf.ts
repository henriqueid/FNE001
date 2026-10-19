/** PDF A4 paginado com fonte padrão WinAnsi; preserva acentos portugueses. */
import type { ExportReport, ReportCell, ReportColumn, ReportSection } from "./model";
const special = new Map(
  [..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"].map((char, i) => [
    char,
    [
      128, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 142, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154,
      155, 156, 158, 159,
    ][i],
  ]),
);
function latin(text: string) {
  return [...text.normalize("NFC")].map(char => {
    const code = char.codePointAt(0)!;
    return (code >= 32 && code <= 126) || (code >= 160 && code <= 255)
      ? code
      : (special.get(char) ?? (char === "\n" || char === "\r" || char === "\t" ? 32 : 63));
  });
}
function literal(text: string) {
  return latin(text)
    .map(byte =>
      byte === 40 || byte === 41 || byte === 92
        ? `\\${String.fromCharCode(byte)}`
        : byte < 32 || byte > 126
          ? `\\${byte.toString(8).padStart(3, "0")}`
          : String.fromCharCode(byte),
    )
    .join("");
}
function display(value: ReportCell, column: ReportColumn) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valor inválido no relatório.");
    return column.format === "money"
      ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
      : value.toLocaleString("pt-BR", { maximumFractionDigits: 8, useGrouping: false });
  }
  return column.format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(8)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
    : value;
}
function wrap(text: string, capacity: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let remaining = [...paragraph];
    if (!remaining.length) lines.push("");
    while (remaining.length) {
      let take = Math.min(capacity, remaining.length);
      if (take < remaining.length) {
        const space = remaining.slice(0, take).lastIndexOf(" ");
        if (space > capacity / 2) take = space + 1;
      }
      lines.push(remaining.slice(0, take).join("").trimEnd());
      remaining = remaining.slice(take);
    }
  }
  return lines;
}
export function reportToPdf(report: ExportReport): Uint8Array {
  const pages: string[][] = [];
  let commands: string[] = [],
    y = 0;
  const text = (value: string, x: number, at: number, size = 8, bold = false) =>
    commands.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${at.toFixed(2)} Tm (${literal(value)}) Tj ET`,
    );
  const rule = (at: number) => commands.push(`0.75 G 32 ${at.toFixed(2)} m 810 ${at.toFixed(2)} l S 0 G`);
  const newPage = () => {
    commands = [];
    pages.push(commands);
    y = 565;
    for (const line of wrap(report.title, 90)) {
      text(line, 32, y, 13, true);
      y -= 17;
    }
    for (const line of wrap(`Empresa / escopo: ${report.scope}`, 150)) {
      text(line, 32, y, 8);
      y -= 12;
    }
    text(
      `Período / posição: ${report.from ? `${report.from} a ` : ""}${report.to}   Emitido em: ${report.generatedAt}`,
      32,
      y,
    );
    y -= 20;
  };
  const tableHeader = (section: ReportSection, widths: number[]) => {
    for (const line of wrap(section.title, 130)) {
      text(line, 32, y, 10, true);
      y -= 15;
    }
    const wrapped = section.columns.map((column, i) =>
      wrap(column.label, Math.max(3, Math.floor((widths[i] - 10) / 4.8))),
    );
    const height = Math.max(...wrapped.map(lines => lines.length)) * 11 + 8;
    let x = 32;
    wrapped.forEach((lines, i) => {
      lines.forEach((line, j) => text(line, x + 4, y - j * 11, 8, true));
      x += widths[i];
    });
    y -= height;
    rule(y + 10);
  };
  newPage();
  for (const section of report.sections) {
    if (!section.columns.length) throw new Error("O relatório precisa de colunas.");
    const totalWeight = section.columns.reduce((sum, column) => sum + (column.width ?? 1), 0);
    const widths = section.columns.map(column => (778 * (column.width ?? 1)) / totalWeight);
    if (y < 110) newPage();
    tableHeader(section, widths);
    const rows = section.rows.length
      ? section.rows
      : [section.columns.map((_, i) => (i === 0 ? "Nenhum registro no período." : ""))];
    for (const row of rows) {
      if (row.length !== section.columns.length) throw new Error("Linha incompatível com as colunas do relatório.");
      const cells = row.map((value, i) =>
        wrap(display(value, section.columns[i]), Math.max(3, Math.floor((widths[i] - 10) / 4.8))),
      );
      const height = Math.max(...cells.map(lines => lines.length));
      if (height * 11 + 8 <= 400 && y - height * 11 < 60) {
        newPage();
        tableHeader(section, widths);
      }
      let cursor = 0;
      while (cursor < height) {
        if (y < 70) {
          newPage();
          tableHeader(section, widths);
        }
        const available = Math.max(1, Math.floor((y - 55) / 11)),
          count = Math.min(available, height - cursor);
        let x = 32;
        cells.forEach((lines, columnIndex) => {
          for (let i = 0; i < count; i++)
            if (lines[cursor + i] !== undefined) text(lines[cursor + i], x + 4, y - i * 11);
          x += widths[columnIndex];
        });
        y -= count * 11 + 8;
        rule(y + 10);
        cursor += count;
      }
    }
    y -= 15;
  }
  const allText = JSON.stringify(report);
  const replaced = [...allText.normalize("NFC")].some(char => {
    const code = char.codePointAt(0)!;
    return !((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || special.has(char));
  });
  pages.forEach((page, i) => {
    commands = page;
    text(`STRATO - Página ${i + 1} de ${pages.length}`, 32, 25, 8);
    if (replaced) text("Caracteres fora do alfabeto latino foram substituídos por ?.", 300, 25, 8);
  });
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
  ];
  const pageIds: number[] = [];
  for (const page of pages) {
    const pageId = objects.length + 1,
      streamId = pageId + 1,
      content = page.join("\n") + "\n";
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n%STRATO\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
