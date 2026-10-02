"use client";
/**
 * Cabeçalho da visão geral: título com trilha (empresa / perfil), perfis em abas de texto,
 * seletor de empresa, período e nova operação, e o aviso de período sem originação.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { periodLabels, profileLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { ClockIcon, FolderIcon, GridIcon, PlusIcon } from "@/src/ui/icons";
import type { HomeMetrics } from "./use-home-metrics";
import { TextTabs } from "./widgets";

export function HomeHeader({
  metrics,
  now,
  period,
  onPeriodChange,
  profile,
  onProfileChange,
  companyScope,
  onCompanyScopeChange,
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
  onNew: () => void;
}) {
  const { labels, periodEmpty } = metrics;
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="vg-head lx-page-head">
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
          <button className="primary-action" onClick={onNew}>
            <PlusIcon /> Nova operação
          </button>
        </div>
      </header>

      <div className="lx-subhead">
        <TextTabs
          label="Perfil da visão"
          value={profile}
          onChange={onProfileChange}
          options={(Object.keys(profileLabels) as HomeProfile[]).map(id => ({ id, label: profileLabels[id].tab }))}
        />
        <span className="lx-date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
        <TextTabs
          label="Período dos indicadores"
          value={period}
          onChange={onPeriodChange}
          options={(Object.keys(periodLabels) as HomePeriod[]).map(id => ({ id, label: periodLabels[id].tab }))}
        />
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
