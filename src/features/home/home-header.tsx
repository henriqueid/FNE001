"use client";
/**
 * Cabeçalho da visão geral: título com trilha (empresa / perfil), perfis em abas de texto,
 * seletor de empresa, período e nova operação, e o aviso de período sem originação.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { periodLabels, profileLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { ArrowIcon, ClockIcon, FolderIcon, GridIcon, PlusIcon } from "@/src/ui/icons";
import type { HomeMetrics } from "./use-home-metrics";

export function HomeHeader({
  metrics,
  positionDate,
  onPositionDateChange,
  period,
  onPeriodChange,
  profile,
  onProfileChange,
  companyScope,
  onNew,
}: {
  metrics: HomeMetrics;
  positionDate: string;
  onPositionDateChange: (date: string) => void;
  period: HomePeriod;
  onPeriodChange: (period: HomePeriod) => void;
  profile: HomeProfile;
  onProfileChange: (profile: HomeProfile) => void;
  companyScope: string;
  onNew: () => void;
}) {
  const { labels, periodEmpty } = metrics;
  const today = new Date().toLocaleDateString("sv-SE");
  const position = new Date(`${positionDate}T12:00:00`);
  const dateLabel = position.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const movePosition = (days: number) => {
    const moved = new Date(position);
    moved.setDate(moved.getDate() + days);
    onPositionDateChange(moved.toLocaleDateString("sv-SE"));
  };
  const perspectiveIntro: Record<HomeProfile, string> = {
    gestao: "Resultado, liquidez e exposição para decidir onde crescer e onde conter.",
    operacao: "Fila, bloqueios, prazos e liberações para comandar o trabalho do dia.",
    risco: "Atraso, provisão e deterioração para proteger a carteira e orientar a cobrança.",
  };

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
          <p>{perspectiveIntro[profile]}</p>
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
        <div className="vg-position" aria-label="Data da posição">
          <div>
            <ClockIcon />
            <span>Posição</span>
            <b>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</b>
          </div>
          <button type="button" aria-label="Posição anterior" onClick={() => movePosition(-1)}>
            <ArrowIcon />
          </button>
          <input
            type="date"
            value={positionDate}
            max={today}
            onChange={event => onPositionDateChange(event.target.value)}
            aria-label="Escolher data da posição"
          />
          <button
            type="button"
            className="next"
            aria-label="Próxima posição"
            disabled={positionDate >= today}
            onClick={() => movePosition(1)}
          >
            <ArrowIcon />
          </button>
          {positionDate !== today && (
            <button type="button" className="today" onClick={() => onPositionDateChange(today)}>
              Voltar para hoje
            </button>
          )}
        </div>
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
