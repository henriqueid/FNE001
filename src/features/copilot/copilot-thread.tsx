"use client";

/**
 * Conversa do Copiloto: cartão de início (sugestão do momento e nova análise com arquivos), andamento da tarefa,
 * pedido de autorização, cartão de resultado e respostas do Analista de Mesa com a ferramenta que foi chamada.
 */
import { type DeskReply } from "@/src/domain/copilot/desk-assistant";
import { type Cedent } from "@/src/domain/core/types";
import { AlertIcon, ArrowIcon, CheckIcon, ExpandIcon, FolderIcon, SparkIcon } from "@/src/ui/icons";
import { type DragEvent, useState } from "react";
import { DeskGate, DeskMoney } from "./copilot-analysis";
import { DecisionBar, type CopilotOperationActions } from "./copilot-decision-bar";
import { type CopilotDesk, DESK_STAGES } from "./use-copilot-desk";

export type CopilotSuggestion = { title: string; body: string; action: string; onAction: () => void };

const PROMPTS = [
  { text: "Resumo da carteira", hint: "Valor, prazo e vencidos", tag: "VISÃO EXECUTIVA" },
  { text: "Quais títulos estão vencidos?", hint: "Os maiores primeiro", tag: "COBRANÇA" },
  { text: "Maiores sacados da carteira", hint: "Concentração por sacado", tag: "RISCO" },
  { text: "Qual a regra de concentração?", hint: "Consulte a política ativa", tag: "POLÍTICA" },
];

export function StartCard({
  desk,
  cedents,
  suggestion,
  onAsk,
  showPrompts,
}: {
  desk: CopilotDesk;
  cedents: Cedent[];
  suggestion?: CopilotSuggestion;
  onAsk: (text: string) => void;
  showPrompts: boolean;
}) {
  const [over, setOver] = useState(false);
  const [showForm, setShowForm] = useState(desk.files.length > 0);
  const cedent = desk.cedent || cedents[0]?.id || "";
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    void desk.addFiles(event.dataTransfer.files);
  };
  return (
    <div className="cpl-start">
      <div className="cpl-hero">
        <span className="cpl-hero-mark">
          <SparkIcon />
        </span>
        <span className="cpl-eyebrow">INTELIGÊNCIA OPERACIONAL</span>
        <b>O que vamos decidir agora?</b>
        <p>Consulte a operação em tempo real, investigue riscos ou analise um novo lote com evidências rastreáveis.</p>
        <div className="cpl-trustline" aria-label="Recursos do Copiloto">
          <span>Dados do STRATO</span>
          <span>Fontes rastreáveis</span>
          <span>Decisão humana</span>
        </div>
      </div>
      {showPrompts && (
        <div className="cpl-prompts">
          {PROMPTS.map(item => (
            <button type="button" key={item.text} onClick={() => onAsk(item.text)}>
              <span className="cpl-prompt-top">
                <small>{item.tag}</small>
                <ArrowIcon />
              </span>
              <b>{item.text}</b>
              <span className="cpl-prompt-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
      {!showForm ? (
        <button type="button" className="cpl-start-action" onClick={() => setShowForm(true)}>
          <FolderIcon />
          <span>
            <b>Analisar um lote de recebíveis</b>
            <small>XML de NF-e, CSV no modelo ou campos comuns de remessa CNAB 240/400</small>
          </span>
          <ArrowIcon />
        </button>
      ) : (
        <div className="cpl-card">
          <b className="cpl-card-title">Nova análise de recebíveis</b>
          <label className="cpl-field">
            <span>Cedente</span>
            <select value={cedent} onChange={event => desk.setCedent(event.target.value)}>
              {cedents.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div
            className={`cpl-drop${over ? " is-over" : ""}`}
            onDragOver={event => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <FolderIcon />
            <span>Arraste XML de NF-e, CSV no modelo ou remessa CNAB 240/400 para revisão</span>
            <div className="cpl-drop-actions">
              <label className="cpl-ghost">
                Escolher arquivos
                <input
                  type="file"
                  multiple
                  className="cpl-sr"
                  accept=".xml,.rem,.ret,.txt,.cnab,.csv"
                  onChange={event => event.target.files && void desk.addFiles(event.target.files)}
                />
              </label>
              {desk.demoMode && (
                <button type="button" className="cpl-ghost" onClick={desk.loadExamples}>
                  Usar exemplos
                </button>
              )}
            </div>
          </div>
          {desk.files.length > 0 && (
            <ul className="cpl-files">
              {desk.files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <i data-format={file.format}>{file.format === "XLS" ? "CSV" : file.format}</i>
                  <span>{file.name}</span>
                  <small>{file.detail}</small>
                </li>
              ))}
            </ul>
          )}
          {desk.fileErrors.map(error => (
            <p className="cpl-note" key={error} role="alert">
              {error}
            </p>
          ))}
          {desk.intakeIssues.slice(0, 4).map(issue => (
            <p className="cpl-note" key={issue.id} role="alert">
              {issue.row ? `Linha ${issue.row} · ` : ""}
              {issue.message}
            </p>
          ))}
          {desk.userFiles && !desk.intakeIssues.length && !desk.fileErrors.length && (
            <p className="cpl-note">
              O conteúdo será lido localmente e avaliado pelo motor de políticas, mesmo sem IA.
            </p>
          )}
          <button
            type="button"
            className="cpl-primary"
            disabled={!desk.files.length || !cedent}
            onClick={() => {
              if (!desk.cedent) desk.setCedent(cedent);
              void desk.start();
            }}
          >
            Analisar
          </button>
          {!cedent && <p className="cpl-note">Selecione um cedente para aplicar score, limite e política.</p>}
          <p className="cpl-note">Roda em segundo plano: pode fechar a caixa e continuar trabalhando.</p>
        </div>
      )}
      {suggestion && (
        <div className="cpl-suggestion">
          <span className="cpl-suggestion-icon">
            <AlertIcon />
          </span>
          <div>
            <b>{suggestion.title}</b>
            <p>{suggestion.body}</p>
            <button type="button" className="cpl-link" onClick={suggestion.onAction}>
              {suggestion.action}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProgressCard({ desk }: { desk: CopilotDesk }) {
  const current = DESK_STAGES.findIndex(item => item.key === desk.stage);
  const completed = desk.stage === "concluida" ? DESK_STAGES.length : Math.max(current, 0);
  const progress = Math.round((completed / DESK_STAGES.length) * 100);
  return (
    <div className="cpl-card">
      <div className="cpl-progress-head">
        <div>
          <span>ANÁLISE EM CURSO</span>
          <b>{desk.waitingAuth ? "Aguardando você" : DESK_STAGES[Math.max(current, 0)]?.label}</b>
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="cpl-progress-bar" aria-label={`${progress}% concluído`}>
        <i style={{ width: `${progress}%` }} />
      </div>
      <ol className="cpl-rail">
        {DESK_STAGES.map((item, index) => {
          const done = index < current || desk.stage === "concluida";
          const state = done ? "done" : index === current ? (desk.waitingAuth ? "wait" : "now") : "next";
          return (
            <li key={item.key} data-state={state}>
              <i>{done && <CheckIcon />}</i>
              <div>
                <b>{item.label}</b>
                {desk.logs[item.key] && <p>{desk.logs[item.key]}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {desk.waitingAuth && (
        <div className="cpl-auth">
          <p>
            <b>Preciso da sua autorização.</b> {desk.context.titles.find(item => item.newDebtor)?.debtor} é um sacado
            novo e a política pede consulta ao birô antes de aprovar.
          </p>
          <div>
            <button type="button" className="cpl-primary is-small" onClick={() => void desk.authorize(true)}>
              Autorizar consulta
            </button>
            <button type="button" className="cpl-ghost" onClick={() => void desk.authorize(false)}>
              Seguir sem consultar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultCard({
  desk,
  onExpand,
  operationActions,
}: {
  desk: CopilotDesk;
  onExpand: () => void;
  operationActions: CopilotOperationActions;
}) {
  const scenario = desk.scenarios[desk.scenarios.length - 1];
  if (!scenario) return null;
  return (
    <div className="cpl-card cpl-result">
      <div className="cpl-result-head">
        <b>Cenário v{scenario.version}</b>
        <span>
          {scenario.result.count} títulos, política {desk.context.policy.name} v{desk.context.policy.version}
        </span>
      </div>
      <DeskMoney scenario={scenario} compact />
      <DeskGate scenario={scenario} />
      {desk.intakeIssues.length > 0 && (
        <p className="cpl-note">
          {desk.intakeIssues.length} linha(s) ficaram fora do cenário por inconsistência ou duplicidade. Consulte os
          apontamentos da entrada antes da decisão.
        </p>
      )}
      <DecisionBar desk={desk} operationActions={operationActions} />
      <div className="cpl-result-actions">
        <button type="button" className="cpl-ghost" onClick={onExpand}>
          <ExpandIcon /> Ver análise completa
        </button>
        <button type="button" className="cpl-ghost" onClick={desk.reset}>
          Nova análise
        </button>
      </div>
    </div>
  );
}

const SOURCE: Record<string, string> = {
  consultar_cadastro: "Cadastro",
  consultar_carteira: "Carteira",
  consultar_politica: "Política",
  consultar_operacoes: "Operações",
  consultar_comportamento: "Histórico autorizado do cliente",
  consultar_sistema: "Controles do ambiente",
  consultar_financeiro: "Financeiro",
  consultar_comercial: "Comercial",
  consultar_tarefas: "Tarefas atribuídas",
  simular_cenario: "Simulação no motor",
  explicar_apontamento: "Regra da política",
  comparar_cenarios: "Comparação de cenários",
  solicitar_excecao: "Pedido de alçada",
  encaminhar_formalizacao: "Formalização",
  openai_responses: "IA + contexto autorizado",
  copilot_error: "Falha na consulta",
};

export function ReplyBubble({
  reply,
  onViewMore,
  onAsk,
}: {
  reply: DeskReply;
  onViewMore?: (reply: DeskReply) => void;
  onAsk?: (question: string) => void;
}) {
  const source = reply.tool ? SOURCE[reply.tool.split("(")[0]] : undefined;
  return (
    <div className={`cpl-bubble is-ai${reply.tool?.startsWith("copilot_error") ? " is-error" : ""}`}>
      <span className="cpl-reply-author">
        <i>
          <SparkIcon />
        </i>
        STRATO
      </span>
      {reply.report && <strong className="cpl-report-title">{reply.report.title}</strong>}
      {reply.report && (
        <small>Posição de referência: {reply.report.referenceDate.split("-").reverse().join("/")}</small>
      )}
      {source && (
        <span className="cpl-tool" title={reply.tool}>
          Fonte: {source}
        </span>
      )}
      {reply.paragraphs.map(text => (
        <p key={text}>{text}</p>
      ))}
      {reply.report && (
        <dl className="cpl-report-metrics">
          {reply.report.metrics.map(metric => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {reply.table && (
        <div className="cpl-table is-mini">
          <table>
            <thead>
              <tr>
                {reply.table.head.map((cell, index) => (
                  <th key={`${cell}-${index}`}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reply.table.rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onViewMore && (
        <button type="button" className="cpl-ghost" onClick={() => onViewMore(reply)}>
          <ExpandIcon /> Ver mais
        </button>
      )}
      {onAsk &&
        reply.suggestedQuestions?.map(question => (
          <button key={question} type="button" className="cpl-ghost" onClick={() => onAsk(question)}>
            Consultar: {question}
          </button>
        ))}
    </div>
  );
}
