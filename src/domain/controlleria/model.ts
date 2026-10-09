import { type Operation } from "@/src/domain/core/types";
import { daysBetween } from "@/src/domain/home/metrics";
import { portfolioBalance, type PortfolioTitleRecord } from "@/src/domain/portfolio/model";

export type ControlPriority = "critica" | "alta" | "media" | "baixa";

export type ControlCheck = {
  id: string;
  titleId: string;
  operationId?: string;
  ownerName: string;
  debtorName: string;
  documentNumber: string;
  dueDate: string;
  balance: number;
  status: string;
  priority: ControlPriority;
  issue: string;
};

export type FormalizationItem = {
  operation: Operation;
  readyDocuments: number;
  requiredDocuments: number;
  signed: number;
  signatures: number;
  pendingApprovals: number;
  progress: number;
  status: string;
};

export type ReconciliationItem = {
  title: PortfolioTitleRecord;
  issue: string;
  severity: ControlPriority;
  balance: number;
};

const closed = new Set(["Pago", "Recomprado", "Cancelado"]);

export function buildControlChecks(titles: PortfolioTitleRecord[], today: string): ControlCheck[] {
  return titles
    .filter(title => !closed.has(title.status) && portfolioBalance(title) > 0)
    .map(title => {
      const status = title.confirmation?.status ?? "Não iniciada";
      const late = daysBetween(title.dueDate, today);
      const priority: ControlPriority =
        status === "Divergente"
          ? "critica"
          : status === "Não localizado" || late >= 0
            ? "alta"
            : status === "Pendente"
              ? "media"
              : "baixa";
      return {
        id: `check:${title.id}`,
        titleId: title.id,
        operationId: title.operationId,
        ownerName: title.ownerName,
        debtorName: title.debtorName,
        documentNumber: title.documentNumber,
        dueDate: title.dueDate,
        balance: portfolioBalance(title),
        status,
        priority,
        issue:
          status === "Divergente"
            ? title.confirmation?.notes || "Divergência aberta na confirmação do título."
            : status === "Não localizado"
              ? "Sacado ainda não localizado."
              : status === "Confirmado"
                ? "Checagem concluída e rastreável."
                : "Confirmação de entrega, valor e vencimento pendente.",
      };
    })
    .sort((a, b) => {
      const rank = { critica: 4, alta: 3, media: 2, baixa: 1 };
      return rank[b.priority] - rank[a.priority] || b.balance - a.balance;
    });
}

export function buildFormalizationQueue(operations: Operation[]): FormalizationItem[] {
  return operations
    .filter(operation => operation.stage >= 5 && operation.status !== "Cancelada")
    .map(operation => {
      const review = operation.approvalReview;
      const documents = review?.documents ?? [];
      const required = documents.filter(item => item.required);
      const ready = required.filter(item => item.status === "Pronto" || item.status === "Dispensado").length;
      const signatures = review?.signatures ?? [];
      const signed = signatures.filter(item => item.status === "Assinado").length;
      const pendingApprovals = (review?.approvals ?? []).filter(item => item.status === "Pendente").length;
      const denominator = required.length + signatures.length + (review?.approvals?.length ?? 0);
      const completed = ready + signed + (review?.approvals ?? []).filter(item => item.status === "Aprovado").length;
      return {
        operation,
        readyDocuments: ready,
        requiredDocuments: required.length,
        signed,
        signatures: signatures.length,
        pendingApprovals,
        progress: denominator ? Math.round((completed / denominator) * 100) : 0,
        status: review?.status ?? "Preparação",
      };
    })
    .sort((a, b) => a.progress - b.progress || b.operation.amount - a.operation.amount);
}

export function buildReconciliationQueue(titles: PortfolioTitleRecord[]): ReconciliationItem[] {
  return titles
    .flatMap<ReconciliationItem>(title => {
      const balance = portfolioBalance(title);
      if (title.status === "Pago" && title.bankStatus !== "Liquidado")
        return [{ title, issue: "Baixa financeira sem liquidação bancária", severity: "critica", balance }];
      if (title.paidAmount > 0 && title.bankStatus === "Registrado")
        return [{ title, issue: "Recebimento parcial ainda não conciliado", severity: "alta", balance }];
      if (balance > 0 && title.bankStatus === "Sem boleto")
        return [{ title, issue: "Título em aberto sem boleto registrado", severity: "media", balance }];
      if (title.bankStatus === "Pendente de integração")
        return [{ title, issue: "Registro bancário aguardando retorno", severity: "baixa", balance }];
      return [];
    })
    .sort((a, b) => b.balance - a.balance);
}
