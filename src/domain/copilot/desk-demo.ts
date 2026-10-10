/**
 * Dados de demonstração da Mesa Inteligente do Copiloto: política de mesa, arquivos e títulos fictícios.
 * Valores inventados para a apresentação do conceito; não são referência de mercado.
 */
import { type DeskFile, type DeskPolicy, type DeskTitle } from "./desk-engine";

export const deskDemoPolicy: DeskPolicy = {
  name: "Mesa padrão",
  version: "3.2",
  concentrationLimit: 30,
  rateFloor: 2.4,
  minDays: 15,
  operationFeeCents: 15000,
  perTitleFeeCents: 800,
  defaultRate: 2.9,
};

export const deskDemoFiles: DeskFile[] = [
  { name: "lote_nfe_outubro.xml", format: "XML", detail: "NF-e com duplicatas" },
  { name: "remessa_cnab400.rem", format: "CNAB", detail: "CNAB 400" },
  { name: "extrato_padrao.xlsx", format: "XLS", detail: "Layout padrão de extrato" },
];

export const DESK_NEW_DEBTOR = "Mercantil Boa Vista";

export const deskDemoTitles: DeskTitle[] = [
  {
    id: "t1",
    document: "NF 1187-1",
    debtor: "Rede Mercantil Nacional S.A.",
    amountCents: 1550000,
    days: 32,
    source: "XML",
  },
  {
    id: "t2",
    document: "NF 1187-2",
    debtor: "Rede Mercantil Nacional S.A.",
    amountCents: 1250000,
    days: 62,
    source: "XML",
  },
  { id: "t3", document: "NF 1192-1", debtor: "Supermercado Haag Ltda", amountCents: 975000, days: 45, source: "XML" },
  {
    id: "t4",
    document: "NF 1175-3",
    debtor: "Supermercado Haag Ltda",
    amountCents: 620000,
    days: 41,
    source: "XML",
    duplicate: true,
  },
  { id: "t5", document: "DM 5531", debtor: "Comercial Oeste Ltda", amountCents: 1170000, days: 28, source: "CNAB" },
  { id: "t6", document: "DM 5532", debtor: "Comercial Oeste Ltda", amountCents: 1180000, days: 58, source: "CNAB" },
  { id: "t7", document: "DM 5540", debtor: "Cooperativa Vale Verde", amountCents: 788000, days: 12, source: "CNAB" },
  {
    id: "t8",
    document: "PC 88-1",
    debtor: "Rede Mercantil Nacional S.A.",
    amountCents: 800000,
    days: 75,
    source: "XLS",
  },
  {
    id: "t9",
    document: "PC 91-1",
    debtor: DESK_NEW_DEBTOR,
    amountCents: 1450000,
    days: 49,
    source: "XLS",
    newDebtor: true,
  },
];

/** Formato reconhecido pela extensão do arquivo (a leitura real do conteúdo fica para o backend). */
export function deskFileFormat(fileName: string): Pick<DeskFile, "format" | "detail"> {
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  if (extension === "xml") return { format: "XML", detail: "NF-e" };
  if (["rem", "ret", "txt", "cnab"].includes(extension)) return { format: "CNAB", detail: "CNAB 240/400" };
  if (["xls", "xlsx", "csv"].includes(extension)) return { format: "XLS", detail: "Layout padrão de extrato" };
  return { format: "OUTRO", detail: "Formato não reconhecido" };
}
