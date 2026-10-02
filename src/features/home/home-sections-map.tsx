"use client";
/**
 * Grade de cards da visão geral: o layout de cada perfil (quais seções, em que ordem e
 * largura) e o mapa que renderiza cada `SectionId` como um `Card` com seu conteúdo.
 */
import { TrendChart } from "./charts";
import {
  Aging,
  Alerts,
  Collection,
  Concentration,
  MaturityAgenda,
  Milestones,
  NeedsYou,
  Pipeline,
  RevenueMix,
  Team,
} from "@/src/features/home/sections/index";
import type { HomeMetrics } from "./use-home-metrics";
import { Card, compact, pct } from "./widgets";

import { type Operation } from "@/src/domain/core/types";
import { hhiLabel } from "@/src/domain/risk/quality-policy";
import { CollectionStrip } from "@/src/features/risk/collection-strip";
import { QualityBoard } from "@/src/features/risk/quality-board";
import { QualityPolicyModal } from "@/src/features/risk/quality-policy-modal";
import { RollRate } from "@/src/features/risk/roll-rate";
import { type useQualityPolicy } from "@/src/features/risk/use-quality-policy";
import { VintageChart } from "@/src/features/risk/vintage-chart";
import { brDate } from "@/src/domain/home/metrics";
import type { HomePeriod, HomeProfile } from "@/src/domain/home/settings";
import { ArrowIcon } from "@/src/ui/icons";
import { type ReactNode, useState } from "react";

export type SectionId =
  | "needs"
  | "milestones"
  | "pipeline"
  | "trend"
  | "aging"
  | "maturity"
  | "concentration"
  | "revenue"
  | "collection"
  | "alerts"
  | "team"
  | "quality"
  | "cobranca"
  | "rollrate"
  | "vintage";

// Grade de 12 colunas: cada linha soma 12 (8 + 4 ou 12). Abaixo de 1200px tudo vira coluna única.
// O caixa fica no bloco principal (cash-hero.tsx), acima da grade, em todos os perfis.
export const layouts: Record<HomeProfile, [SectionId, number][]> = {
  gestao: [
    ["trend", 8],
    ["revenue", 4],
    ["needs", 4],
    ["concentration", 8],
    ["aging", 4],
    ["team", 8],
    ["pipeline", 12],
    ["alerts", 12],
  ],
  operacao: [
    ["needs", 8],
    ["milestones", 4],
    ["pipeline", 12],
    ["team", 12],
    ["trend", 6],
    ["maturity", 6],
    ["alerts", 12],
  ],
  risco: [
    ["quality", 12],
    ["cobranca", 12],
    ["rollrate", 6],
    ["vintage", 6],
    ["concentration", 8],
    ["aging", 4],
    ["needs", 6],
    ["alerts", 6],
    ["maturity", 8],
    ["collection", 4],
  ],
};

export function HomeSections({
  metrics,
  profile,
  period,
  now,
  onPeriodChange,
  onOpen,
  onGoOperations,
  onGoFinance,
  qualityPolicy,
}: {
  metrics: HomeMetrics;
  profile: HomeProfile;
  period: HomePeriod;
  now: Date;
  onPeriodChange: (period: HomePeriod) => void;
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onGoFinance: () => void;
  qualityPolicy: ReturnType<typeof useQualityPolicy>;
}) {
  const m = metrics;
  const [editingPolicy, setEditingPolicy] = useState(false);
  const r = m.risk;
  const concNote = (c: typeof r.cedentConcentration) =>
    `10 maiores: ${pct(c.topShare)} · HHI ${Math.round(c.hhi).toLocaleString("pt-BR")} (${hhiLabel(c.hhi, r.policy)})`;
  const sections: Record<SectionId, (span: number) => ReactNode> = {
    needs: span => (
      <Card
        key="needs"
        span={span}
        title="Pendências"
        subtitle="Por severidade"
        action={
          <button className="vg-link" onClick={onGoOperations}>
            Ver central <ArrowIcon />
          </button>
        }
      >
        <NeedsYou
          items={m.needs}
          limit={span <= 4 ? 3 : 5}
          onOpen={onOpen}
          onGoOperations={onGoOperations}
          onGoFinance={onGoFinance}
        />
      </Card>
    ),
    milestones: span => (
      <Card key="milestones" span={span} title="Marcos do dia" subtitle="Cortes e rotinas com o que falta em cada um">
        <Milestones items={m.milestones} now={now} />
      </Card>
    ),
    pipeline: span => (
      <Card
        key="pipeline"
        span={span}
        title="Esteira de operações"
        subtitle={`${m.active.length} em andamento · ${compact(m.activeAmount)}`}
        action={
          <button className="vg-link" onClick={onGoOperations}>
            Abrir central <ArrowIcon />
          </button>
        }
      >
        <Pipeline operations={m.scoped} onOpen={onOpen} />
      </Card>
    ),
    trend: span => (
      <Card
        key="trend"
        span={span}
        title={`Originação · ${m.labels.tab.toLowerCase()}`}
        subtitle={`Volume das operações originadas ${m.labels.range} contra a meta de ${compact(m.target)}`}
      >
        <TrendChart
          values={m.trendValues}
          revenue={m.trendRevenue}
          labels={m.win.buckets.map(b => b.label)}
          future={m.win.buckets.map(b => b.future)}
          target={m.target}
          period={period}
          onWiderPeriod={period !== "mes" ? () => onPeriodChange("mes") : undefined}
          count={m.cur.count}
        />
      </Card>
    ),
    aging: span => (
      <Card
        key="aging"
        span={span}
        title="Carteira por atraso"
        subtitle={`Posição em ${brDate(m.today)} · ${m.titles.length} títulos`}
      >
        <Aging buckets={m.agingBuckets} total={m.portfolioTotal} />
      </Card>
    ),
    maturity: span => (
      <Card key="maturity" span={span} title="Agenda de vencimentos" subtitle="Hoje e próximos 10 dias úteis">
        <MaturityAgenda days={m.agenda} />
      </Card>
    ),
    concentration: span => (
      <Card
        key="concentration"
        span={span}
        title="Concentração e limites"
        subtitle="Carteira em aberto · o limite inclui operações em andamento"
      >
        <Concentration
          cedents={m.cedRows}
          debtors={m.debRows}
          vehicles={m.vehRows}
          notes={{ cedentes: concNote(r.cedentConcentration), sacados: concNote(r.debtorConcentration) }}
        />
      </Card>
    ),
    revenue: span => (
      <Card key="revenue" span={span} title="Composição da receita" subtitle={`Operações originadas ${m.labels.range}`}>
        <RevenueMix
          discount={m.cur.discount}
          fees={m.cur.fees}
          volume={m.cur.volume}
          rate={m.cur.rate}
          count={m.cur.count}
          releasedValue={m.cur.released}
          period={period}
        />
      </Card>
    ),
    collection: span => (
      <Card key="collection" span={span} title="Carteira e pendências" subtitle="Títulos e conta gráfica dos cedentes">
        <Collection rows={m.collectionRows} />
      </Card>
    ),
    alerts: span => (
      <Card key="alerts" span={span} title="Alertas de risco" subtitle="Limite, atraso, concentração e score">
        <Alerts list={m.profileAlerts} onOpen={onOpen} onGoOperations={onGoOperations} />
      </Card>
    ),
    team: span => (
      <Card
        key="team"
        span={span}
        title="Equipe e produtividade"
        subtitle={`Originado ${m.labels.range} por responsável · ritmo do que está em andamento`}
      >
        <Team rows={m.team} period={period} />
      </Card>
    ),
    quality: span => (
      <Card
        key="quality"
        span={span}
        title="Qualidade dos clientes"
        subtitle="Quem mais piorou e quem mais melhorou, com os motivos e a ação sugerida"
      >
        <QualityBoard
          cedents={r.cedentQuality}
          debtors={r.debtorQuality}
          policy={r.policy}
          onEditPolicy={() => setEditingPolicy(true)}
        />
      </Card>
    ),
    cobranca: span => (
      <Card key="cobranca" span={span} title="Cobrança do mês" subtitle="Comparado ao mês anterior">
        <CollectionStrip now={r.collection} previous={r.collectionPrevious} />
      </Card>
    ),
    rollrate: span => (
      <Card
        key="rollrate"
        span={span}
        title="Rolagem da carteira"
        subtitle="% de cada faixa de atraso que passou para a seguinte no mês"
      >
        <RollRate rows={r.rollRates} />
      </Card>
    ),
    vintage: span => (
      <Card
        key="vintage"
        span={span}
        title="Inadimplência por safra"
        subtitle="% do valor adquirido em cada mês vencido há mais de 30 dias"
      >
        <VintageChart rows={r.vintages} />
      </Card>
    ),
  };

  return (
    <>
      <div className="vg-grid">{layouts[profile].map(([id, span]) => sections[id](span))}</div>
      {editingPolicy && (
        <QualityPolicyModal
          policy={qualityPolicy.policy}
          onSave={qualityPolicy.save}
          onReset={qualityPolicy.reset}
          onClose={() => setEditingPolicy(false)}
        />
      )}
    </>
  );
}
