/** Exporta as filas de Controladoria já filtradas pelo escopo ativo. */
import type { ControlCheck, FormalizationItem, ReconciliationItem } from "@/src/domain/controlleria/model";
import { round2 } from "@/src/domain/finance/ledger";
import type { ExportReport } from "./model";
export function buildControlReport(
  scope: string,
  today: string,
  checks: ControlCheck[],
  formalization: FormalizationItem[],
  reconciliation: ReconciliationItem[],
  generatedAt = new Date().toISOString(),
): ExportReport {
  const pending = checks.filter(check => check.status !== "Confirmado");
  const sum = (rows: { balance: number }[]) => round2(rows.reduce((total, row) => total + row.balance, 0));
  return {
    title: "Controles e formalização",
    scope,
    to: today,
    generatedAt,
    sections: [
      {
        title: "Resumo das filas (os controles podem se sobrepor)",
        columns: [{ label: "Controle", width: 3 }, { label: "Quantidade" }, { label: "Saldo (BRL)", format: "money" }],
        rows: [
          ["Checagens monitoradas", checks.length, sum(checks)],
          ["Checagem pendente", pending.length, sum(pending)],
          [
            "Checagem divergente",
            checks.filter(check => check.status === "Divergente").length,
            sum(checks.filter(check => check.status === "Divergente")),
          ],
          ["Conciliação pendente", reconciliation.length, sum(reconciliation)],
        ],
      },
      {
        title: "Checagem por título",
        columns: [
          { label: "Documento", width: 1.3 },
          { label: "Cedente", width: 2 },
          { label: "Sacado", width: 2 },
          { label: "Vencimento", format: "date", width: 1.2 },
          { label: "Situação", width: 1.3 },
          { label: "Pendência", width: 3 },
          { label: "Saldo (BRL)", format: "money", width: 1.3 },
        ],
        rows: [
          ...checks.map(item => [
            item.documentNumber,
            item.ownerName,
            item.debtorName,
            item.dueDate,
            item.status,
            item.issue,
            item.balance,
          ]),
          ["Total da fila", "", "", "", "", "", sum(checks)],
        ],
      },
      {
        title: "Formalização por operação",
        columns: [
          { label: "Operação", width: 1.2 },
          { label: "Empresa", width: 2 },
          { label: "Cedente", width: 2 },
          { label: "Valor (BRL)", format: "money", width: 1.5 },
          { label: "Documentos", width: 1.1 },
          { label: "Assinaturas", width: 1.1 },
          { label: "Alçadas pendentes", width: 1.1 },
          { label: "Progresso (%)", width: 1.1 },
        ],
        rows: [
          ...formalization.map(item => [
            item.operation.proposal,
            item.operation.vehicle,
            item.operation.cedent,
            item.operation.amount,
            `${item.readyDocuments}/${item.requiredDocuments}`,
            `${item.signed}/${item.signatures}`,
            item.pendingApprovals,
            item.progress,
          ]),
          [
            "Total da fila",
            "",
            "",
            round2(formalization.reduce((total, item) => total + item.operation.amount, 0)),
            "",
            "",
            "",
            "",
          ],
        ],
      },
      {
        title: "Conciliação por título",
        columns: [
          { label: "Documento", width: 1.2 },
          { label: "Cedente", width: 2 },
          { label: "Sacado", width: 2 },
          { label: "Situação bancária", width: 1.5 },
          { label: "Pendência", width: 3 },
          { label: "Saldo (BRL)", format: "money", width: 1.3 },
        ],
        rows: [
          ...reconciliation.map(item => [
            item.title.documentNumber,
            item.title.ownerName,
            item.title.debtorName,
            item.title.bankStatus,
            item.issue,
            item.balance,
          ]),
          ["Total da fila", "", "", "", "", sum(reconciliation)],
        ],
      },
    ],
  };
}
