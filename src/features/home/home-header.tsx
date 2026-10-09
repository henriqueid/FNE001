"use client";
/**
 * Cabeçalho da visão geral: título com trilha (empresa / perfil), perfis em abas de texto,
 * seletor de empresa, período e nova operação, e o aviso de período sem originação.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { periodLabels, profileLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { ClockIcon, FolderIcon, GridIcon, PlusIcon } from "@/src/ui/icons";
import type { HomeMetrics } from "./use-home-metrics";

export function HomeHeader({
  metrics,
  now,
  period,
  onPeriodChange,
  profile,
  onProfileChange,
  companyScope,
  onNew,
}: {
  metrics: HomeMetrics;
  now: Date;
  period: HomePeriod;
  onPeriodChange: (period: HomePeriod) => void;
  profile: HomeProfile;
  onProfileChange: (profile: HomeProfile) => void;
  companyScope: string;
  onNew: () => void;
}) {
  const { labels, periodEmpty } = metrics;
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="vg-head lx-page-head">
        <div className="vg-title-block">
          <div className="lx-title">
            <h1>Visão geral</h1>
            <nav className="lx-crumbs" aria-label="Recorte">
              <span>
                <FolderIcon />
                {companyScope === "Consolidado" ? `Consolidado · ${destinations.length} empresas` : companyScope}
              </span>
              <i>/</i>
              <span>
                <GridIcon />
                {profileLabels[profile].tab}
              </span>
            </nav>
          </div>
          <p>Decisões, caixa e andamento da operação — na ordem em que precisam da sua atenção.</p>
        </div>
        <div className="vg-controls">
          <button className="primary-action" onClick={onNew}>
            <PlusIcon /> Nova operação
          </button>
        </div>
      </header>

      <div className="vg-context-bar">
        <label>
          <span>Perspectiva</span>
          <select value={profile} onChange={event => onProfileChange(event.target.value as HomeProfile)}>
            {(Object.keys(profileLabels) as HomeProfile[]).map(id => (
              <option key={id} value={id}>
                {profileLabels[id].tab}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Período</span>
          <select value={period} onChange={event => onPeriodChange(event.target.value as HomePeriod)}>
            {(Object.keys(periodLabels) as HomePeriod[]).map(id => (
              <option key={id} value={id}>
                {periodLabels[id].tab}
              </option>
            ))}
          </select>
        </label>
        <span className="lx-date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
      </div>

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
