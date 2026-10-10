"use client";

/**
 * Conversa do Copiloto: cartão de início (sugestão do momento e nova análise com arquivos), andamento da tarefa,
 * pedido de autorização, cartão de resultado e respostas do Analista de Mesa com a ferramenta que foi chamada.
 */
import { type DeskReply } from "@/src/domain/copilot/desk-assistant";
import { type Cedent } from "@/src/domain/core/types";
import { AlertIcon, ArrowIcon, CheckIcon, ExpandIcon, FolderIcon } from "@/src/ui/icons";
import { type DragEvent, useState } from "react";
import { DeskGate, DeskMoney } from "./copilot-analysis";
import { type CopilotDesk, DESK_STAGES } from "./use-copilot-desk";

export type CopilotSuggestion = { title: string; body: string; action: string; onAction: () => void };

const PROMPTS = [
  { text: "Resumo da carteira", hint: "Valor, prazo e vencidos" },
  { text: "Quais títulos estão vencidos?", hint: "Os maiores primeiro" },
  { text: "Maiores sacados da carteira", hint: "Concentração por sacado" },
  { text: "Qual a regra de concentração de sacado?", hint: "Política ativa" },
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
    desk.addFiles(event.dataTransfer.files);
  };
  return (
    <div className="cpl-start">
      <div className="cpl-hero">
        <b>Como posso ajudar?</b>
        <p>Pergunte sobre carteira, cedentes, sacados, operações ou política. Também analiso um lote de recebíveis.</p>
      </div>
      {showPrompts && (
        <div className="cpl-prompts">
          {PROMPTS.map(item => (
            <button type="button" key={item.text} onClick={() => onAsk(item.text)}>
              <b>{item.text}</b>
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      )}
      {!showForm ? (
        <button type="button" className="cpl-start-action" onClick={() => setShowForm(true)}>
          <FolderIcon />
          <span>
            <b>Analisar um lote de recebíveis</b>
            <small>XML de NF-e, CNAB 240/400 ou XLS padrão de extrato</small>
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
            <span>Arraste XML de NF-e, CNAB 240/400 ou XLS no layout padrão de extrato</span>
            <div className="cpl-drop-actions">
              <label className="cpl-ghost">
                Escolher arquivos
                <input
                  type="file"
                  multiple
                  className="cpl-sr"
                  accept=".xml,.rem,.ret,.txt,.cnab,.xls,.xlsx,.csv"
                  onChange={event => event.target.files && desk.addFiles(event.target.files)}
                />
              </label>
              <button type="button" className="cpl-ghost" onClick={desk.loadExamples}>
                Usar exemplos
              </button>
            </div>
          </div>
          {desk.files.length > 0 && (
            <ul className="cpl-files">
              {desk.files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <i data-format={file.format}>{file.format}</i>
                  <span>{file.name}</span>
                  <small>{file.detail}</small>
                </li>
              ))}
            </ul>
          )}
          {desk.userFiles && (
            <p className="cpl-note">
              Nesta demonstração o conteúdo dos arquivos não é lido: a análise usa títulos de exemplo.
            </p>
          )}
          <button
            type="button"
            className="cpl-primary"
            disabled={!desk.files.length}
            onClick={() => {
              if (!desk.cedent) desk.setCedent(cedent);
              void desk.start();
            }}
          >
            Analisar
          </button>
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
  return (
    <div className="cpl-card">
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

export function ResultCard({ desk, onExpand }: { desk: CopilotDesk; onExpand: () => void }) {
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
      <DecisionBar desk={desk} />
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
  simular_cenario: "Simulação no motor",
  explicar_apontamento: "Regra da política",
  comparar_cenarios: "Comparação de cenários",
  solicitar_excecao: "Pedido de alçada",
  encaminhar_formalizacao: "Formalização",
};

export function ReplyBubble({ reply }: { reply: DeskReply }) {
  const source = reply.tool ? SOURCE[reply.tool.split("(")[0]] : undefined;
  return (
    <div className="cpl-bubble is-ai">
      {source && (
        <span className="cpl-tool" title={reply.tool}>
          Fonte: {source}
        </span>
      )}
      {reply.paragraphs.map(text => (
        <p key={text}>{text}</p>
      ))}
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
              {reply.table.rows.map(row => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DecisionBar({ desk }: { desk: CopilotDesk }) {
  const scenario = desk.scenarios[desk.scenarios.length - 1];
  if (!scenario) return null;
  const { result } = scenario;
  if (desk.decision === "pending")
    return (
      <div className="cpl-decision">
        <span>Na alçada da Diretoria de crédito. Nesta demonstração você decide por ela.</span>
        <button type="button" className="cpl-primary is-small" onClick={() => desk.authorityDecides(true)}>
          Aprovar como Diretoria
        </button>
        <button type="button" className="cpl-ghost" onClick={() => desk.authorityDecides(false)}>
          Reprovar
        </button>
      </div>
    );
  if (desk.decision)
    return (
      <div className="cpl-decision" data-tone={desk.decision === "approved" ? "good" : "bad"}>
        <span>
          {desk.decision === "approved"
            ? "Aprovada e na fila de formalização manual."
            : "Reprovada pela alçada. Motivo registrado."}
        </span>
        <button type="button" className="cpl-ghost" onClick={desk.reset}>
          Nova análise
        </button>
      </div>
    );
  if (result.blockers.length) return null;
  return (
    <div className="cpl-decision">
      {result.fastTrack ? (
        <button type="button" className="cpl-primary is-small" onClick={desk.approveFast}>
          Aprovar operação <ArrowIcon />
        </button>
      ) : (
        <button type="button" className="cpl-primary is-small" onClick={desk.sendToAuthority}>
          Enviar para alçada <ArrowIcon />
        </button>
      )}
    </div>
  );
}
