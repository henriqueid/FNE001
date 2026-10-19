/** Pacote XLSX OOXML sem dependência externa; texto é sempre célula literal. */
import type { ExportReport, ReportCell, ReportColumn } from "./model";
const encoder = new TextEncoder();
const xml = (text: string) =>
  text
    .replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!)
    .split("")
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join("");
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function columnName(index: number): string {
  let name = "";
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: [string, string][]) {
  const parts: Uint8Array[] = [],
    directory: Uint8Array[] = [];
  let offset = 0;
  for (const [path, content] of files) {
    const name = encoder.encode(path),
      data = encoder.encode(content),
      crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const local = new DataView(header.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x800, true);
    local.setUint16(12, 33, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    header.set(name, 30);
    parts.push(header, data);
    const central = new Uint8Array(46 + name.length),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += header.length + data.length;
  }
  const centralSize = directory.reduce((sum, part) => sum + part.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...parts, ...directory, end]) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}
function cell(value: ReportCell, ref: string, column?: ReportColumn, style = 0) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("O relatório contém um valor numérico inválido.");
    return `<c r="${ref}" s="${column?.format === "money" ? 2 : style}"><v>${value}</v></c>`;
  }
  if (column?.format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))) {
    const date = new Date(value);
    if (date.toISOString().slice(0, 10) !== value) throw new Error("Data inválida no relatório.");
    return `<c r="${ref}" s="3"><v>${Date.parse(value) / 86400000 + 25569}</v></c>`;
  }
  if (value.length > 32767) throw new Error("Uma célula excede o limite de texto do Excel.");
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
export function reportToXlsx(report: ExportReport): Uint8Array {
  const rows: string[] = [];
  let rowNumber = 0;
  const add = (values: ReportCell[], columns?: ReportColumn[], style = 0) => {
    rowNumber++;
    if (rowNumber > 1048576) throw new Error("O relatório excede o limite de linhas do Excel.");
    const lines = Math.max(
      1,
      ...values.map((value, i) =>
        typeof value === "string"
          ? value
              .split("\n")
              .reduce((total, part) => total + Math.max(1, Math.ceil(part.length / (i === 0 ? 33 : 23))), 0)
          : 1,
      ),
    );
    const height = Math.min(409, Math.max(28, lines * 14 + 8));
    rows.push(
      `<row r="${rowNumber}" ht="${height}" customHeight="1">${values.map((value, i) => cell(value, `${columnName(i)}${rowNumber}`, columns?.[i], style)).join("")}</row>`,
    );
  };
  add([report.title], undefined, 1);
  add(["Empresa / escopo", report.scope]);
  add(["Período / posição", report.from ? `${report.from} a ${report.to}` : report.to]);
  add(["Emitido em", report.generatedAt]);
  add([]);
  let maxColumns = 1;
  for (const section of report.sections) {
    if (section.columns.length > 16384) throw new Error("O relatório excede o limite de colunas do Excel.");
    maxColumns = Math.max(maxColumns, section.columns.length);
    add([section.title], undefined, 1);
    add(
      section.columns.map(c => c.label),
      undefined,
      1,
    );
    for (const row of section.rows) {
      if (row.length !== section.columns.length) throw new Error("Linha incompatível com as colunas do relatório.");
      add(row, section.columns);
    }
    add([]);
  }
  const widths = Array.from(
    { length: maxColumns },
    (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 35 : 25}" customWidth="1"/>`,
  ).join("");
  const sheet = `${declaration}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${widths}</cols><sheetData>${rows.join("")}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles = `${declaration}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red](&quot;R$&quot; #,##0.00)"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    [
      "[Content_Types].xml",
      `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `${declaration}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Relatório" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", styles],
    ["xl/worksheets/sheet1.xml", sheet],
  ]);
}
