"use client";

/**
 * Copiloto flutuante do STRATO: ícone redondo no canto da tela que abre uma caixa de diálogo de conversa.
 * Na caixa compacta o operador inicia a análise de um lote (XML, CNAB ou XLS), acompanha a tarefa, autoriza
 * consultas e conversa com o Analista de Mesa. "Expandir" abre a análise completa ao lado da conversa.
 * A tarefa segue rodando com a caixa fechada; o ícone mostra andamento e avisa quando há algo para ver.
 */
import { useEligibilityPolicies } from "@/src/app/eligibility-policy-context";
import { useCedents } from "@/src/app/registry-context";
import { deskSuggestions } from "@/src/domain/copilot/desk-assistant";
import { type SystemKnowledge, systemSuggestions } from "@/src/domain/copilot/system-query";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { isoDate, portfolioTitles } from "@/src/domain/home/metrics";
import { ShellContext } from "@/src/features/shell/shell-context";
import { CloseIcon, ExpandIcon, SendIcon, SparkIcon, UndoIcon } from "@/src/ui/icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CopilotAnalysis } from "./copilot-analysis";
import { type CopilotSuggestion, ProgressCard, ReplyBubble, ResultCard, StartCard } from "./copilot-thread";
import { useCopilotDesk } from "./use-copilot-desk";

export type { CopilotSuggestion } from "./copilot-thread";

export function Copilot({ suggestion }: { suggestion?: CopilotSuggestion }) {
  const cedents = useCedents();
  const operations = useContext(ShellContext)?.operations;
  const policies = useEligibilityPolicies();
  const knowledge = useMemo<SystemKnowledge>(
    () => ({
      operations: operations ?? [],
      cedents,
      titles: portfolioTitles(operations ?? []),
      policies: policies ?? seedEligibilityPolicies().policies,
      rules: masterRuleCatalog,
      parameters: operationalParametersFor(),
      today: isoDate(new Date()),
    }),
    [operations, cedents, policies],
  );
  const desk = useCopilotDesk(knowledge);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const cedent = cedents.find(item => item.id === (desk.cedent || cedents[0]?.id));
  const hasResult = desk.scenarios.length > 0;
  const { clearUnread } = desk;

  useEffect(() => {
    if (open) clearUnread();
  }, [open, desk.messages.length, desk.waitingAuth, clearUnread]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread && desk.messages.length) thread.scrollTop = thread.scrollHeight;
  }, [desk.messages.length, desk.stage, desk.waitingAuth, open, expanded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    desk.ask(value);
    setDraft("");
  };

  const status = desk.waitingAuth
    ? "Aguardando sua autorização"
    : desk.busy
      ? "Analisando em segundo plano"
      : hasResult
        ? `${cedent?.name ?? "Análise"}, cenário v${desk.scenarios[desk.scenarios.length - 1].version}`
        : "Pronto para ajudar";

  const thread = (
    <div className="cpl-thread" ref={threadRef} aria-live="polite">
      {desk.stage === "idle" && (
        <StartCard
          desk={desk}
          cedents={cedents}
          suggestion={suggestion}
          onAsk={send}
          showPrompts={!desk.messages.length}
        />
      )}
      {desk.messages.map(message =>
        message.role === "me" ? (
          <div key={message.id} className="cpl-bubble is-me">
            {message.text}
          </div>
        ) : message.role === "ai" ? (
          <ReplyBubble key={message.id} reply={message.reply} />
        ) : message.card === "progress" ? (
          <ProgressCard key={message.id} desk={desk} />
        ) : expanded ? null : (
          <ResultCard key={message.id} desk={desk} onExpand={() => setExpanded(true)} />
        ),
      )}
    </div>
  );

  const chips = hasResult && !desk.locked ? deskSuggestions(desk.scenarios) : systemSuggestions;
  const composer = (
    <div className="cpl-composer">
      {(hasResult || desk.messages.length > 0) && (
        <div className="cpl-chips">
          {chips.map(item => (
            <button type="button" key={item} onClick={() => send(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      <form
        className="cpl-input"
        onSubmit={event => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Pergunte sobre a carteira ou a política"
          aria-label="Mensagem para o Copiloto"
        />
        <button type="submit" aria-label="Enviar" disabled={!draft.trim()}>
          <SendIcon />
        </button>
      </form>
    </div>
  );

  return (
    <>
      {open && expanded && <div className="cpl-scrim" role="presentation" onClick={() => setExpanded(false)} />}
      {open && (
        <section
          className={`cpl-dialog${expanded ? " is-expanded" : ""}`}
          role="dialog"
          aria-modal={expanded}
          aria-label="Copiloto STRATO"
        >
          <header className="cpl-head">
            <span className="cpl-avatar" data-busy={desk.busy || undefined}>
              <SparkIcon />
            </span>
            <div>
              <b>Copiloto STRATO</b>
              <small>
                <i className="cpl-status-dot" data-state={desk.waitingAuth ? "wait" : desk.busy ? "busy" : "on"} />
                {status}
              </small>
            </div>
            {(desk.messages.length > 0 || desk.stage !== "idle") && (
              <button
                type="button"
                className="cpl-icon cpl-icon-label"
                title="Limpar a conversa e começar de novo"
                onClick={() => {
                  desk.reset();
                  setExpanded(false);
                  setDraft("");
                }}
              >
                <UndoIcon />
                <span>Nova conversa</span>
              </button>
            )}
            {hasResult && (
              <button
                type="button"
                className="cpl-icon"
                aria-label={expanded ? "Reduzir" : "Expandir análise"}
                aria-pressed={expanded}
                onClick={() => setExpanded(value => !value)}
              >
                <ExpandIcon />
              </button>
            )}
            <button type="button" className="cpl-icon" aria-label="Fechar Copiloto" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </header>
          {expanded ? (
            <div className="cpl-split">
              <CopilotAnalysis desk={desk} cedent={cedent} knowledge={knowledge} />
              <div className="cpl-chat">
                {thread}
                {composer}
              </div>
            </div>
          ) : (
            <>
              {thread}
              {composer}
            </>
          )}
        </section>
      )}
      <button
        type="button"
        className={`cpl-launcher${open ? " is-open" : ""}`}
        data-busy={desk.busy || undefined}
        aria-label={open ? "Fechar Copiloto" : "Abrir Copiloto"}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {open ? <CloseIcon /> : <SparkIcon />}
        {!open && desk.unread && <i className="cpl-badge" aria-hidden="true" />}
      </button>
      {!open && desk.unread && (
        <button type="button" className="cpl-nudge" onClick={() => setOpen(true)}>
          {desk.waitingAuth ? "Preciso da sua autorização" : "Análise concluída"}
        </button>
      )}
    </>
  );
}
