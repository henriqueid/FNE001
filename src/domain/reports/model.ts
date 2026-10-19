/** Modelo comum dos relatórios exportados, com valores e unidades explícitos. */
export type ReportCell = string | number;
export type ReportColumn = { label: string; format?: "money" | "number" | "date"; width?: number };
export type ReportSection = { title: string; columns: ReportColumn[]; rows: ReportCell[][] };
export type ExportReport = {
  title: string;
  scope: string;
  from?: string;
  to: string;
  generatedAt: string;
  sections: ReportSection[];
};
