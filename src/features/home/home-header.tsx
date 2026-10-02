"use client";
/**
 * Cabeçalho da visão geral: título e data, seletor de empresa, período e nova operação,
 * abas de perfil, carteira em aberto com os indicadores de atenção e o aviso de período sem originação.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { periodLabels, profileLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { ClockIcon, PlusIcon } from "@/src/ui/icons";
import { money } from "@/src/domain/core/format";
import type { HomeMetrics } from "./use-home-metrics";
import { compact, int, pct, Segmented } from "./widgets";

export function HomeHeader({
  metrics,
  now,
  period,
  onPeriodChange,
  profile,
  onProfileChange,
  companyScope,
  onCompanyScopeChange,
  onGoOperations,
  onGoFinance,
  onNew,
}: {
  metrics: HomeMetrics;
  now: Date;
  period: HomePeriod;
  onPeriodChange: (period: HomePeriod) => void;
  profile: HomeProfile;
  onProfileChange: (profile: HomeProfile) => void;
  companyScope: string;
  onCompanyScopeChange: (scope: string) => void;
  onGoOperations: () => void;
  onGoFinance: () => void;
  onNew: () => void;
}) {
  const {
    labels,
    active,
    activeAmount,
    ready,
    readyAmount,
    titles,
    portfolioTotal,
    blockedOps,
    capacity,
    overdueRatio,
    health,
    periodEmpty,
  } = metrics;

  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const chips = [
    {
      key: "dec",
      tone: blockedOps.length ? "critical" : "ok",
      label: "Decisões aguardando",
      value: String(blockedOps.length),
      onClick: onGoOperations,
    },
    {
      key: "lib",
      tone: ready.length ? "watch" : "ok",
      label: "Prontos para liberar",
      value: compact(readyAmount),
      onClick: onGoOperations,
    },
    {
      key: "cap",
      tone: capacity > 0 ? "ok" : "critical",
      label: "Capacidade de compra",
      value: compact(capacity),
      onClick: onGoFinance,
    },
    {
      key: "ina",
      tone: overdueRatio > 5 ? "critical" : overdueRatio > 0 ? "watch" : "ok",
      label: "Inadimplência",
      value: pct(overdueRatio, 1),
      onClick: () => onProfileChange("risco"),
    },
  ];

  return (
    <>
      <header className="vg-head">
        <div>
          <h1>Visão geral</h1>
          <p>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} ·{" "}
            {companyScope === "Consolidado" ? `${destinations.length} empresas e veículos` : companyScope}
          </p>
        </div>
        <div className="vg-controls">
          <select
            className="vg-select"
            aria-label="Selecionar empresa ou visão consolidada"
            value={companyScope}
            onChange={e => onCompanyScopeChange(e.target.value)}
          >
            <option value="Consolidado">Consolidado · todas as empresas</option>
            {destinations.map(d => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <Segmented
            label="Período"
            value={period}
            onChange={onPeriodChange}
            options={(Object.keys(periodLabels) as HomePeriod[]).map(id => ({ id, label: periodLabels[id].tab }))}
          />
          <button className="primary-action" onClick={onNew}>
            <PlusIcon /> Nova operação
          </button>
        </div>
      </header>

      <div className="vg-profiles" role="tablist" aria-label="Perfil da visão">
        {(Object.keys(profileLabels) as HomeProfile[]).map(p => (
          <button
            key={p}
            role="tab"
            aria-selected={profile === p}
            className={profile === p ? "active" : ""}
            onClick={() => onProfileChange(p)}
            title={profileLabels[p].description}
          >
            {profileLabels[p].tab}
          </button>
        ))}
        <span className="vg-profile-desc">{profileLabels[profile].description}</span>
      </div>

      <section className={`vg-brief tone-${health.tone}`} aria-label="Resumo">
        <div className="vg-brief-hero">
          <small>
            Carteira em aberto · {int.format(titles.length)} títulos · {active.length} operações em andamento (
            {compact(activeAmount)})
          </small>
          <strong>{money.format(portfolioTotal)}</strong>
          <span className={`vg-brief-health tone-${health.tone}`}>{health.label}</span>
        </div>
        <div className="vg-chips">
          {chips.map(c => (
            <button key={c.key} className={`vg-chip ${c.tone}`} onClick={c.onClick}>
              <span>{c.label}</span>
              <b>{c.value}</b>
            </button>
          ))}
        </div>
      </section>

      {periodEmpty && (
        <div className="vg-period-hint">
          <ClockIcon />
          <span>
            Nenhuma operação originada {labels.range}. Os indicadores de resultado ficam zerados até a primeira entrar.
          </span>
          <button className="vg-btn" onClick={() => onPeriodChange("mes")}>
            Ver o mês
          </button>
        </div>
      )}
    </>
  );
}
