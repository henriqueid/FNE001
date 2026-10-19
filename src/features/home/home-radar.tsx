"use client";
/** Lateral do panorama: eventos auditados, posição do score e indicadores com origem explícita. */
import { useState } from "react";
import type { RadarEvent, RadarSnapshot } from "@/src/domain/home/radar";
import type { QualityTrend } from "@/src/domain/risk/quality";

export type HomeRadarProps = {
  snapshot?: RadarSnapshot;
  pending?: RadarSnapshot;
  error?: string;
  mode: "live" | "demo" | "preview";
  onRefresh: () => void;
  onAccept: () => void;
  onEvent: (event: RadarEvent) => void;
};
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
  const newCount = pending?.events.filter(item => !snapshot?.events.some(old => old.id === item.id)).length ?? 0;
  return (
    <aside className="vg-radar" data-view={tab} aria-label="Radar ao vivo">
      <header className="vg-radar-head">
        <div>
          <span className="vg-radar-eyebrow">ACOMPANHAMENTO</span>
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
                  ? "Conectado"
                  : "Conectando"}
        </span>
      </header>
      <p className="vg-radar-intro">O que mudou e merece sua atenção.</p>
      <div className="vg-radar-tabs" role="group" aria-label="Filtrar radar">
        <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
          Tudo
        </button>
        {canViewScores && (
          <button type="button" aria-pressed={tab === "scores"} onClick={() => setTab("scores")}>
            Score
          </button>
        )}
        <button type="button" aria-pressed={tab === "market"} onClick={() => setTab("market")}>
          Mercado
        </button>
      </div>
      {error && (
        <p className="vg-radar-message" role="status">
          {error}
        </p>
      )}
      {mode !== "live" && (
        <p className="vg-radar-message">
          {mode === "demo"
            ? "Ambiente demonstrativo. Eventos e cotações reais não são consultados."
            : "O radar está pausado durante a simulação de outro usuário."}
        </p>
      )}
      {newCount > 0 && (
        <button type="button" className="vg-radar-new" onClick={onAccept}>
          Ver {newCount} novo{newCount === 1 ? " evento" : "s eventos"}
        </button>
      )}
      {tab === "all" && (
        <section className="vg-radar-section">
          <h3>
            Na sua operação <span>Últimos 7 dias e pendências</span>
          </h3>
          {snapshot?.events.length ? (
            <ol className="vg-radar-events">
              {snapshot.events.map(event => (
                <li key={event.id}>
                  <span className="vg-radar-marker" aria-hidden="true" />
                  <div>
                    <small>
                      {event.source} · <time dateTime={event.at}>{dateTime(event.at)}</time>
                    </small>
                    <strong>{event.title}</strong>
                    <p>{event.summary}</p>
                    <button type="button" onClick={() => onEvent(event)}>
                      Ver no módulo <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="vg-radar-empty">
              {mode === "live" && !snapshot && !error
                ? "Buscando atualizações autorizadas…"
                : "Nenhum evento disponível para o seu acesso."}
            </p>
          )}
        </section>
      )}
      {canViewScores && tab !== "market" && (
        <section className="vg-radar-section">
          <h3>
            Score interno <span>Posição calculada{mode === "demo" ? " · demo" : ""}</span>
          </h3>
          {scores.length ? (
            scores.slice(0, 3).map(score => (
              <div className="vg-radar-score" key={score.id}>
                <strong>{score.name}</strong>
                <b>
                  {Math.round(score.index)}
                  <small> / 1000</small>
                </b>
                <p>
                  {score.monthly.length > 1
                    ? `${Math.round(score.previousIndex)} → ${Math.round(score.index)} · ${score.delta > 0 ? "+" : ""}${Math.round(score.delta)} pts na janela da política`
                    : "Sem histórico comparável para apontar uma mudança."}
                </p>
                <small>{score.monthly.length > 1 ? score.reasons[0]?.text || score.summary : score.action}</small>
              </div>
            ))
          ) : (
            <p className="vg-radar-empty">Sem posição de score disponível neste recorte.</p>
          )}
          <button type="button" className="vg-radar-link" onClick={onScores}>
            Consultar carteira <span aria-hidden="true">→</span>
          </button>
        </section>
      )}
      {tab !== "scores" && (
        <section className="vg-radar-section">
          <h3>
            Mercado de crédito <span>Fontes autorizadas</span>
          </h3>
          {snapshot?.market.map((item, i) =>
            item.available ? (
              <a className="vg-radar-market" href={item.url} target="_blank" rel="noopener noreferrer" key={item.name}>
                <span>
                  {item.name}
                  <strong>
                    {item.value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} <small>{item.unit}</small>
                  </strong>
                </span>
                <small>BCB / SGS · referência {item.date.split("-").reverse().join("/")} ↗</small>
              </a>
            ) : (
              <p className="vg-radar-empty" key={i}>
                {i === 0 ? "CDI" : "Selic"}: {item.reason}
              </p>
            ),
          )}
          {!snapshot && <p className="vg-radar-empty">Indicadores aguardando consulta à fonte autorizada.</p>}
          <p className="vg-radar-note">
            Último dado publicado, com data de referência. Notícias dependem de uma fonte editorial aprovada.
          </p>
        </section>
      )}
      <footer className="vg-radar-footer">
        <small>{snapshot ? `Verificado em ${dateTime(snapshot.checkedAt)}` : "Apenas informações do seu acesso"}</small>
        {mode === "live" && (
          <button type="button" onClick={onRefresh}>
            Atualizar
          </button>
        )}
      </footer>
    </aside>
  );
}
