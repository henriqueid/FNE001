/**
 * Porta única de entrada por arquivo. Lê XML de NF-e e planilhas CSV, normaliza títulos,
 * associa sacados cadastrados, cadastra automaticamente os sacados novos com os dados do
 * arquivo, bloqueia duplicidades e produz um lote auditável.
 */
import {
  type Debtor,
  type EntryIntake,
  type EntryIntakeIssue,
  type ManualEntry,
  type ManualEntryData,
  type OperationSource,
} from "@/src/domain/core/types";

export type KnownTitle = Pick<ManualEntry, "documentNumber" | "debtorDocument">;

type RawTitle = {
  row: number;
  documentNumber: string;
  amount: string;
  dueDate: string;
  issueDate: string;
  debtorDocument: string;
  debtorName: string;
  nfeKey: string;
  cfop: string;
  state: string;
  city: string;
  observation: string;
  /** Dados cadastrais do destinatário da NF-e, usados para cadastrar um sacado novo. */
  debtorProfile?: DebtorProfile;
};

type DebtorProfile = {
  tradeName: string;
  address: string;
  number: string;
  district: string;
  zipCode: string;
  phone: string;
  email: string;
};

const digits = (value: string) => value.replace(/\D/g, "");
const clean = (value?: string) => (value ?? "").trim();
const signature = (title: Pick<RawTitle, "documentNumber" | "debtorDocument">) =>
  `${digits(title.debtorDocument)}|${clean(title.documentNumber).toLocaleLowerCase()}`;

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(36)}`;
}

function isoDate(value: string) {
  const normalized = clean(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function decimal(value: string) {
  const raw = clean(value).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitDelimited(line: string, delimiter: string) {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = "";
    } else current += char;
  }
  fields.push(current.trim());
  return fields;
}

const headerAliases: Record<keyof Omit<RawTitle, "row" | "debtorProfile">, string[]> = {
  documentNumber: ["documento", "numero", "titulo", "seu_numero", "document_number"],
  amount: ["valor", "valor_face", "face", "amount"],
  dueDate: ["vencimento", "data_vencimento", "due_date"],
  issueDate: ["emissao", "data_emissao", "issue_date"],
  debtorDocument: ["sacado_cnpj", "sacado_documento", "cpf_cnpj_sacado", "debtor_document"],
  debtorName: ["sacado", "sacado_nome", "nome_sacado", "debtor_name"],
  nfeKey: ["chave_nfe", "nfe", "nfe_key"],
  cfop: ["cfop"],
  state: ["uf", "estado", "state"],
  city: ["cidade", "municipio", "city"],
  observation: ["observacao", "obs", "observation"],
};

const headerKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function csvRows(text: string): { rows: RawTitle[]; issues: EntryIntakeIssue[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(line => line.trim());
  if (!lines.length) return { rows: [], issues: [] };
  const delimiter = [";", "\t", ","].sort(
    (a, b) => splitDelimited(lines[0], b).length - splitDelimited(lines[0], a).length,
  )[0];
  const headers = splitDelimited(lines[0], delimiter).map(headerKey);
  const column = (field: keyof Omit<RawTitle, "row" | "debtorProfile">) =>
    headers.findIndex(header => headerAliases[field].includes(header));
  const positions = Object.fromEntries(
    (Object.keys(headerAliases) as Array<keyof Omit<RawTitle, "row" | "debtorProfile">>).map(field => [
      field,
      column(field),
    ]),
  ) as Record<keyof Omit<RawTitle, "row" | "debtorProfile">, number>;
  const required = ["documentNumber", "amount", "dueDate", "debtorDocument"] as const;
  const missing = required.filter(field => positions[field] < 0);
  if (missing.length)
    return {
      rows: [],
      issues: [
        {
          id: "csv:headers",
          severity: "BLOQUEIO",
          code: "COLUNAS_OBRIGATORIAS",
          message: `Colunas obrigatórias ausentes: ${missing.map(field => headerAliases[field][0]).join(", ")}.`,
        },
      ],
    };
  const value = (fields: string[], field: keyof Omit<RawTitle, "row" | "debtorProfile">) =>
    positions[field] >= 0 ? clean(fields[positions[field]]) : "";
  return {
    issues: [],
    rows: lines.slice(1).map((line, index) => {
      const fields = splitDelimited(line, delimiter);
      return {
        row: index + 2,
        documentNumber: value(fields, "documentNumber"),
        amount: value(fields, "amount"),
        dueDate: value(fields, "dueDate"),
        issueDate: value(fields, "issueDate"),
        debtorDocument: value(fields, "debtorDocument"),
        debtorName: value(fields, "debtorName"),
        nfeKey: value(fields, "nfeKey"),
        cfop: value(fields, "cfop"),
        state: value(fields, "state"),
        city: value(fields, "city"),
        observation: value(fields, "observation"),
      };
    }),
  };
}

function tag(xml: string, name: string) {
  return clean(xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"))?.[1]);
}

function xmlRows(text: string): { rows: RawTitle[]; issues: EntryIntakeIssue[] } {
  const documents = text.match(/<(?:\w+:)?NFe\b[\s\S]*?<\/(?:\w+:)?NFe>/gi) ?? [text];
  const rows: RawTitle[] = [];
  documents.forEach((xml, documentIndex) => {
    const invoice = tag(xml, "nNF");
    const issueDate = tag(xml, "dhEmi") || tag(xml, "dEmi");
    const destination = xml.match(/<(?:\w+:)?dest\b[\s\S]*?<\/(?:\w+:)?dest>/i)?.[0] ?? "";
    const debtorDocument = tag(destination, "CNPJ") || tag(destination, "CPF");
    const debtorName = tag(destination, "xNome");
    const address = destination.match(/<(?:\w+:)?enderDest\b[\s\S]*?<\/(?:\w+:)?enderDest>/i)?.[0] ?? "";
    const debtorProfile: DebtorProfile = {
      tradeName: tag(destination, "xFant"),
      address: [tag(address, "xLgr"), tag(address, "xCpl")].filter(Boolean).join(", "),
      number: tag(address, "nro"),
      district: tag(address, "xBairro"),
      zipCode: digits(tag(address, "CEP")),
      phone: digits(tag(address, "fone")),
      email: tag(destination, "email"),
    };
    const nfeKey = digits(xml.match(/\bId=["']NFe(\d{44})["']/i)?.[1] ?? tag(xml, "chNFe"));
    const cfop = tag(xml, "CFOP");
    const installments = xml.match(/<(?:\w+:)?dup\b[\s\S]*?<\/(?:\w+:)?dup>/gi) ?? [];
    const normalizedInstallments = installments.length ? installments : [xml];
    normalizedInstallments.forEach((installment, installmentIndex) => {
      rows.push({
        row: rows.length + 1,
        documentNumber:
          tag(installment, "nDup") || `${invoice}${installments.length > 1 ? `/${installmentIndex + 1}` : ""}`,
        amount: tag(installment, "vDup") || tag(xml, "vNF"),
        dueDate: tag(installment, "dVenc"),
        issueDate,
        debtorDocument,
        debtorName,
        nfeKey,
        cfop,
        state: tag(address, "UF"),
        city: tag(address, "xMun"),
        observation: `NF-e ${invoice || documentIndex + 1}`,
        debtorProfile,
      });
    });
  });
  return {
    rows,
    issues: rows.length
      ? []
      : [
          {
            id: "xml:empty",
            severity: "BLOQUEIO",
            code: "XML_SEM_TITULOS",
            message: "Nenhum título foi localizado no XML.",
          },
        ],
  };
}

function issue(id: string, code: string, message: string, row: number, field?: string): EntryIntakeIssue {
  return { id, severity: "BLOQUEIO", code, message, row, field };
}

export function normalizeOperationIntake({
  source,
  fileName,
  text,
  debtors,
  knownTitles = [],
  importedAt,
}: {
  source: OperationSource;
  fileName: string;
  text: string;
  debtors: Debtor[];
  knownTitles?: KnownTitle[];
  importedAt: string;
}): { data: ManualEntryData; intake: EntryIntake } {
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase();
  const format: EntryIntake["format"] =
    extension === "xml" ? "XML" : extension === "xlsx" ? "XLSX" : source === "CNAB" ? "CNAB" : "CSV";
  let parsed: { rows: RawTitle[]; issues: EntryIntakeIssue[] };
  if (format === "XML") parsed = xmlRows(text);
  else if (format === "XLSX")
    parsed = {
      rows: [],
      issues: [
        {
          id: "xlsx:unsupported",
          severity: "BLOQUEIO",
          code: "XLSX_REQUER_LEITOR",
          message: "Salve a planilha como CSV UTF-8 para esta implantação.",
        },
      ],
    };
  else if (format === "CNAB" && !/[;\t,]/.test(text.split(/\r?\n/)[0] ?? ""))
    parsed = {
      rows: [],
      issues: [
        {
          id: "cnab:layout",
          severity: "BLOQUEIO",
          code: "CNAB_SEM_LAYOUT",
          message: "O leiaute CNAB deste banco ainda não foi configurado para a empresa.",
        },
      ],
    };
  else parsed = csvRows(text);

  const issues = [...parsed.issues];
  const seen = new Set<string>();
  const known = new Set(
    knownTitles.map(title => signature({ documentNumber: title.documentNumber, debtorDocument: title.debtorDocument })),
  );
  const accepted: ManualEntry[] = [];
  let matchedDebtors = 0;
  const newDebtors = new Map<string, Debtor>();
  parsed.rows.forEach(raw => {
    const rowIssues: EntryIntakeIssue[] = [];
    const documentNumber = clean(raw.documentNumber);
    const debtorDocument = digits(raw.debtorDocument);
    const amount = decimal(raw.amount);
    const dueDate = isoDate(raw.dueDate);
    const issueDate = isoDate(raw.issueDate);
    if (!documentNumber)
      rowIssues.push(
        issue(
          `row:${raw.row}:document`,
          "DOCUMENTO_AUSENTE",
          "Número do título não informado.",
          raw.row,
          "documentNumber",
        ),
      );
    if (amount <= 0)
      rowIssues.push(
        issue(`row:${raw.row}:amount`, "VALOR_INVALIDO", "Valor de face deve ser maior que zero.", raw.row, "amount"),
      );
    if (!dueDate)
      rowIssues.push(
        issue(`row:${raw.row}:due`, "VENCIMENTO_INVALIDO", "Vencimento ausente ou inválido.", raw.row, "dueDate"),
      );
    if (![11, 14].includes(debtorDocument.length))
      rowIssues.push(
        issue(
          `row:${raw.row}:debtor`,
          "DOCUMENTO_SACADO_INVALIDO",
          "CPF/CNPJ do sacado inválido.",
          raw.row,
          "debtorDocument",
        ),
      );
    const key = signature({ documentNumber, debtorDocument });
    if (seen.has(key))
      rowIssues.push(
        issue(`row:${raw.row}:duplicate`, "DUPLICIDADE_NO_ARQUIVO", "Título repetido dentro do arquivo.", raw.row),
      );
    if (known.has(key))
      rowIssues.push(
        issue(`row:${raw.row}:known`, "DUPLICIDADE_NA_BASE", "Título já existe em outra operação.", raw.row),
      );
    seen.add(key);
    const registered = debtors.find(item => digits(item.document) === debtorDocument);
    if (registered) matchedDebtors++;
    issues.push(...rowIssues);
    if (rowIssues.length) return;
    const debtor = registered ?? newDebtors.get(debtorDocument) ?? debtorFromImport(raw, debtorDocument, source);
    if (!registered) newDebtors.set(debtorDocument, debtor);
    accepted.push({
      id: `import-${hashText(`${fileName}|${raw.row}|${key}`)}`,
      documentNumber,
      amount,
      dueDate,
      issueDate,
      debtorId: debtor.id,
      debtorName: debtor.name,
      debtorDocument,
      nfeKey: digits(raw.nfeKey),
      cfop: clean(raw.cfop),
      state: debtor.state,
      city: debtor.city,
      observation: clean(raw.observation),
      discount: 0,
    });
  });
  const rejectedRows = parsed.rows.length - accepted.length;
  const status: EntryIntake["status"] = !accepted.length ? "BLOQUEADO" : issues.length ? "ATENCAO" : "PRONTO";
  return {
    data: { receivableType: "Duplicata", mode: "individual", entries: accepted },
    intake: {
      id: `intake-${hashText(`${fileName}|${text}`)}`,
      source,
      fileName,
      fileHash: hashText(text),
      importedAt,
      format,
      status,
      originalRows: parsed.rows.length,
      acceptedRows: accepted.length,
      rejectedRows,
      matchedDebtors,
      newDebtors: [...newDebtors.values()],
      issues,
    },
  };
}

function formatTaxId(document: string) {
  if (document.length === 14) return document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (document.length === 11) return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return document;
}

/**
 * Sacado que ainda não existe na base: nasce com os dados do arquivo (destinatário da NF-e
 * ou colunas da planilha). Fica "Completo" quando o arquivo traz endereço com CEP; caso
 * contrário, "Provisório" até a complementação. A consulta pública continua pendente.
 */
function debtorFromImport(raw: RawTitle, document: string, source: OperationSource): Debtor {
  const profile = raw.debtorProfile;
  const hasAddress = Boolean(profile?.address && profile.zipCode && clean(raw.city) && clean(raw.state));
  return {
    id: `deb-imp-${document}`,
    document: formatTaxId(document),
    name: clean(raw.debtorName) || `Sacado ${formatTaxId(document)}`,
    ...(profile?.tradeName ? { tradeName: profile.tradeName } : {}),
    address: profile?.address || "Endereço não informado no arquivo",
    number: profile?.number || "—",
    district: profile?.district || "—",
    city: clean(raw.city) || "Cidade não informada",
    state: clean(raw.state).toUpperCase() || "—",
    zipCode: profile?.zipCode ?? "",
    ...(profile?.email ? { email: profile.email } : {}),
    ...(profile?.phone ? { phone: profile.phone } : {}),
    source: "Integração",
    registrationStatus: hasAddress ? "Completo" : "Provisório",
    publicStatus: `Cadastrado automaticamente pela importação (${source}); consulta cadastral pendente`,
    portfolioReceivable: 0,
    portfolioOverdue: 0,
    settlements: 0,
    lateSettlements: 0,
    averageDelayDays: 0,
    repurchases: 0,
    incidents: 0,
  };
}

export const intakeCsvTemplate = () =>
  "documento;valor;vencimento;emissao;sacado_cnpj;sacado_nome;chave_nfe;cfop;uf;cidade;observacao\n" +
  "NF-001/01;12500,00;30/11/2026;04/10/2026;00000000000191;Sacado Exemplo;00000000000000000000000000000000000000000000;5102;SP;São Paulo;";
