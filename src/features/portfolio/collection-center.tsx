"use client";

/** Central de Cobrança: materializa a régua e a agenda operacional a partir da carteira atual. */
import { useMemo, useState } from "react";
import { buildCollectionQueue, type CollectionPriority, type CollectionQueue } from "@/src/domain/portfolio/collection";
import { type PortfolioState } from "@/src/domain/portfolio/model";
import { br, money } from "@/src/features/finance/finance-ui";
import { PortfolioTitleDetails } from "./portfolio-title-details";
import { type PortfolioGridRow } from "./portfolio-title-grid";

type Filter = "todas" | CollectionQueue | "promessas";

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
  onPortfolio: (state: PortfolioState) => void;
  repName: (id?: string) => string;
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"cobranca" | "controladoria">("cobranca");
  const actions = useMemo(() => buildCollectionQueue(rows, today), [rows, today]);
  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);
  const visible = actions.filter(action =>
    filter === "todas" ? true : filter === "promessas" ? action.reason === "promessa-vencida" : action.queue === filter,
  );
  const detail = detailId ? byId.get(detailId) : undefined;
  const count = (priority: CollectionPriority) => actions.filter(action => action.priority === priority).length;
  const total = (queue: CollectionQueue) => actions.filter(action => action.queue === queue).length;

  return (
    <>
      <section className="pf-collection-summary" aria-label="Resumo da agenda de cobrança">
        <div className="critical">
          <span>CRÍTICAS</span>
          <b>{count("critica")}</b>
          <small>promessas, divergências e atrasos graves</small>
        </div>
        <div>
          <span>COBRANÇA</span>
          <b>{total("cobranca")}</b>
          <small>contatos preventivos e vencidos</small>
        </div>
        <div>
          <span>CHECAGEM</span>
          <b>{total("checagem")}</b>
          <small>confirmações do sacado pendentes</small>
        </div>
        <div>
          <span>VALOR NA FILA</span>
          <b>
            {money(
              new Set(actions.map(action => action.titleId)).size
                ? rows
                    .filter(row => actions.some(action => action.titleId === row.id))
                    .reduce((sum, row) => sum + row.amount, 0)
                : 0,
            )}
          </b>
          <small>saldo único dos títulos acionáveis</small>
        </div>
      </section>

      <section className="fn-card pf-collection-card">
        <header className="fn-card-head">
          <div>
            <h2>Agenda operacional</h2>
            <p>Prioridade calculada por promessa, retorno, atraso, vencimento e confirmação</p>
          </div>
          <div className="fn-seg" role="group" aria-label="Filtrar agenda">
            {(
              [
                ["todas", "Tudo"],
                ["cobranca", "Cobrança"],
                ["checagem", "Checagem"],
                ["promessas", "Promessas"],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="pf-collection-list">
          {visible.map(action => {
            const title = byId.get(action.titleId);
            if (!title) return null;
            return (
              <article key={action.id} className={`pf-collection-item ${action.priority}`}>
                <div className="pf-collection-priority">
                  <span>{priorityLabel[action.priority]}</span>
                  <small>{action.queue === "checagem" ? "CHECAGEM" : "COBRANÇA"}</small>
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
                  <span>
                    {action.daysLate > 0 ? `${action.daysLate} dias em atraso` : `vence ${br(title.dueDate)}`}
                  </span>
                  <small>ação em {br(action.dueAt)}</small>
                </div>
                <button
                  type="button"
                  className="fn-btn small"
                  onClick={() => {
                    setDetailTab(action.queue === "checagem" ? "controladoria" : "cobranca");
                    setDetailId(title.id);
                  }}
                >
                  Atuar
                </button>
              </article>
            );
          })}
          {visible.length === 0 && <p className="fn-note">Nenhuma ação nesta fila.</p>}
        </div>
      </section>

      <section className="fn-card pf-ruler-card">
        <header className="fn-card-head">
          <div>
            <h2>Régua aplicada</h2>
            <p>A fila usa esta sequência como orientação operacional; cada contato continua auditável no título.</p>
          </div>
        </header>
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
            <small>Protesto, negativação ou recompra</small>
          </div>
        </div>
      </section>

      {detail && (
        <PortfolioTitleDetails
          title={detail}
          repName={repName}
          portfolio={portfolio}
          onPortfolio={onPortfolio}
          onClose={() => setDetailId(null)}
          initialTab={detailTab}
        />
      )}
    </>
  );
}
