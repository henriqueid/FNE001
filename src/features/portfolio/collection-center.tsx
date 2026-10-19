"use client";

/** Central de Cobrança: agenda, promessas, acordos e escalonamento derivados da carteira viva. */
import type { StateCommit } from "@/src/ui/confirmed-state";
import { useMemo, useState } from "react";
import {
  buildCollectionQueue,
  type CollectionAction,
  type CollectionPriority,
} from "@/src/domain/portfolio/collection";
import { type PortfolioState } from "@/src/domain/portfolio/model";
import { br, money } from "@/src/features/finance/finance-ui";
import { ChartIcon, ClockIcon, HandshakeIcon, ListIcon, ScaleIcon } from "@/src/ui/icons";
import { ModuleTabs } from "@/src/ui/module-tabs";
import { PortfolioTitleDetails } from "./portfolio-title-details";
import { type PortfolioGridRow } from "./portfolio-title-grid";

type View = "painel" | "agenda" | "promessas" | "acordos" | "escalonamento" | "relatorios";
type AgendaFilter = "todas" | "criticas" | "atrasadas" | "preventivas";

const priorityLabel: Record<CollectionPriority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export function CollectionCenter({
  rows,
  today,
  portfolio,
  onPortfolio,
  repName,
}: {
  rows: PortfolioGridRow[];
  today: string;
  portfolio: PortfolioState;
  onPortfolio: StateCommit<PortfolioState>;
  repName: (id?: string) => string;
}) {
  const [view, setView] = useState<View>("painel");
  const [filter, setFilter] = useState<AgendaFilter>("todas");
  const [detailId, setDetailId] = useState<string | null>(null);
  const actions = useMemo(
    () => buildCollectionQueue(rows, today).filter(action => action.queue === "cobranca"),
    [rows, today],
  );
  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);
  const detail = detailId ? byId.get(detailId) : undefined;
  const promises = rows.filter(row => row.collectionOccurrences?.at(-1)?.outcome === "Promessa de pagamento");
  const agreements = rows.filter(row =>
    row.collectionOccurrences?.some(item => item.outcome === "Negociação em andamento"),
  );
  const escalations = actions.filter(action => action.daysLate > 30 || action.reason === "promessa-vencida");
  const visible = actions.filter(
    action =>
      filter === "todas" ||
      (filter === "criticas"
        ? action.priority === "critica"
        : filter === "atrasadas"
          ? action.daysLate > 0
          : action.reason === "preventivo"),
  );
  const count = (priority: CollectionPriority) => actions.filter(action => action.priority === priority).length;
  const totalBalance = (list: CollectionAction[]) =>
    [...new Set(list.map(action => action.titleId))].reduce((sum, id) => sum + (byId.get(id)?.amount ?? 0), 0);

  return (
    <>
      <ModuleTabs
        label="Recursos da cobrança"
        value={view}
        onChange={setView}
        className="pf-collection-tabs"
        tabs={[
          { id: "painel", label: "Painel", icon: <ChartIcon /> },
          { id: "agenda", label: "Agenda", icon: <ClockIcon />, count: actions.length, tone: "alert" },
          { id: "promessas", label: "Promessas", icon: <HandshakeIcon />, count: promises.length, tone: "alert" },
          { id: "acordos", label: "Acordos", icon: <ListIcon />, count: agreements.length, tone: "neutral" },
          {
            id: "escalonamento",
            label: "Escalonamento",
            icon: <ScaleIcon />,
            count: escalations.length,
            tone: "alert",
          },
          { id: "relatorios", label: "Relatórios", icon: <ChartIcon /> },
        ]}
      />

      <section className="pf-collection-summary" aria-label="Resumo da cobrança">
        <div className="critical">
          <span>CRÍTICAS</span>
          <b>{count("critica")}</b>
          <small>promessas quebradas e atrasos graves</small>
        </div>
        <div>
          <span>AGENDA DE HOJE</span>
          <b>{actions.length}</b>
          <small>contatos preventivos e vencidos</small>
        </div>
        <div>
          <span>PROMESSAS ATIVAS</span>
          <b>{promises.length}</b>
          <small>compromissos acompanhados</small>
        </div>
        <div>
          <span>VALOR ACIONÁVEL</span>
          <b>{money(totalBalance(actions))}</b>
          <small>saldo único em cobrança</small>
        </div>
      </section>

      {view === "painel" && (
        <div className="pf-collection-dashboard">
          <section className="fn-card pf-collection-card">
            <header className="fn-card-head">
              <div>
                <h2>Prioridades do dia</h2>
                <p>Fila ordenada pelo risco de recuperação</p>
              </div>
              <button className="fn-btn small" onClick={() => setView("agenda")}>
                Abrir agenda
              </button>
            </header>
            <ActionList actions={actions.slice(0, 6)} byId={byId} repName={repName} onOpen={setDetailId} />
          </section>
          <section className="fn-card pf-ruler-card">
            <header className="fn-card-head">
              <div>
                <h2>Régua de recuperação</h2>
                <p>Cadência aplicada automaticamente a cada título</p>
              </div>
            </header>
            <Ruler />
          </section>
        </div>
      )}

      {view === "agenda" && (
        <section className="fn-card pf-collection-card">
          <header className="fn-card-head">
            <div>
              <h2>Agenda operacional</h2>
              <p>Contatos priorizados por promessa, retorno, atraso e vencimento</p>
            </div>
            <div className="fn-seg" role="group" aria-label="Filtrar agenda">
              {(
                [
                  ["todas", "Tudo"],
                  ["criticas", "Críticas"],
                  ["atrasadas", "Atrasadas"],
                  ["preventivas", "Preventivas"],
                ] as [AgendaFilter, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </header>
          <ActionList actions={visible} byId={byId} repName={repName} onOpen={setDetailId} />
        </section>
      )}

      {view === "promessas" && (
        <section className="fn-card pf-collection-card">
          <header className="fn-card-head">
            <div>
              <h2>Gestão de promessas</h2>
              <p>Compromissos assumidos, vencidos e próximos de vencer</p>
            </div>
          </header>
          <div className="pf-promise-grid">
            {promises.map(row => {
              const last = row.collectionOccurrences.at(-1)!;
              const broken = Boolean(last.promiseDate && last.promiseDate < today && row.amount > 0);
              return (
                <article key={row.id} className={broken ? "broken" : ""}>
                  <span className={`fn-chip ${broken ? "bad" : "ok"}`}>
                    {broken ? "Promessa vencida" : "Em acompanhamento"}
                  </span>
                  <h3>{row.debtorName}</h3>
                  <p>
                    {row.documentNumber} · {row.ownerName}
                  </p>
                  <div>
                    <b>{money(row.amount)}</b>
                    <span>prometido para {br(last.promiseDate ?? row.dueDate)}</span>
                  </div>
                  <button className="fn-btn small" onClick={() => setDetailId(row.id)}>
                    Registrar retorno
                  </button>
                </article>
              );
            })}
            {!promises.length && <p className="fn-note">Nenhuma promessa ativa.</p>}
          </div>
        </section>
      )}

      {view === "acordos" && (
        <section className="fn-card pf-collection-card">
          <header className="fn-card-head">
            <div>
              <h2>Acordos e negociações</h2>
              <p>Histórico, próximos passos e condições em discussão</p>
            </div>
          </header>
          <div className="pf-agreement-list">
            {agreements.map(row => {
              const last = row.collectionOccurrences.at(-1);
              return (
                <article key={row.id}>
                  <div>
                    <b>{row.debtorName}</b>
                    <span>
                      {row.ownerName} · {row.documentNumber}
                    </span>
                  </div>
                  <div>
                    <b>{money(row.amount)}</b>
                    <span>{last?.notes || "Negociação em andamento"}</span>
                  </div>
                  <div>
                    <b>{last?.nextContactAt ? br(last.nextContactAt.slice(0, 10)) : "Sem retorno"}</b>
                    <span>próxima ação</span>
                  </div>
                  <button className="fn-btn small" onClick={() => setDetailId(row.id)}>
                    Abrir acordo
                  </button>
                </article>
              );
            })}
            {!agreements.length && <p className="fn-note">Nenhuma negociação em andamento.</p>}
          </div>
        </section>
      )}

      {view === "escalonamento" && (
        <section className="fn-card pf-collection-card">
          <header className="fn-card-head">
            <div>
              <h2>Recompra, protesto e jurídico</h2>
              <p>Títulos que ultrapassaram a régua amigável ou quebraram promessa</p>
            </div>
          </header>
          <ActionList actions={escalations} byId={byId} repName={repName} onOpen={setDetailId} />
          <div className="pf-escalation-legend">
            <span>
              <i className="protest" /> Protesto/cartório
            </span>
            <span>
              <i className="repurchase" /> Recompra com cedente
            </span>
            <span>
              <i className="legal" /> Avaliação jurídica
            </span>
          </div>
        </section>
      )}

      {view === "relatorios" && (
        <div className="pf-collection-reports">
          <CollectionReport
            title="Efetividade da régua"
            rows={[
              ["Críticas", count("critica")],
              ["Alta prioridade", count("alta")],
              ["Média prioridade", count("media")],
              ["Preventivas", actions.filter(a => a.reason === "preventivo").length],
            ]}
          />
          <CollectionReport
            title="Recuperação e compromissos"
            rows={[
              ["Promessas ativas", promises.length],
              ["Promessas quebradas", actions.filter(a => a.reason === "promessa-vencida").length],
              ["Negociações", agreements.length],
              ["Escalonamentos", escalations.length],
            ]}
          />
          <CollectionReport
            title="Exposição"
            rows={[
              ["Total acionável", money(totalBalance(actions))],
              ["Crítico", money(totalBalance(actions.filter(a => a.priority === "critica")))],
              ["Acima de 30 dias", money(totalBalance(actions.filter(a => a.daysLate > 30)))],
              ["Quantidade de títulos", new Set(actions.map(a => a.titleId)).size],
            ]}
          />
        </div>
      )}

      {detail && (
        <PortfolioTitleDetails
          title={detail}
          repName={repName}
          portfolio={portfolio}
          onPortfolio={onPortfolio}
          onClose={() => setDetailId(null)}
          initialTab="cobranca"
        />
      )}
    </>
  );
}

function ActionList({
  actions,
  byId,
  repName,
  onOpen,
}: {
  actions: CollectionAction[];
  byId: Map<string, PortfolioGridRow>;
  repName: (id?: string) => string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="pf-collection-list">
      {actions.map(action => {
        const title = byId.get(action.titleId);
        if (!title) return null;
        return (
          <article key={action.id} className={`pf-collection-item ${action.priority}`}>
            <div className="pf-collection-priority">
              <span>{priorityLabel[action.priority]}</span>
              <small>COBRANÇA</small>
            </div>
            <div className="pf-collection-party">
              <b>{title.debtorName}</b>
              <span>{title.ownerName}</span>
              <small>
                {title.documentNumber} · {repName(title.repId)}
              </small>
            </div>
            <div className="pf-collection-reason">
              <b>{action.label}</b>
              <span>{action.detail}</span>
              <small>{action.suggestedAction}</small>
            </div>
            <div className="pf-collection-value">
              <b>{money(action.balance)}</b>
              <span>{action.daysLate > 0 ? `${action.daysLate} dias em atraso` : `vence ${br(title.dueDate)}`}</span>
              <small>ação em {br(action.dueAt)}</small>
            </div>
            <button type="button" className="fn-btn small" onClick={() => onOpen(title.id)}>
              Atuar
            </button>
          </article>
        );
      })}
      {!actions.length && <p className="fn-note">Nenhuma ação nesta fila.</p>}
    </div>
  );
}

function Ruler() {
  return (
    <div className="pf-ruler">
      <div>
        <b>D−3</b>
        <span>Lembrete preventivo</span>
        <small>WhatsApp ou e-mail com boleto</small>
      </div>
      <div>
        <b>D0</b>
        <span>Confirmar liquidação</span>
        <small>Reenvio de boleto, se necessário</small>
      </div>
      <div>
        <b>D+1 a D+5</b>
        <span>Cobrança amigável</span>
        <small>Contato e previsão de pagamento</small>
      </div>
      <div>
        <b>D+6 a D+30</b>
        <span>Cobrança formal</span>
        <small>Telefone, e-mail e negociação</small>
      </div>
      <div>
        <b>D+31</b>
        <span>Escalonar</span>
        <small>Protesto, jurídico ou recompra</small>
      </div>
    </div>
  );
}

function CollectionReport({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <section className="fn-card pf-collection-report">
      <header>
        <h2>{title}</h2>
        <p>Posição atual da carteira</p>
      </header>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}
