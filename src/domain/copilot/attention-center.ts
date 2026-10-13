import { operationsForUser, userHasFunctionalArea, type AppUserProfile, type UserScopeContext } from "./daily-briefing";
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { isSlower, type PortfolioTitle } from "@/src/domain/home/metrics";
import { type AppView } from "@/src/features/shell/shell-context";

export type AttentionTone = "critical" | "warning" | "info" | "good";
export type AttentionKind = "decision" | "release" | "pace" | "collection";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  tone: AttentionTone;
  title: string;
  summary: string;
  detail: string;
  impact: string;
  nextAction: string;
  owner: string;
  department: string;
  timing: string;
  view: AppView;
  operation?: Operation;
};

const stageName = (operation: Operation) => stages.find(stage => stage.id === operation.stage)?.title ?? "Operação";
const blockersLabel = (count: number) => `${count} ${count === 1 ? "bloqueio impede" : "bloqueios impedem"}`;
const titlesLabel = (count: number) => `${count} ${count === 1 ? "título" : "títulos"}`;

export function buildAttentionItems({
  operations,
  titles,
  user,
  referenceDate,
  scope,
}: {
  operations: Operation[];
  titles: PortfolioTitle[];
  user: AppUserProfile;
  referenceDate: string;
  scope?: UserScopeContext;
}) {
  const scoped = operationsForUser(operations, user, scope).filter(operation => operation.status !== "Cancelada");
  const items: AttentionItem[] = [];

  scoped.forEach(operation => {
    if (operation.blockers > 0) {
      items.push({
        id: `${operation.id}-decision`,
        kind: "decision",
        tone: "critical",
        title: `${operation.cedent} aguarda decisão`,
        summary: `${blockersLabel(operation.blockers)} o avanço na etapa ${stageName(operation)}.`,
        detail: `A operação ${operation.aditivoNumber} tem ${titlesLabel(operation.titleCount)} e permanece retida até a revisão da exceção ou da alçada responsável.`,
        impact: `${money.format(operation.amount)} em originação aguardando decisão`,
        nextAction: "Revisar bloqueios e registrar a decisão",
        owner: operation.owner,
        department: operation.stage === 1 ? "Cadastro" : operation.stage === 2 ? "Risco e crédito" : "Operações",
        timing: "Agora",
        view: "operations",
        operation,
      });
      return;
    }

    if (operation.status === "Pronta para liberar" || operation.status === "Pronta para formalizar") {
      const release = operation.status === "Pronta para liberar";
      items.push({
        id: `${operation.id}-release`,
        kind: "release",
        tone: "good",
        title: release ? `Liberar ${operation.cedent}` : `Formalizar ${operation.cedent}`,
        summary: release
          ? "A operação concluiu as validações e está pronta para a janela financeira."
          : "A análise foi concluída e a documentação pode seguir para formalização.",
        detail: `Aditivo ${operation.aditivoNumber}, ${titlesLabel(operation.titleCount)}, líquido de ${money.format(operation.netAmount)}.`,
        impact: release
          ? `${money.format(operation.netAmount)} prontos para pagamento`
          : `${money.format(operation.amount)} prontos para formalização`,
        nextAction: release
          ? "Conferir favorecidos e autorizar a liberação"
          : "Conferir documentos e iniciar a formalização",
        owner: operation.owner,
        department: release ? "Financeiro" : "Controladoria",
        timing: "Hoje",
        view: release ? "finance" : "operations",
        operation,
      });
      return;
    }

    if (isSlower(operation))
      items.push({
        id: `${operation.id}-pace`,
        kind: "pace",
        tone: "warning",
        title: `${operation.cedent} saiu do ritmo`,
        summary: `A etapa ${stageName(operation)} está acima do tempo histórico desse cliente.`,
        detail: `Tempo atual de ${Math.max(1, Math.round(operation.elapsedMinutes / 60))}h contra um padrão de ${Math.max(1, Math.round(operation.clientAverageMinutes / 60))}h.`,
        impact: `${money.format(operation.amount)} podem atrasar o fluxo do dia`,
        nextAction: "Identificar a pendência e combinar o próximo passo",
        owner: operation.owner,
        department: "Operações",
        timing: "Acompanhar",
        view: "operations",
        operation,
      });
  });

  const documents = new Set([
    ...scoped.map(operation => operation.document.replace(/\D/g, "")),
    ...(user.cedentDocuments ?? []).map(document => document.replace(/\D/g, "")),
  ]);
  const overdue = titles.filter(
    title =>
      title.dueDate < referenceDate &&
      (user.access === "admin" ||
        userHasFunctionalArea(user, "Diretoria") ||
        documents.has(title.ownerDocument.replace(/\D/g, ""))),
  );
  if (overdue.length) {
    const total = overdue.reduce((sum, title) => sum + title.amount, 0);
    items.push({
      id: "portfolio-overdue",
      kind: "collection",
      tone: "warning",
      title: overdue.length === 1 ? "1 título vencido pede ação" : `${overdue.length} títulos vencidos pedem ação`,
      summary: "A carteira tem recebíveis vencidos que ainda precisam de cobrança, negociação ou recompra.",
      detail: `A posição de ${referenceDate.split("-").reverse().join("/")} reúne ${titlesLabel(overdue.length)} vencido${overdue.length === 1 ? "" : "s"} na carteira do seu escopo.`,
      impact: `${money.format(total)} em exposição vencida`,
      nextAction: "Abrir a agenda de cobrança e priorizar os maiores valores",
      owner: user.access === "admin" ? "Equipe de cobrança" : user.name,
      department: "Carteira e cobrança",
      timing: "Hoje",
      view: "portfolio",
    });
  }

  const order: Record<AttentionTone, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  return items.sort((left, right) => order[left.tone] - order[right.tone]);
}

export function attentionItemHref(item: AttentionItem) {
  const query = new URLSearchParams({ view: item.view, attention: item.id });
  if (item.operation) query.set("operation", item.operation.id);
  return `/?${query.toString()}`;
}
