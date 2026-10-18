/** Leituras complementares de financeiro, comercial e tarefas; nenhuma ação ou cálculo é delegado à IA. */
import type { FinanceState } from "@/src/domain/finance/model";
import type { CommercialState } from "@/src/domain/commercial/types";
import type { TaskState } from "@/src/domain/tasks/model";
import type { CopilotReport } from "./report";
import { normalizedQuestion } from "./analytics";
export type OperationalData = {
  finance?: FinanceState | null;
  commercial?: CommercialState | null;
  tasks?: TaskState | null;
};
type Result = Pick<CopilotReport, "title" | "paragraphs" | "criterion" | "metrics" | "table" | "entityRefs"> & {
  source: "finance" | "commercial" | "task";
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function answerOperationalData(question: string, data: OperationalData, today: string): Result | null {
  const q = normalizedQuestion(question)
    .replace(/[?!.,]/g, "")
    .trim();
  const result: Result = {
    source: "finance",
    title: "Dados operacionais",
    paragraphs: [],
    criterion: "Registros internos autorizados; sem ações executadas.",
    metrics: [],
    entityRefs: [],
  };
  if (/financeiro|contas a pagar|contas a receber/.test(q)) {
    result.title = "Posição financeira";
    if (
      !/^(qual (e )?(o )?)?(meu |minha )?(resumo financeiro|posicao financeira|financeiro|contas a pagar|contas a receber)( vencidas| em aberto)?$/.test(
        q,
      )
    ) {
      result.paragraphs = [
        "Especifique uma consulta financeira suportada: resumo financeiro, contas a pagar ou contas a receber. Para um fornecedor ou período específico, use os filtros oficiais do Financeiro.",
      ];
      return result;
    }
    if (!data.finance) {
      result.paragraphs = [
        "Não há estado financeiro persistido disponível no seu acesso. Nenhum saldo de demonstração será utilizado.",
      ];
      return result;
    }
    const kind = /contas a pagar/.test(q) ? "Pagar" : /contas a receber/.test(q) ? "Receber" : undefined;
    const titles = data.finance.titles.filter(
      title =>
        title.status === "Em aberto" &&
        Number.isFinite(title.amount) &&
        title.amount > 0 &&
        (!kind || title.kind === kind) &&
        (!/vencidas/.test(q) || title.dueDate < today),
    );
    const total = titles.reduce((sum, title) => sum + Math.round(title.amount * 100), 0) / 100;
    result.metrics = [
      { label: "Valor em aberto", value: money(total) },
      { label: "Títulos financeiros", value: String(titles.length) },
    ];
    result.paragraphs = [
      `${titles.length} título(s) financeiro(s) em aberto, totalizando ${money(total)}. Essa posição é distinta dos recebíveis da Carteira e não representa saldo bancário.`,
    ];
    result.criterion =
      "Valor dos títulos financeiros com status Em aberto; exclui baixados e cancelados. Não presume conciliação bancária.";
    result.table = {
      head: ["Descrição", "Contraparte", "Empresa", "Tipo", "Vencimento", "Valor"],
      rows: [...titles]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
        .map(title => [
          title.description,
          title.counterparty,
          title.company,
          title.kind,
          title.dueDate,
          money(title.amount),
        ]),
    };
    result.entityRefs = titles.map(title => `finance:${title.id}`);
    return result;
  }
  if (/comercial|visitas|comites/.test(q)) {
    result.source = "commercial";
    result.title = "Histórico comercial";
    if (!/^(resumo comercial|comercial|visitas|comites)( realizados| aprovados)?$/.test(q)) {
      result.paragraphs = [
        "Especifique resumo comercial, visitas ou comitês. Comparações por período ou representante exigem os filtros oficiais do Comercial.",
      ];
      return result;
    }
    if (!data.commercial) {
      result.paragraphs = ["Não há estado comercial persistido disponível para seus vínculos e empresas."];
      return result;
    }
    const visits = /comites/.test(q)
      ? []
      : data.commercial.visits.filter(visit => !/realizados/.test(q) || visit.status === "Realizada");
    const committees = /visitas/.test(q)
      ? []
      : data.commercial.committees.filter(
          item => !/aprovados/.test(q) || item.status === "Aprovado" || item.status === "Aprovado com ressalvas",
        );
    result.paragraphs = [
      `${visits.length} visita(s) e ${committees.length} pauta(s) de comitê no conjunto autorizado. Opiniões comerciais e de risco permanecem atribuídas às fontes; uma decisão histórica não concede nova alçada.`,
    ];
    result.metrics = [
      { label: "Visitas", value: String(visits.length) },
      { label: "Pautas", value: String(committees.length) },
    ];
    result.table = {
      head: ["Data", "Registro", "Cliente", "Situação", "Detalhe"],
      rows: [
        ...visits.map(visit => [
          visit.date,
          "Visita",
          visit.target,
          visit.status,
          visit.notes ?? visit.outcome ?? "Sem observação",
        ]),
        ...committees.map(item => [
          item.date,
          "Comitê",
          item.clientName,
          item.status,
          item.conditions ?? item.riskOpinion ?? item.commercialOpinion,
        ]),
      ],
    };
    result.entityRefs = [
      ...visits.map(visit => `visit:${visit.id}`),
      ...committees.map(item => `committee:${item.id}`),
    ];
    return result;
  }
  if (/tarefas/.test(q)) {
    result.source = "task";
    result.title = "Tarefas autorizadas";
    if (!/^(minhas )?(tarefas|tarefas pendentes|tarefas concluidas)$/.test(q)) {
      result.paragraphs = [
        "Especifique tarefas, tarefas pendentes ou tarefas concluídas. Responsabilidades seguem a atribuição nominal do sistema.",
      ];
      return result;
    }
    const tasks = (data.tasks?.tasks ?? []).filter(task =>
      /concluidas/.test(q) ? task.status === "completed" : /pendentes/.test(q) ? task.status !== "completed" : true,
    );
    result.paragraphs = [
      `${tasks.length} tarefa(s) visíveis no seu acesso e com empresa identificada. Tarefas atribuídas a outra pessoa não compõem esta consulta.`,
    ];
    result.table = {
      head: ["Tarefa", "Responsável", "Situação", "Prazo"],
      rows: tasks.map(task => [task.snapshot.title, task.owner, task.status, task.dueAt]),
    };
    result.entityRefs = tasks.map(task => `task:${task.id}`);
    result.metrics = [{ label: "Tarefas", value: String(tasks.length) }];
    return result;
  }
  return null;
}
