"use client";

import { type AccessUser } from "@/src/domain/access/model";
import {
  buildLiveOperators,
  formatLiveDuration,
  type LiveOperator,
  type LivePresence,
} from "@/src/domain/live-operations/model";
import { type Operation } from "@/src/domain/core/types";
import { ArrowIcon, ClockIcon, SearchIcon, UsersIcon } from "@/src/ui/icons";
import { useEffect, useMemo, useState } from "react";

const presenceLabel: Record<LivePresence, string> = { active: "Em atividade", away: "Ausente", offline: "Offline" };

export default function LiveOperations({
  users,
  currentUser,
  operations,
  onOpenOperation,
}: {
  users: AccessUser[];
  currentUser: AccessUser;
  operations: Operation[];
  onOpenOperation: (operation: Operation) => void;
}) {
  const [query, setQuery] = useState("");
  const [presence, setPresence] = useState<"all" | LivePresence>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [clock, setClock] = useState(() => new Date());
  const operators = useMemo(() => buildLiveOperators(users, currentUser, operations), [currentUser, operations, users]);
  const filtered = operators.filter(operator => {
    const text = `${operator.user.name} ${operator.user.department} ${operator.task} ${operator.context}`.toLowerCase();
    return (presence === "all" || operator.presence === presence) && text.includes(query.trim().toLowerCase());
  });
  const selected = operators.find(operator => operator.user.id === selectedId);
  const online = operators.filter(operator => operator.presence !== "offline").length;
  const alerts = operators.filter(operator => operator.alert).length;
  const averageSession = Math.round(
    operators.reduce((total, operator) => total + operator.sessionMinutes, 0) / Math.max(online, 1),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="lv-page">
      <header className="lv-header">
        <div>
          <span className="lv-eyebrow">
            <i /> GESTÃO EM TEMPO REAL
          </span>
          <h1>Operação ao vivo</h1>
          <p>Acompanhe presença, contexto e resultados da sua equipe sem visualizar conteúdo pessoal.</p>
        </div>
        <div className="lv-updated">
          <i />
          <span>
            <b>Atualizado agora</b>
            <small>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
          </span>
        </div>
      </header>

      <section className="lv-kpis" aria-label="Resumo da operação ao vivo">
        <article>
          <span>
            <UsersIcon />
          </span>
          <div>
            <small>ONLINE AGORA</small>
            <b>
              {online} <em>de {operators.length}</em>
            </b>
          </div>
        </article>
        <article>
          <span>
            <ClockIcon />
          </span>
          <div>
            <small>TEMPO MÉDIO CONECTADO</small>
            <b>{formatLiveDuration(averageSession)}</b>
          </div>
        </article>
        <article>
          <span className="lv-pulse" />
          <div>
            <small>EM ATIVIDADE</small>
            <b>{operators.filter(item => item.presence === "active").length}</b>
          </div>
        </article>
        <article data-alert={alerts > 0 || undefined}>
          <span>!</span>
          <div>
            <small>PEDINDO ATENÇÃO</small>
            <b>{alerts}</b>
          </div>
        </article>
      </section>

      <section className="lv-board">
        <div className="lv-toolbar">
          <div className="lv-search">
            <SearchIcon />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar pessoa, tarefa ou carteira"
              aria-label="Buscar na equipe"
            />
          </div>
          <div className="lv-filters" aria-label="Filtrar por presença">
            {(
              [
                ["all", "Todos"],
                ["active", "Em atividade"],
                ["away", "Ausentes"],
                ["offline", "Offline"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={presence === value ? "is-active" : ""}
                onClick={() => setPresence(value)}
              >
                {label}
                {value !== "all" && <b>{operators.filter(item => item.presence === value).length}</b>}
              </button>
            ))}
          </div>
        </div>

        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Atividade agora</th>
                <th>Contexto</th>
                <th>Sessão</th>
                <th>Progresso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(operator => (
                <tr key={operator.user.id} data-presence={operator.presence}>
                  <td>
                    <div className="lv-person">
                      <span>
                        {operator.user.name
                          .split(" ")
                          .map(part => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <b>{operator.user.name}</b>
                        <small>
                          <i /> {presenceLabel[operator.presence]} · {operator.user.role}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <b>{operator.task}</b>
                    <small>
                      {operator.screen} · há {operator.activityMinutes || 0} min
                    </small>
                    {operator.alert && <em className="lv-alert">{operator.alert}</em>}
                  </td>
                  <td>
                    <b>{operator.context}</b>
                    <small>{operator.result}</small>
                  </td>
                  <td>
                    <b>{operator.presence === "offline" ? "—" : formatLiveDuration(operator.sessionMinutes)}</b>
                    <small>{operator.user.department}</small>
                  </td>
                  <td>
                    <div className="lv-progress">
                      <span>
                        <i style={{ width: `${operator.progress}%` }} />
                      </span>
                      <b>{operator.progress}%</b>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="lv-open"
                      aria-label={`Ver atividade de ${operator.user.name}`}
                      onClick={() => setSelectedId(operator.user.id)}
                    >
                      <ArrowIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="lv-empty">
              <UsersIcon />
              <b>Nenhuma pessoa encontrada</b>
              <span>Ajuste a busca ou o filtro de presença.</span>
            </div>
          )}
        </div>
      </section>
      <p className="lv-privacy">
        A Operação ao Vivo registra eventos de trabalho do STRATO. Ela não captura a tela, mensagens pessoais ou
        conteúdo digitado.
      </p>
      {selected && (
        <OperatorDrawer
          operator={selected}
          onClose={() => setSelectedId(undefined)}
          onOpenOperation={onOpenOperation}
        />
      )}
    </div>
  );
}

function OperatorDrawer({
  operator,
  onClose,
  onOpenOperation,
}: {
  operator: LiveOperator;
  onClose: () => void;
  onOpenOperation: (operation: Operation) => void;
}) {
  const events = [
    { time: "Agora", title: operator.task, detail: `${operator.screen} · ${operator.context}`, current: true },
    { time: "Há 18 min", title: "Resultado registrado", detail: operator.result },
    {
      time: "Há 42 min",
      title: "Tarefa anterior concluída",
      detail: operator.operation ? `Operação ${operator.operation.proposal} atualizada` : "Fila operacional revisada",
    },
    {
      time: formatLiveDuration(operator.sessionMinutes),
      title: "Sessão iniciada",
      detail: "Acesso autenticado no STRATO",
    },
  ];
  return (
    <div
      className="lv-drawer-layer"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <aside className="lv-drawer" role="dialog" aria-modal="true" aria-label={`Atividade de ${operator.user.name}`}>
        <header>
          <div className="lv-drawer-person">
            <span>
              {operator.user.name
                .split(" ")
                .map(part => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <small>{operator.user.department}</small>
              <h2>{operator.user.name}</h2>
              <p>{operator.user.role}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <section className="lv-now">
          <span className="lv-eyebrow">
            <i /> ATIVIDADE ATUAL
          </span>
          <h3>{operator.task}</h3>
          <p>{operator.screen}</p>
          <dl>
            <div>
              <dt>Contexto</dt>
              <dd>{operator.context}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>{operator.result}</dd>
            </div>
            <div>
              <dt>Tempo nesta atividade</dt>
              <dd>{operator.activityMinutes} min</dd>
            </div>
          </dl>
          {operator.operation && (
            <button type="button" onClick={() => onOpenOperation(operator.operation!)}>
              Abrir operação <ArrowIcon />
            </button>
          )}
        </section>
        <section className="lv-history">
          <div>
            <h3>Histórico da sessão</h3>
            <span>{formatLiveDuration(operator.sessionMinutes)} de conexão</span>
          </div>
          <ol>
            {events.map(event => (
              <li key={`${event.time}-${event.title}`} className={event.current ? "is-current" : ""}>
                <i />
                <time>{event.time}</time>
                <div>
                  <b>{event.title}</b>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
