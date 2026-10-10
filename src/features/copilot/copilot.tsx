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
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
import { type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { type SystemKnowledge, systemSuggestions } from "@/src/domain/copilot/system-query";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { isoDate, portfolioTitles } from "@/src/domain/home/metrics";
import { ShellContext } from "@/src/features/shell/shell-context";
import { ArrowIcon, CloseIcon, ExpandIcon, SendIcon, SparkIcon, UndoIcon } from "@/src/ui/icons";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CopilotAnalysis } from "./copilot-analysis";
import { type CopilotSuggestion, ProgressCard, ReplyBubble, ResultCard, StartCard } from "./copilot-thread";
import { useCopilotDesk } from "./use-copilot-desk";
import { type AccessUser } from "@/src/domain/access/model";
import { aiStatusLabel, type IntelligenceState } from "@/src/domain/intelligence/model";

export type { CopilotSuggestion } from "./copilot-thread";

export function Copilot({
  suggestion,
  dailyBriefing,
  attentionItems,
  onOpenAttention,
  currentUser,
  intelligence,
}: {
  suggestion?: CopilotSuggestion;
  dailyBriefing: DailyBriefingData;
  attentionItems: AttentionItem[];
  onOpenAttention: (itemId?: string) => void;
  currentUser: AccessUser;
  intelligence: IntelligenceState;
}) {
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
  const desk = useCopilotDesk(knowledge, currentUser, intelligence, cedents[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const cedent = cedents.find(item => item.id === (desk.cedent || cedents[0]?.id));
  const hasResult = desk.scenarios.length > 0;
  const criticalCount = attentionItems.filter(item => item.tone === "critical").length;
  const attentionReminder = criticalCount
    ? criticalCount === 1
      ? "1 decisão aguarda você"
      : `${criticalCount} decisões aguardam você`
    : attentionItems.length === 1
      ? "1 tarefa ainda pede atenção"
      : `${attentionItems.length} tarefas ainda pedem atenção`;
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
          showPrompts={!desk.messages.length && desk.aiAvailable}
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
            <button type="button" key={item} onClick={() => send(item)} disabled={!desk.aiAvailable}>
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
        <span className="cpl-input-mark" aria-hidden="true">
          <SparkIcon />
        </span>
        <textarea
          rows={1}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          placeholder={
            desk.aiAvailable ? "Pergunte, investigue ou simule um cenário…" : "IA indisponível nesta organização"
          }
          aria-label="Mensagem para o Copiloto"
          disabled={!desk.aiAvailable}
        />
        <button type="submit" aria-label="Enviar" disabled={!draft.trim() || !desk.aiAvailable}>
          <SendIcon />
        </button>
        <small className="cpl-input-hint">Enter envia · Shift + Enter quebra a linha</small>
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
            <div className="cpl-brand">
              <span className="cpl-avatar" data-busy={desk.busy || undefined}>
                <SparkIcon />
              </span>
              <div>
                <span className="cpl-brand-kicker">STRATO INTELLIGENCE</span>
                <b>Copiloto operacional</b>
                <small>
                  <i className="cpl-status-dot" data-state={desk.waitingAuth ? "wait" : desk.busy ? "busy" : "on"} />
                  {status}
                </small>
              </div>
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
          <button type="button" className="cpl-live-day" onClick={() => onOpenAttention()}>
            <span className="cpl-live-day-icon">
              <SparkIcon />
            </span>
            <span>
              <small>SEU DIA · ATUALIZADO AGORA</small>
              <b>
                {attentionItems.length
                  ? `${attentionItems.length} tarefas pedem sua atenção`
                  : "Nenhuma pendência crítica"}
              </b>
            </span>
            <span className="cpl-live-day-meta">
              <b>{Math.round(dailyBriefing.revenueAttainment)}%</b>
              <small>da meta</small>
            </span>
            <ArrowIcon />
          </button>
          <div className="cpl-ai-state" data-enabled={desk.aiAvailable || undefined} role="status">
            <b>{desk.aiAvailable ? "Insight com apoio de IA" : "Análise do motor de políticas · sem IA"}</b>
            <span>{aiStatusLabel(intelligence)} · cálculos e alçadas permanecem determinísticos.</span>
          </div>
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
        {!open && (desk.unread || attentionItems.length > 0) && (
          <i className="cpl-badge" aria-label={`${attentionItems.length} tarefas pendentes`}>
            {attentionItems.length || ""}
          </i>
        )}
      </button>
      {!open && (desk.unread || attentionItems.length > 0) && (
        <button
          type="button"
          className="cpl-nudge"
          data-tone={criticalCount ? "critical" : undefined}
          onClick={() => (desk.unread ? setOpen(true) : onOpenAttention(attentionItems[0]?.id))}
        >
          {desk.waitingAuth ? "Preciso da sua autorização" : desk.unread ? "Análise concluída" : attentionReminder}
        </button>
      )}
    </>
  );
}
