"use client";

import type { AccessUser } from "@/src/domain/access/model";
import { taskAssigneeError, taskSnoozeError } from "@/src/domain/tasks/assignment";
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
import { type AppUserProfile, type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { type ManagedTask, type TaskCommand, type TaskStatus } from "@/src/domain/tasks/model";
import { AlertIcon, ArrowIcon, ChartIcon, CheckIcon, ClockIcon, CloseIcon, SparkIcon } from "@/src/ui/icons";
import { useEffect, useMemo, useState } from "react";

type Filter = "active" | TaskStatus | "all";
type ActionPanel = "delegate" | "snooze" | "complete" | null;

const filterLabels: { id: Filter; label: string }[] = [
  { id: "active", label: "Pendentes" },
  { id: "in_progress", label: "Em andamento" },
  { id: "snoozed", label: "Adiadas" },
  { id: "completed", label: "Concluídas" },
  { id: "all", label: "Todas" },
];

const statusLabel: Record<TaskStatus, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  snoozed: "Adiada",
  completed: "Concluída",
};

const actionLabel: Record<string, string> = {
  created: "Tarefa criada",
  assigned: "Responsabilidade alterada",
  started: "Trabalho iniciado",
  snoozed: "Lembrete adiado",
  completed: "Tarefa concluída",
  resolved: "Resolvida na origem",
  reopened: "Tarefa reaberta",
};

const formatMoment = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );

const tomorrowMorning = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function TaskIcon({ item }: { item: AttentionItem }) {
  if (item.kind === "decision") return <AlertIcon />;
  if (item.kind === "release") return <CheckIcon />;
  if (item.kind === "pace") return <ClockIcon />;
  return <ChartIcon />;
}

export function AttentionCenter({
  items,
  briefing,
  currentUser,
  assignees,
  tenantId,
  initialItemId,
  onClose,
  onOpenTask,
  onTaskCommand,
}: {
  items: ManagedTask[];
  briefing: DailyBriefingData;
  currentUser: AppUserProfile;
  assignees: AccessUser[];
  tenantId: string;
  initialItemId?: string;
  onClose: () => void;
  onOpenTask: (item: AttentionItem) => void;
  onTaskCommand: (id: string, command: TaskCommand) => void;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  const [selectedId, setSelectedId] = useState(initialItemId ?? items.find(item => item.status !== "completed")?.id);
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [note, setNote] = useState("");
  const [delegateTo, setDelegateTo] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState(tomorrowMorning);
  const active = items.filter(item => item.status !== "completed");
  const filtered = useMemo(
    () =>
      items.filter(item => {
        if (filter === "all") return true;
        if (filter === "active") return item.status === "open" || item.status === "in_progress";
        return item.status === filter;
      }),
    [items, filter],
  );
  const selected = filtered.find(item => item.id === selectedId) ?? filtered[0];
  const team = selected ? assignees.filter(member => !taskAssigneeError(selected, member, tenantId)) : [];
  const self = team.find(member => member.id === currentUser.id);
  const delegate = team.find(member => member.id === delegateTo);
  const snoozeError = actionPanel === "snooze" ? taskSnoozeError(snoozeUntil) : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (command: TaskCommand) => {
    if (!selected) return;
    onTaskCommand(selected.id, command);
    setActionPanel(null);
    setNote("");
  };

  return (
    <div
      className="attn-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section className="attn-center" role="dialog" aria-modal="true" aria-labelledby="attn-title">
        <header className="attn-head">
          <div className="attn-brand">
            <span>
              <SparkIcon />
            </span>
            <div>
              <small>STRATO INTELLIGENCE · ATUALIZAÇÃO CONTÍNUA</small>
              <h2 id="attn-title">Central do Dia</h2>
              <p>Uma fila única para o Copiloto, notificações e seu trabalho.</p>
            </div>
          </div>
          <div className="attn-live">
            <i /> Atualizada agora
          </div>
          <button className="attn-close" type="button" aria-label="Fechar Central do Dia" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="attn-overview">
          <article>
            <small>PENDÊNCIAS</small>
            <b>{active.length}</b>
            <span>no seu escopo</span>
          </article>
          <article>
            <small>EM ANDAMENTO</small>
            <b>{items.filter(item => item.status === "in_progress").length}</b>
            <span>com responsável</span>
          </article>
          <article>
            <small>CONCLUÍDO NA META</small>
            <b>{Math.round(briefing.revenueAttainment)}%</b>
            <span>ritmo do mês</span>
          </article>
          <article>
            <small>CONCLUÍDAS</small>
            <b>{items.filter(item => item.status === "completed").length}</b>
            <span>com histórico</span>
          </article>
        </div>

        <nav className="attn-filters" aria-label="Filtrar tarefas">
          {filterLabels.map(option => {
            const count =
              option.id === "all"
                ? items.length
                : option.id === "active"
                  ? items.filter(item => item.status === "open" || item.status === "in_progress").length
                  : items.filter(item => item.status === option.id).length;
            return (
              <button
                type="button"
                key={option.id}
                className={filter === option.id ? "is-active" : ""}
                onClick={() => {
                  setFilter(option.id);
                  setActionPanel(null);
                  const next = items.find(item =>
                    option.id === "all"
                      ? true
                      : option.id === "active"
                        ? item.status === "open" || item.status === "in_progress"
                        : item.status === option.id,
                  );
                  if (next) setSelectedId(next.id);
                }}
              >
                {option.label} <b>{count}</b>
              </button>
            );
          })}
        </nav>

        <div className="attn-body">
          <section className="attn-list" aria-label="Tarefas do dia">
            <header>
              <div>
                <small>FILA PRIORIZADA</small>
                <h3>Trabalho do dia</h3>
              </div>
              <span>{filtered.length === 1 ? "1 item" : `${filtered.length} itens`}</span>
            </header>
            {filtered.length ? (
              <ul>
                {filtered.map(item => (
                  <li key={item.id} data-tone={item.tone} data-status={item.status}>
                    <button
                      type="button"
                      className={selected?.id === item.id ? "is-selected" : ""}
                      onClick={() => {
                        setSelectedId(item.id);
                        setActionPanel(null);
                      }}
                    >
                      <span className="attn-task-icon">
                        <TaskIcon item={item} />
                      </span>
                      <span className="attn-task-copy">
                        <span>
                          <em>{statusLabel[item.status]}</em>
                          <i>{item.department}</i>
                        </span>
                        <b>{item.title}</b>
                        <small>
                          {item.status === "snoozed" && item.snoozedUntil
                            ? `Lembrarei ${formatMoment(item.snoozedUntil)}`
                            : item.summary}
                        </small>
                      </span>
                      <ArrowIcon />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="attn-empty">
                <CheckIcon />
                <b>Nada pendente neste filtro.</b>
              </div>
            )}
          </section>

          <aside className="attn-detail" aria-live="polite">
            {selected ? (
              <>
                <header data-tone={selected.tone}>
                  <span>
                    <TaskIcon item={selected} />
                  </span>
                  <div>
                    <small>
                      {selected.department} · {statusLabel[selected.status]}
                    </small>
                    <h3>{selected.title}</h3>
                  </div>
                </header>
                <div className="attn-detail-block">
                  <small>O QUE ACONTECEU</small>
                  <p>{selected.detail}</p>
                </div>
                <div className="attn-impact">
                  <small>IMPACTO</small>
                  <b>{selected.impact}</b>
                </div>
                <div className="attn-detail-block">
                  <small>PRÓXIMA MELHOR AÇÃO</small>
                  <p>{selected.nextAction}</p>
                </div>
                <dl>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{selected.owner}</dd>
                  </div>
                  <div>
                    <dt>Prazo</dt>
                    <dd>{formatMoment(selected.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>{selected.source === "automatic" ? "Copiloto" : "Manual"}</dd>
                  </div>
                </dl>

                {selected.status === "completed" ? (
                  <div className="attn-actions">
                    <button type="button" onClick={() => run({ type: "reopen", by: currentUser.name })}>
                      Reabrir tarefa
                    </button>
                  </div>
                ) : (
                  <div className="attn-actions">
                    <button
                      type="button"
                      disabled={!self}
                      onClick={() => {
                        if (!self) return;
                        run({
                          type: "assign",
                          by: currentUser.name,
                          owner: self.name,
                          ownerUserId: self.id,
                          department: self.department,
                        });
                      }}
                    >
                      Assumir
                    </button>
                    <button type="button" disabled={!team.length} onClick={() => setActionPanel("delegate")}>
                      Delegar
                    </button>
                    <button type="button" onClick={() => setActionPanel("snooze")}>
                      Adiar
                    </button>
                    <button className="is-primary" type="button" onClick={() => setActionPanel("complete")}>
                      Concluir
                    </button>
                  </div>
                )}

                {selected.status !== "completed" && !team.length && (
                  <p role="status">Nenhum destinatário compatível com a empresa, permissões e alçada desta tarefa.</p>
                )}

                {actionPanel && (
                  <div className="attn-action-panel">
                    <header>
                      <b>
                        {actionPanel === "delegate"
                          ? "Delegar tarefa"
                          : actionPanel === "snooze"
                            ? "Criar lembrete"
                            : "Concluir tarefa"}
                      </b>
                      <button type="button" aria-label="Cancelar ação" onClick={() => setActionPanel(null)}>
                        <CloseIcon />
                      </button>
                    </header>
                    {actionPanel === "delegate" && (
                      <label>
                        Responsável
                        <select
                          value={delegate ? delegateTo : ""}
                          onChange={event => setDelegateTo(event.target.value)}
                        >
                          <option value="">Selecione um responsável</option>
                          {team.map(member => (
                            <option key={member.id} value={member.id}>
                              {member.name} · {member.department}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {actionPanel === "snooze" && (
                      <label>
                        Lembrar novamente
                        <input
                          type="datetime-local"
                          value={snoozeUntil}
                          onChange={event => setSnoozeUntil(event.target.value)}
                        />
                      </label>
                    )}
                    {snoozeError && <p role="alert">{snoozeError}</p>}
                    <label>
                      {actionPanel === "complete" ? "Registro da conclusão" : "Observação (opcional)"}
                      <textarea
                        value={note}
                        onChange={event => setNote(event.target.value)}
                        placeholder="Deixe um contexto para a equipe"
                      />
                    </label>
                    <button
                      className="attn-confirm-action"
                      type="button"
                      disabled={(actionPanel === "delegate" && !delegate) || !!snoozeError}
                      onClick={() => {
                        if (actionPanel === "snooze" && taskSnoozeError(snoozeUntil)) return;
                        if (actionPanel === "complete") run({ type: "complete", by: currentUser.name, note });
                        if (actionPanel === "snooze")
                          run({
                            type: "snooze",
                            by: currentUser.name,
                            until: new Date(snoozeUntil).toISOString(),
                            note,
                          });
                        if (actionPanel === "delegate") {
                          const member = team.find(item => item.id === delegateTo);
                          if (!member || taskAssigneeError(selected, member, tenantId)) return;
                          run({
                            type: "assign",
                            by: currentUser.name,
                            owner: member.name,
                            ownerUserId: member.id,
                            department: member.department,
                            note,
                          });
                        }
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                )}

                <div className="attn-history">
                  <small>HISTÓRICO DA TAREFA</small>
                  <ol>
                    {[...selected.history]
                      .reverse()
                      .slice(0, 4)
                      .map(entry => (
                        <li key={entry.id}>
                          <i />
                          <div>
                            <b>{actionLabel[entry.action] ?? entry.action}</b>
                            <p>{entry.detail}</p>
                            <span>
                              {entry.by} · {formatMoment(entry.at)}
                            </span>
                          </div>
                        </li>
                      ))}
                  </ol>
                </div>

                <button className="attn-open-tab" type="button" onClick={() => onOpenTask(selected)}>
                  Abrir contexto em nova aba <ArrowIcon />
                </button>
                <small className="attn-tab-hint">
                  Sua tela atual permanece aberta para você continuar de onde parou.
                </small>
              </>
            ) : (
              <div className="attn-empty">
                <CheckIcon />
                <b>Seu dia está em ordem.</b>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
