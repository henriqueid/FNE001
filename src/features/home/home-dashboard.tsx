"use client";
/**
 * Visão geral (home): orquestra preferências de visualização, métricas e as três partes
 * da página (cabeçalho com briefing, faixa de KPIs e grade de cards do perfil).
 *
 * - `use-home-preferences.ts`: período, perfil e relógio.
 * - `use-home-metrics.ts`: todos os números e listas derivados das props.
 * - `home-header.tsx`, `home-kpis.tsx`, `home-sections-map.tsx`: apresentação.
 */
import { HomeHeader } from "./home-header";
import { HomeKpis } from "./home-kpis";
import { HomeSections } from "./home-sections-map";
import { useHomeMetrics } from "./use-home-metrics";
import { useHomePreferences } from "./use-home-preferences";

import { type Debtor, type Operation } from "@/src/domain/core/types";
import { type CarteiraFlow } from "@/src/domain/finance/reports";
import type { FinanceState } from "@/src/domain/finance/model";
import type { OpFinancial } from "@/src/domain/home/metrics";

export { layouts, type SectionId } from "./home-sections-map";

export default function HomeDashboard({
  operations,
  debtors,
  financials,
  finance,
  carteira,
  onGoFinance,
  companyScope,
  onCompanyScopeChange,
  onOpen,
  onGoOperations,
  onNew,
}: {
  operations: Operation[];
  debtors: Debtor[];
  financials: Record<string, OpFinancial>;
  finance: FinanceState;
  carteira: CarteiraFlow[];
  onGoFinance: () => void;
  companyScope: string;
  onCompanyScopeChange: (scope: string) => void;
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onNew: () => void;
}) {
  const { period, setPeriod, profile, chooseProfile, now } = useHomePreferences();
  const metrics = useHomeMetrics({
    operations,
    debtors,
    financials,
    finance,
    carteira,
    companyScope,
    period,
    profile,
    now,
  });

  return (
    <div className="page-wrap vg">
      <HomeHeader
        metrics={metrics}
        now={now}
        period={period}
        onPeriodChange={setPeriod}
        profile={profile}
        onProfileChange={chooseProfile}
        companyScope={companyScope}
        onCompanyScopeChange={onCompanyScopeChange}
        onGoOperations={onGoOperations}
        onGoFinance={onGoFinance}
        onNew={onNew}
      />

      <HomeKpis metrics={metrics} profile={profile} />

      <HomeSections
        metrics={metrics}
        profile={profile}
        period={period}
        now={now}
        onPeriodChange={setPeriod}
        onOpen={onOpen}
        onGoOperations={onGoOperations}
        onGoFinance={onGoFinance}
      />

      <p className="vg-footnote">
        Calculado a partir das operações, da carteira, dos cadastros e do financeiro · atualizado às{" "}
        {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
