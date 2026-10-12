"use client";

import { type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { AlertIcon, ArrowIcon, ChartIcon, CloseIcon, SparkIcon, WalletIcon } from "@/src/ui/icons";
import { useEffect } from "react";
import { type AppView } from "@/src/features/shell/shell-context";

const compact = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 2,
  });
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

export function DailyBriefing({
  briefing,
  onClose,
  onHideToday,
  onNavigate,
  onOpenAttention,
}: {
  briefing: DailyBriefingData;
  onClose: () => void;
  onHideToday: () => void;
  onNavigate: (view: AppView) => void;
  onOpenAttention: () => void;
}) {
  const firstName = briefing.user.name.split(" ")[0];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (view: AppView) => {
    onClose();
    onNavigate(view);
  };
  const firstPriority = briefing.priorities[0];
  const openAttention = () => {
    onClose();
    onOpenAttention();
  };
  return (
    <div className="cpl-day-backdrop" role="presentation">
      <section className="cpl-day" role="dialog" aria-modal="true" aria-labelledby="cpl-day-title">
        <header className="cpl-day-head">
          <div className="cpl-day-brand">
            <span>
              <SparkIcon />
            </span>
            <div>
              <small>STRATO INTELLIGENCE · ABERTURA DO DIA</small>
              <b>Copiloto operacional</b>
            </div>
          </div>
          <button type="button" aria-label="Fechar resumo do dia" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="cpl-day-intro">
          <div>
            <span>{briefing.scopeLabel}</span>
            <h1 id="cpl-day-title">Bom dia, {firstName}.</h1>
            <p>
              Seu dia começa com <b>{briefing.taskCount} itens que merecem atenção</b>. Organizei o que tem maior
              impacto para você começar pela decisão certa.
            </p>
          </div>
          <aside>
            <small>SEU PERFIL</small>
            <b>{briefing.user.role}</b>
            <span>{briefing.user.department}</span>
          </aside>
        </div>

        <div className="cpl-day-kpis">
          <article>
            <span className="cpl-day-kpi-icon">
              <AlertIcon />
            </span>
            <div>
              <small>PRIORIDADES</small>
              <strong>{briefing.taskCount}</strong>
              <span>itens para hoje</span>
            </div>
          </article>
          <article>
            <span className="cpl-day-kpi-icon">
              <ChartIcon />
            </span>
            <div>
              <small>CARTEIRA</small>
              <strong>{compact(briefing.portfolioTotal)}</strong>
              <span>{briefing.overdueCount} títulos vencidos</span>
            </div>
          </article>
          <article>
            <span className="cpl-day-kpi-icon">
              <WalletIcon />
            </span>
            <div>
              <small>VENCIDO</small>
              <strong>{compact(briefing.overdueTotal)}</strong>
              <span>posição atual</span>
            </div>
          </article>
          <article data-tone={briefing.revenueTrend === "below" ? "warning" : "good"}>
            <span className="cpl-day-kpi-icon">
              <SparkIcon />
            </span>
            <div>
              <small>META DO MÊS</small>
              <strong>{pct(briefing.revenueAttainment)}</strong>
              <span>{compact(briefing.revenue)} realizados</span>
            </div>
          </article>
        </div>

        <div className="cpl-day-grid">
          <section className="cpl-day-priorities">
            <header>
              <div>
                <small>AGENDA INTELIGENTE</small>
                <h2>O que pede sua atenção</h2>
              </div>
              <span>{briefing.priorities.length} frentes</span>
            </header>
            {briefing.priorities.length ? (
              <ol>
                {briefing.priorities.map((priority, index) => (
                  <li key={priority.id} data-tone={priority.tone}>
                    <button type="button" onClick={openAttention}>
                      <i>{String(index + 1).padStart(2, "0")}</i>
                      <span>
                        <b>{priority.title}</b>
                        <small>{priority.detail}</small>
                      </span>
                      <ArrowIcon />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="cpl-day-clear">
                <b>Nenhuma pendência crítica.</b>
                <span>O fluxo está dentro do padrão esperado.</span>
              </div>
            )}
          </section>

          <aside className="cpl-day-goal">
            <small>RITMO DE RECEITA</small>
            <h2>{compact(briefing.revenueRemaining)} para a meta</h2>
            <p>
              Meta de {compact(briefing.revenueTarget)}. O ritmo necessário agora é de{" "}
              {compact(briefing.requiredDailyPace)}
              por dia útil restante.
            </p>
            <div className="cpl-day-goal-track" aria-label={`${pct(briefing.revenueAttainment)} da meta`}>
              <i style={{ width: `${Math.min(100, briefing.revenueAttainment)}%` }} />
            </div>
            <div className="cpl-day-goal-scale">
              <span>{compact(briefing.revenue)}</span>
              <b>{pct(briefing.revenueAttainment)}</b>
              <span>{compact(briefing.revenueTarget)}</span>
            </div>
            <button type="button" onClick={() => go("home")}>
              Ver ritmo completo <ArrowIcon />
            </button>
          </aside>
        </div>

        <footer className="cpl-day-footer">
          <span>Este resumo abre ao entrar e respeita seu perfil, departamento e responsabilidades.</span>
          <div>
            <button type="button" className="cpl-day-secondary" onClick={onHideToday}>
              Não mostrar mais hoje
            </button>
            <button type="button" className="cpl-day-secondary" onClick={() => go("home")}>
              Ver visão geral
            </button>
            <button
              type="button"
              className="cpl-day-primary"
              onClick={firstPriority ? openAttention : () => go("home")}
            >
              Começar pelas prioridades <ArrowIcon />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
