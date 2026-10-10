"use client";

import { type AttentionItem, type AttentionKind } from "@/src/domain/copilot/attention-center";
import { type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { AlertIcon, ArrowIcon, ChartIcon, CheckIcon, ClockIcon, CloseIcon, SparkIcon } from "@/src/ui/icons";
import { useEffect, useMemo, useState } from "react";

type Filter = "all" | AttentionKind;

const filterLabels: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "decision", label: "Decisões" },
  { id: "release", label: "Prontas" },
  { id: "pace", label: "Ritmo" },
  { id: "collection", label: "Cobrança" },
];

function TaskIcon({ item }: { item: AttentionItem }) {
  if (item.kind === "decision") return <AlertIcon />;
  if (item.kind === "release") return <CheckIcon />;
  if (item.kind === "pace") return <ClockIcon />;
  return <ChartIcon />;
}

export function AttentionCenter({
  items,
  briefing,
  initialItemId,
  onClose,
  onOpenTask,
}: {
  items: AttentionItem[];
  briefing: DailyBriefingData;
  initialItemId?: string;
  onClose: () => void;
  onOpenTask: (item: AttentionItem) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(initialItemId ?? items[0]?.id);
  const filtered = useMemo(() => items.filter(item => filter === "all" || item.kind === filter), [items, filter]);
  const selected = items.find(item => item.id === selectedId) ?? filtered[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            <b>{items.length}</b>
            <span>no seu escopo</span>
          </article>
          <article>
            <small>CRÍTICAS</small>
            <b>{items.filter(item => item.tone === "critical").length}</b>
            <span>pedem decisão</span>
          </article>
          <article>
            <small>CONCLUÍDO NA META</small>
            <b>{Math.round(briefing.revenueAttainment)}%</b>
            <span>ritmo do mês</span>
          </article>
          <article>
            <small>CARTEIRA</small>
            <b>{briefing.overdueCount}</b>
            <span>títulos vencidos</span>
          </article>
        </div>

        <nav className="attn-filters" aria-label="Filtrar tarefas">
          {filterLabels.map(option => {
            const count = option.id === "all" ? items.length : items.filter(item => item.kind === option.id).length;
            return (
              <button
                type="button"
                key={option.id}
                className={filter === option.id ? "is-active" : ""}
                onClick={() => {
                  setFilter(option.id);
                  const next = items.find(item => option.id === "all" || item.kind === option.id);
                  if (next) setSelectedId(next.id);
                }}
              >
                {option.label} <b>{count}</b>
              </button>
            );
          })}
        </nav>

        <div className="attn-body">
          <section className="attn-list" aria-label="Tarefas que pedem atenção">
            <header>
              <div>
                <small>FILA PRIORIZADA</small>
                <h3>Tarefas que pedem atenção</h3>
              </div>
              <span>{filtered.length === 1 ? "1 item" : `${filtered.length} itens`}</span>
            </header>
            {filtered.length ? (
              <ul>
                {filtered.map(item => (
                  <li key={item.id} data-tone={item.tone}>
                    <button
                      type="button"
                      className={selected?.id === item.id ? "is-selected" : ""}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="attn-task-icon">
                        <TaskIcon item={item} />
                      </span>
                      <span className="attn-task-copy">
                        <span>
                          <em>{item.timing}</em>
                          <i>{item.department}</i>
                        </span>
                        <b>{item.title}</b>
                        <small>{item.summary}</small>
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
                      {selected.department} · {selected.timing}
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
                    <dt>Origem</dt>
                    <dd>Copiloto + Notificações</dd>
                  </div>
                  <div>
                    <dt>Atualização</dt>
                    <dd>Em tempo real</dd>
                  </div>
                </dl>
                <button className="attn-open-tab" type="button" onClick={() => onOpenTask(selected)}>
                  Abrir tarefa em nova aba <ArrowIcon />
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
