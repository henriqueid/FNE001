"use client";
/**
 * Visão geral (home): orquestra preferências de visualização, métricas e as partes da
 * página (cabeçalho, bloco principal de caixa, faixa de KPIs e grade de cards do perfil).
 *
 * - `use-home-preferences.ts`: período, perfil e relógio.
 * - `use-home-metrics.ts`: todos os números e listas derivados das props.
 * - `home-header.tsx`, `home-kpis.tsx`, `home-sections-map.tsx`: apresentação.
 */
import { HomeFocus } from "./home-focus";
import { HomeHeader } from "./home-header";
import { HomeKpis } from "./home-kpis";
import { useHomeMetrics } from "./use-home-metrics";
import { useHomePreferences } from "./use-home-preferences";
import { useQualityPolicy } from "@/src/features/risk/use-quality-policy";

import { type Debtor, type Operation } from "@/src/domain/core/types";
import { type CarteiraFlow } from "@/src/domain/finance/reports";
import type { FinanceState } from "@/src/domain/finance/model";
import type { OpFinancial, PortfolioTitle } from "@/src/domain/home/metrics";
import type { OperationalDefaultsState } from "@/src/domain/registry/operational-profile";

export { layouts, type SectionId } from "./home-sections-map";

export default function HomeDashboard({
  operations,
  debtors,
  financials,
  finance,
  carteira,
  onGoFinance,
  companyScope,
  onOpen,
  onGoOperations,
  onGoLive,
  onNew,
  revenueGoals,
  originationGoals,
  includeDemoPortfolio = false,
  portfolioTitlesOverride,
}: {
  operations: Operation[];
  debtors: Debtor[];
  financials: Record<string, OpFinancial>;
  finance: FinanceState;
  carteira: CarteiraFlow[];
  onGoFinance: () => void;
  companyScope: string;
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onGoLive?: () => void;
  onNew?: () => void;
  revenueGoals: OperationalDefaultsState["revenueGoals"];
  originationGoals: OperationalDefaultsState["originationGoals"];
  includeDemoPortfolio?: boolean;
  portfolioTitlesOverride?: PortfolioTitle[];
}) {
  const { period, setPeriod, profile, chooseProfile, now, positionDate, setPositionDate } = useHomePreferences();
  const position = new Date(`${positionDate}T12:00:00`);
  const quality = useQualityPolicy();
  const metrics = useHomeMetrics({
    operations,
    debtors,
    financials,
    finance,
    carteira,
    companyScope,
    period,
    profile,
    now: position,
    qualityPolicy: quality.policy,
    revenueGoals,
    originationGoals,
    includeDemoPortfolio,
    portfolioTitlesOverride,
  });

  return (
    <div className="page-wrap vg">
      <HomeHeader
        metrics={metrics}
        positionDate={positionDate}
        onPositionDateChange={setPositionDate}
        period={period}
        onPeriodChange={setPeriod}
        profile={profile}
        onProfileChange={chooseProfile}
        companyScope={companyScope}
        onGoLive={onGoLive}
        onNew={onNew}
      />

      <HomeKpis metrics={metrics} profile={profile} onGoOperations={onGoOperations} onGoFinance={onGoFinance} />

      <HomeFocus
        metrics={metrics}
        profile={profile}
        onOpen={onOpen}
        onGoOperations={onGoOperations}
        onGoFinance={onGoFinance}
      />

      <p className="vg-footnote">
        Posição em {position.toLocaleDateString("pt-BR")} · calculado a partir das operações, da carteira, dos cadastros
        e do financeiro · atualizado às {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
