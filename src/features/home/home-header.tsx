"use client";
/**
 * Cabeçalho da visão geral: saudação e data, seletor de empresa, período e nova operação,
 * abas de perfil, briefing com a situação e atalhos, e o aviso de período sem originação.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { brDate } from "@/src/domain/home/metrics";
import { periodLabels, profileLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { AlertIcon, CheckIcon, ClockIcon, PlusIcon, ShieldIcon, WalletIcon } from "@/src/ui/icons";
import type { HomeMetrics } from "./use-home-metrics";
import { compact, pct, Segmented } from "./widgets";

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
    cur,
    lastDate,
    active,
    activeAmount,
    ready,
    readyAmount,
    blockedOps,
    capacity,
    overdueTotal,
    overdueRatio,
    volumePct,
    criticalCount,
    urgentCount,
    health,
    periodEmpty,
  } = metrics;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const briefing =
    cur.count === 0 ? (
      <>
        Nenhuma operação originada {labels.range}
        {lastDate ? (
          <>
            {" "}
            (a última entrou em <b>{brDate(lastDate)}</b>)
          </>
        ) : null}
        . Há <b>{active.length} em andamento</b> somando <b>{compact(activeAmount)}</b>,{" "}
        <b>{ready.length} pronta(s) para liberar</b> e a carteira tem <b>{compact(overdueTotal)}</b> vencidos (
        {pct(overdueRatio, 2)}).
      </>
    ) : (
      <>
        {period === "dia" ? "Hoje entraram" : period === "semana" ? "Na semana entraram" : "No mês entraram"}{" "}
        <b>{cur.count} operação(ões)</b> somando <b>{compact(cur.volume)}</b> ({pct(volumePct, 0)} da meta), com receita
        de <b>{compact(cur.revenue)}</b> a <b>{pct(cur.rate, 2)} a.m.</b> Há <b>{active.length} em andamento</b> e{" "}
        <b>{criticalCount + urgentCount} pendência(s) prioritária(s)</b>.
      </>
    );

  const chips = [
    {
      key: "dec",
      tone: blockedOps.length ? "critical" : "ok",
      icon: <AlertIcon />,
      label: `${blockedOps.length} decisão(ões) aguardando`,
      onClick: onGoOperations,
    },
    {
      key: "lib",
      tone: ready.length ? "watch" : "ok",
      icon: <CheckIcon />,
      label: `${compact(readyAmount)} prontos para liberar`,
      onClick: onGoOperations,
    },
    {
      key: "cap",
      tone: capacity > 0 ? "ok" : "critical",
      icon: <WalletIcon />,
      label: `Capacidade de compra ${compact(capacity)}`,
      onClick: onGoFinance,
    },
    {
      key: "ina",
      tone: overdueRatio > 5 ? "critical" : overdueRatio > 0 ? "watch" : "ok",
      icon: <ShieldIcon />,
      label: `Inadimplência ${pct(overdueRatio, 1)}`,
      onClick: () => onProfileChange("risco"),
    },
  ];

  return (
    <>
      <header className="vg-head">
        <div>
          <span className="vg-date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
          <h1>{greeting}, Henrique</h1>
          <p>
            {companyScope === "Consolidado"
              ? `Consolidado de ${destinations.length} empresas e veículos`
              : companyScope}
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
        <div className="vg-brief-status">
          <span className="dot" />
          <div>
            <small>Situação {labels.range}</small>
            <strong>{health.label}</strong>
          </div>
        </div>
        <div className="vg-brief-body">
          <p>{briefing}</p>
          <div className="vg-chips">
            {chips.map(c => (
              <button key={c.key} className={`vg-chip ${c.tone}`} onClick={c.onClick}>
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>
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
