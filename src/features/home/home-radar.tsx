"use client";
/** Radar com prioridades da carteira, notas explicáveis e notícias oficiais. */
import { useState } from "react";
import type { RadarEvent, RadarSnapshot } from "@/src/domain/home/radar";
import type { QualityTrend } from "@/src/domain/risk/quality";
import { scoreBand } from "@/src/domain/eligibility/operational-parameters";

export type HomeRadarProps = {
  snapshot?: RadarSnapshot;
  pending?: RadarSnapshot;
  error?: string;
  mode: "live" | "demo" | "preview";
  onRefresh: () => void;
  onAccept: () => void;
  onEvent: (event: RadarEvent) => void;
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function HomeRadar({
  snapshot,
  pending,
  error,
  mode,
  onRefresh,
  onAccept,
  onEvent,
  scores,
  canViewScores,
  onScores,
}: HomeRadarProps & {
  scores: QualityTrend[];
  canViewScores: boolean;
  onScores: () => void;
}) {
  const [tab, setTab] = useState<"all" | "scores" | "market">("all");
  const [expanded, setExpanded] = useState(false);
  const newCount = pending?.events.filter(item => !snapshot?.events.some(old => old.id === item.id)).length ?? 0;
  const exposure = scores.reduce((sum, score) => sum + score.exposure, 0);
  const weightedScore =
    exposure > 0
      ? Math.round(scores.reduce((sum, score) => sum + score.index * score.exposure, 0) / exposure)
      : undefined;
  const overdue = scores
    .filter(score => (score.latest?.overdue30 ?? 0) > 0)
    .sort((a, b) => (b.latest?.overdue30 ?? 0) - (a.latest?.overdue30 ?? 0));
  const news = snapshot?.news;
  const showScores = canViewScores && tab === "scores";
  const currentTab = tab === "scores" && !canViewScores ? "all" : tab;
  return (
    <aside className="vg-radar" data-view={currentTab} aria-label="Radar ao vivo">
      <header className="vg-radar-head">
        <div>
          <span className="vg-radar-eyebrow">INTELIGÊNCIA DO DIA</span>
          <h2>Radar ao vivo</h2>
        </div>
        <span className={`vg-radar-status ${snapshot && !error ? "is-current" : ""}`}>
          {mode === "demo"
            ? "Demo"
            : mode === "preview"
              ? "Simulação"
              : error
                ? "Sem conexão"
                : snapshot
                  ? "Ao vivo"
                  : "Conectando"}
        </span>
      </header>
      <div className="vg-radar-tabs" role="group" aria-label="Filtrar radar">
        {(
          [["all", "Interno"], ...(canViewScores ? [["scores", "Score"]] : []), ["market", "Mercado"]] as [
            typeof tab,
            string,
          ][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={currentTab === value}
            onClick={() => {
              setTab(value);
              setExpanded(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="vg-radar-message" role="status">
          {error}
        </p>
      )}
      {mode !== "live" && (
        <p className="vg-radar-message">
          {mode === "demo"
            ? "Dados demonstrativos. Notícias reais não são consultadas."
            : "Atualizações pausadas durante simulação de usuário."}
        </p>
      )}
      {canViewScores && currentTab !== "market" && (
        <button type="button" className="vg-radar-overview" onClick={() => setTab("scores")}>
          <span>
            Score da carteira<small>Ponderado pela exposição · {scores.length} cedentes</small>
          </span>
          <strong>
            {weightedScore ?? "—"}
            <small>/ 1000</small>
          </strong>
          <span className="vg-radar-overview-bottom">
            <span>{weightedScore == null ? "Aguardando carteira" : scoreBand(weightedScore)}</span>
            <span>{money(exposure)} em exposição ↗</span>
          </span>
        </button>
      )}
      {newCount > 0 && (
        <button type="button" className="vg-radar-new" onClick={onAccept}>
          Ver {newCount} novas atualizações
        </button>
      )}
      {currentTab === "all" && (
        <>
          {canViewScores && overdue.length > 0 && (
            <section className="vg-radar-section">
              <h3>
                Atenção à carteira <span>Saldo com atraso superior a 30 dias</span>
              </h3>
              {overdue.slice(0, 2).map(score => (
                <button className="vg-radar-alert" type="button" key={score.id} onClick={onScores}>
                  <span className="vg-radar-tag is-attention">Cobrança</span>
                  <strong>{score.name}</strong>
                  <b>{money(score.latest?.overdue30 ?? 0)}</b>
                  <small>Em {money(score.exposure)} de exposição · abrir carteira →</small>
                </button>
              ))}
            </section>
          )}
          <section className="vg-radar-section">
            <h3>
              Movimentos internos <span>Prioridades e acontecimentos dos últimos 7 dias</span>
            </h3>
            {snapshot?.events.length ? (
              <ol className="vg-radar-events">
                {snapshot.events.slice(0, expanded ? 20 : 4).map(event => (
                  <li key={event.id}>
                    <div className="vg-radar-event-meta">
                      <span className={`vg-radar-tag ${event.priority === "attention" ? "is-attention" : ""}`}>
                        {event.priority === "attention" ? "Pendente" : event.source}
                      </span>
                      <time dateTime={event.at}>{dateTime(event.at)}</time>
                    </div>
                    <strong>{event.title}</strong>
                    <p>{event.summary}</p>
                    <button type="button" onClick={() => onEvent(event)}>
                      {event.action || "Ver no módulo"} <span aria-hidden="true">↗</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="vg-radar-empty">
                {!snapshot && !error && mode === "live"
                  ? "Carregando movimentos…"
                  : "Nenhum movimento recente neste recorte."}
              </p>
            )}
            {(snapshot?.events.length ?? 0) > 4 && (
              <button type="button" className="vg-radar-link" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Mostrar menos" : `Ver ${snapshot!.events.length} movimentos`}
              </button>
            )}
          </section>
        </>
      )}
      {showScores && (
        <section className="vg-radar-section">
          <h3>
            Score interno <span>Menores notas primeiro · mesma política da carteira</span>
          </h3>
          {[...scores]
            .sort((a, b) => a.index - b.index || b.exposure - a.exposure)
            .slice(0, expanded ? 20 : 5)
            .map(score => (
              <article className="vg-radar-score" key={score.id}>
                <div className="vg-radar-score-top">
                  <strong>{score.name}</strong>
                  <span className="vg-radar-tag" data-band={scoreBand(score.index)}>
                    {scoreBand(score.index)}
                  </span>
                </div>
                <b>
                  {Math.round(score.index)}
                  <small> / 1000</small>
                </b>
                <meter min={0} max={1000} value={score.index} aria-label={`Score de ${score.name}`} />
                <p>{money(score.exposure)} de exposição</p>
                <ul>
                  {score.components
                    .filter(component => component.id !== "bureauScore")
                    .sort((a, b) => a.scoreAfter - b.scoreAfter)
                    .slice(0, 2)
                    .map(component => (
                      <li key={component.id}>
                        {component.label}: <strong>{component.afterText}</strong>
                      </li>
                    ))}
                </ul>
                <p className="vg-radar-score-action">{score.action}</p>
                <small>
                  {score.monthly.length > 1
                    ? `${Math.round(score.previousIndex)} → ${Math.round(score.index)} · ${score.delta > 0 ? "+" : ""}${Math.round(score.delta)} pts`
                    : "Primeira posição · variação ainda não disponível"}
                  {score.latest ? ` · ref. ${score.latest.month.split("-").reverse().join("/")}` : ""}
                </small>
              </article>
            ))}
          {!scores.length && (
            <p className="vg-radar-empty">
              Nenhum cedente com títulos elegíveis neste recorte. Confira carga e filtro da carteira.
            </p>
          )}
          {scores.length > 5 && (
            <button type="button" className="vg-radar-link" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Mostrar menos" : "Ver mais cedentes"}
            </button>
          )}
          <button type="button" className="vg-radar-link" onClick={onScores}>
            Abrir carteira completa →
          </button>
        </section>
      )}
      {currentTab === "market" && (
        <section className="vg-radar-section">
          <h3>
            Mercado de crédito <span>Publicações oficiais · últimos 30 dias</span>
          </h3>
          <div className="vg-radar-indicators">
            {snapshot?.market.map((item, index) =>
              item.available ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" key={item.name}>
                  <small>{item.name}</small>
                  <strong>
                    {item.value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                    <small>{item.unit}</small>
                  </strong>
                  <small>BCB · {item.date.split("-").reverse().join("/")}</small>
                </a>
              ) : (
                <div key={index}>
                  <small>{index === 0 ? "CDI diário" : "Meta Selic"}</small>
                  <strong>—</strong>
                  <small>Cotação indisponível</small>
                </div>
              ),
            )}
          </div>
          {news?.items.slice(0, expanded ? 12 : 4).map(item => (
            <article className="vg-radar-news" key={item.id}>
              <div className="vg-radar-event-meta">
                <span className="vg-radar-tag">{item.topic}</span>
                <span>{item.source}</span>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <h4>{item.title} ↗</h4>
              </a>
              <time dateTime={item.publishedAt}>{dateTime(item.publishedAt)}</time>
              {item.summary && <p>{item.summary}</p>}
              <div className="vg-radar-relevance">
                <small>Por que acompanhar</small>
                <p>{item.relevance}</p>
              </div>
            </article>
          ))}
          {!news?.items.length && (
            <p className="vg-radar-empty">
              {!snapshot
                ? "Consultando publicações oficiais…"
                : "Nenhuma notícia recente disponível nas fontes consultadas."}
            </p>
          )}
          {(news?.items.length ?? 0) > 4 && (
            <button type="button" className="vg-radar-link" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Mostrar menos" : "Ver mais notícias"}
            </button>
          )}
          {!!news?.unavailable.length && (
            <p className="vg-radar-note">
              Consulta indisponível: {news.unavailable.join(", ")}. As outras fontes continuam disponíveis.
            </p>
          )}
          <p className="vg-radar-note">
            Relevância é contexto temático do STRATO. A matéria completa pertence à fonte.{" "}
            {news ? `Fontes verificadas em ${dateTime(news.checkedAt)}.` : ""}
          </p>
        </section>
      )}
      <footer className="vg-radar-footer">
        <small>{snapshot ? `Atualizado ${dateTime(snapshot.checkedAt)}` : "Somente dados do seu acesso"}</small>
        {mode === "live" && (
          <button type="button" onClick={onRefresh}>
            Atualizar ↻
          </button>
        )}
      </footer>
    </aside>
  );
}
