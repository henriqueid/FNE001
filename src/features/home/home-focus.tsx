"use client";

import type { ReactNode } from "react";
import type { Operation } from "@/src/domain/core/types";
import type { HomeProfile } from "@/src/domain/home/settings";
import { AlertIcon, ArrowIcon, BankIcon, CheckIcon, ClockIcon, ShieldIcon, SparkIcon } from "@/src/ui/icons";
import { CashHero } from "./cash-hero";
import { Aging, Alerts, MaturityAgenda, Milestones, Team } from "./sections";
import { NeedsYou, type NeedItem } from "./sections/needs-you";
import { Pipeline } from "./sections/pipeline";
import type { HomeMetrics } from "./use-home-metrics";
import { compact, pct } from "./widgets";

type FocusProps = {
  metrics: HomeMetrics;
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onGoFinance: () => void;
};

function actOnNeed(
  item: NeedItem,
  onOpen: (op: Operation) => void,
  onGoOperations: () => void,
  onGoFinance: () => void,
) {
  if (item.op) onOpen(item.op);
  else if (item.go === "finance") onGoFinance();
  else onGoOperations();
}

function DayStatus({
  eyebrow,
  headline,
  detail,
  tone,
  action,
  actionLabel,
}: {
  eyebrow: string;
  headline: string;
  detail: string;
  tone: "critical" | "watch" | "ok";
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className={`vg-day-status tone-${tone}`} aria-label={eyebrow}>
      <div className="vg-day-icon">{tone === "ok" ? <CheckIcon /> : <AlertIcon />}</div>
      <div>
        <span>{eyebrow}</span>
        <h2>{headline}</h2>
        <p>{detail}</p>
      </div>
      {action && (
        <button className={tone === "critical" ? "vg-btn primary" : "vg-btn"} onClick={action}>
          {actionLabel} <ArrowIcon />
        </button>
      )}
    </section>
  );
}

function AiReading({ text, evidence }: { text: string; evidence: string }) {
  return (
    <section className="vg-ai-reading" aria-label="Leitura assistida da situação">
      <div className="vg-ai-icon">
        <SparkIcon />
      </div>
      <div>
        <span>LEITURA STRATO · IA ASSISTIVA</span>
        <strong>{text}</strong>
        <small>Evidências: {evidence}</small>
      </div>
      <em>Recomendação · decisão humana</em>
    </section>
  );
}

function PriorityCard({
  metrics: m,
  title,
  subtitle,
  onOpen,
  onGoOperations,
  onGoFinance,
}: FocusProps & { title: string; subtitle: string }) {
  return (
    <section className="vg-focus-card vg-priority-card">
      <header>
        <div>
          <span>AGORA</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="vg-link" onClick={onGoOperations}>
          Ver central <ArrowIcon />
        </button>
      </header>
      <NeedsYou items={m.needs} limit={4} onOpen={onOpen} onGoOperations={onGoOperations} onGoFinance={onGoFinance} />
    </section>
  );
}

function MetricRows({ children }: { children: ReactNode }) {
  return <div className="vg-capacity-rows">{children}</div>;
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <span>{label}</span>
      <b className={tone}>{value}</b>
    </div>
  );
}

function DeepDive({ children }: { children: ReactNode }) {
  return (
    <section className="vg-deep-dive" aria-labelledby="vg-deep-title">
      <div className="vg-deep-heading">
        <span>QUANDO PRECISAR</span>
        <h2 id="vg-deep-title">Aprofundar esta perspectiva</h2>
        <p>Detalhes do contexto atual, disponíveis sem disputar atenção com a decisão principal.</p>
      </div>
      {children}
    </section>
  );
}

function Detail({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <details>
      <summary>
        <span>
          <b>{title}</b>
          <small>{subtitle}</small>
        </span>
        <ArrowIcon />
      </summary>
      {children}
    </details>
  );
}

function ManagementFocus(props: FocusProps) {
  const { metrics: m, onOpen, onGoOperations, onGoFinance } = props;
  const topNeed = m.needs[0];
  const resultAfterPdd = m.economics.result - m.market.provision;
  return (
    <>
      <DayStatus
        eyebrow="LEITURA EXECUTIVA"
        headline={resultAfterPdd >= 0 ? "Resultado e caixa sustentam a operação" : "Resultado após risco exige revisão"}
        detail={`${compact(m.cur.volume)} originados ${m.labels.range} · ${compact(m.freeCash)} de caixa livre · ${pct(m.overdueRatio)} de inadimplência`}
        tone={resultAfterPdd < 0 ? "critical" : m.health.tone}
        action={topNeed ? () => actOnNeed(topNeed, onOpen, onGoOperations, onGoFinance) : onGoFinance}
        actionLabel={topNeed?.action ?? "Ver caixa"}
      />
      <div className="vg-focus-grid">
        <PriorityCard
          {...props}
          title="Decisões de maior impacto"
          subtitle="Exceções que afetam resultado, caixa ou continuidade da originação."
        />
        <section className="vg-focus-card vg-capacity-card">
          <header>
            <div>
              <span>RESULTADO E CAPACIDADE</span>
              <h2>Espaço para crescer</h2>
              <p>Visão consolidada para a decisão executiva.</p>
            </div>
            <BankIcon />
          </header>
          <div className="vg-capacity-main">
            <span>Resultado após PDD</span>
            <strong className={resultAfterPdd < 0 ? "bad" : "good"}>{compact(resultAfterPdd)}</strong>
            <small>resultado reconhecido menos provisão estimada</small>
          </div>
          <MetricRows>
            <MetricRow
              label="Caixa livre hoje"
              value={compact(m.freeCash)}
              tone={m.freeCash < m.readyAmount ? "bad" : "good"}
            />
            <MetricRow label="Capacidade em 7 dias" value={compact(m.liquidity.operatingCapacity)} />
            <MetricRow label="Meta de originação" value={`${pct(m.volumePct, 0)} atingida`} />
            <MetricRow label="Limites disponíveis" value={compact(m.limitHeadroom)} />
          </MetricRows>
          <button className="vg-btn action-primary vg-capacity-action" onClick={onGoFinance}>
            Abrir Financeiro <ArrowIcon />
          </button>
        </section>
      </div>
      <AiReading
        text={
          topNeed
            ? `Resolva “${topNeed.title}” antes de ampliar a exposição. Depois, há ${compact(m.liquidity.operatingCapacity)} de capacidade operacional para novas decisões.`
            : "Não há exceção executiva crítica. Preserve liquidez e avance a originação dentro dos limites disponíveis."
        }
        evidence={`${compact(resultAfterPdd)} de resultado após PDD, ${pct(m.risk.cedentConcentration.topShare)} concentrados nos 10 maiores cedentes e ${compact(m.liquidity.operatingCapacity)} de capacidade`}
      />
      <section className="vg-focus-card vg-flow-card">
        <header>
          <div>
            <span>PORTFÓLIO</span>
            <h2>Equilíbrio da operação</h2>
            <p>Resultado, carteira e exposição em uma leitura curta.</p>
          </div>
        </header>
        <div className="vg-decision-strip">
          <div>
            <span>Resultado líquido</span>
            <b>{compact(m.economics.result)}</b>
            <small>antes da provisão</small>
          </div>
          <div>
            <span>Carteira em aberto</span>
            <b>{compact(m.portfolioTotal)}</b>
            <small>{m.titles.length} títulos</small>
          </div>
          <div>
            <span>PDD estimada</span>
            <b>{compact(m.market.provision)}</b>
            <small>{pct(m.portfolioTotal ? (m.market.provision / m.portfolioTotal) * 100 : 0)} da carteira</small>
          </div>
          <div>
            <span>10 maiores cedentes</span>
            <b>{pct(m.risk.cedentConcentration.topShare)}</b>
            <small>concentração atual</small>
          </div>
        </div>
      </section>
      <DeepDive>
        <Detail title="Liquidez projetada" subtitle="Cenários, entradas, saídas e saldo mínimo">
          <div className="vg-deep-content">
            <CashHero timeline={m.timeline} balance={m.bankBalance} minimum={m.minimumCash} onGoFinance={onGoFinance} />
          </div>
        </Detail>
        <Detail title="Resultado e qualidade da carteira" subtitle="Rentabilidade, provisão, atraso e concentração">
          <div className="vg-deep-metrics">
            <div>
              <span>Receita do período</span>
              <b>{compact(m.cur.revenue)}</b>
              <small>{m.labels.range}</small>
            </div>
            <div>
              <span>Taxa média</span>
              <b>{m.cur.count ? `${pct(m.cur.rate, 2)} a.m.` : "—"}</b>
              <small>ponderada pelo valor de face</small>
            </div>
            <div>
              <span>Inadimplência</span>
              <b className={m.overdueRatio > 5 ? "bad" : ""}>{pct(m.overdueRatio)}</b>
              <small>{compact(m.overdueTotal)} vencidos</small>
            </div>
          </div>
        </Detail>
      </DeepDive>
    </>
  );
}

function OperationFocus(props: FocusProps) {
  const { metrics: m, onOpen, onGoOperations, onGoFinance } = props;
  const topNeed = m.needs[0];
  const period = m.labels.tab === "Hoje" ? "dia" : m.labels.tab === "Semana" ? "semana" : "mes";
  const headline = m.blockedOps.length
    ? `${m.blockedOps.length} ${m.blockedOps.length === 1 ? "operação bloqueada" : "operações bloqueadas"} na esteira`
    : m.ready.length
      ? `${m.ready.length} ${m.ready.length === 1 ? "operação pronta" : "operações prontas"} para liberar`
      : "A esteira está fluindo dentro do padrão";
  return (
    <>
      <DayStatus
        eyebrow="COMANDO OPERACIONAL"
        headline={headline}
        detail={`${m.active.length} em andamento · ${m.interventions.length} intervenções · priorize os cortes do dia`}
        tone={m.blockedOps.length ? "critical" : m.interventions.length ? "watch" : "ok"}
        action={topNeed ? () => actOnNeed(topNeed, onOpen, onGoOperations, onGoFinance) : onGoOperations}
        actionLabel={topNeed?.action ?? "Abrir esteira"}
      />
      <div className="vg-focus-grid">
        <PriorityCard
          {...props}
          title="Fila de trabalho"
          subtitle="Pendências operacionais ordenadas por impacto e prazo de corte."
        />
        <section className="vg-focus-card vg-capacity-card vg-operation-card">
          <header>
            <div>
              <span>RITMO DO DIA</span>
              <h2>Produção e liberação</h2>
              <p>O que precisa fluir antes dos cortes.</p>
            </div>
            <ClockIcon />
          </header>
          <div className="vg-capacity-main">
            <span>Prontas para liberar</span>
            <strong>{compact(m.readyAmount)}</strong>
            <small>{m.ready.length} operação(ões) aguardando envio ao financeiro</small>
          </div>
          <MetricRows>
            <MetricRow label="Volume em andamento" value={compact(m.activeAmount)} />
            <MetricRow
              label="Operações bloqueadas"
              value={String(m.blockedOps.length)}
              tone={m.blockedOps.length ? "bad" : "good"}
            />
            <MetricRow label="Intervenções abertas" value={String(m.interventions.length)} />
            <MetricRow label={`Liberadas ${m.labels.range}`} value={compact(m.cur.released)} />
          </MetricRows>
          <button className="vg-btn action-primary vg-capacity-action" onClick={onGoOperations}>
            Abrir central operacional <ArrowIcon />
          </button>
        </section>
      </div>
      <AiReading
        text={
          m.blockedOps.length
            ? `Desbloqueie primeiro ${m.blockedOps[0].cedent}. A fila pronta só deve avançar depois que os bloqueios críticos estiverem atribuídos.`
            : m.ready.length
              ? `Priorize a liberação de ${compact(m.readyAmount)} antes do corte. A esteira não apresenta bloqueios críticos.`
              : "A esteira está equilibrada. Direcione a equipe para as intervenções fora do tempo padrão."
        }
        evidence={`${m.blockedOps.length} bloqueios, ${m.ready.length} prontas para liberar e ${m.interventions.length} itens que pedem intervenção`}
      />
      <section className="vg-focus-card vg-flow-card">
        <header>
          <div>
            <span>ESTEIRA</span>
            <h2>Onde o trabalho está agora</h2>
            <p>{m.active.length} operações em andamento · etapas, volume e desvios.</p>
          </div>
          <button className="vg-link" onClick={onGoOperations}>
            Abrir esteira <ArrowIcon />
          </button>
        </header>
        <Pipeline operations={m.scoped} onOpen={onOpen} />
      </section>
      <DeepDive>
        <Detail title="Marcos e cortes do dia" subtitle="Comitê, cobrança, TED e conciliação">
          <div className="vg-deep-content">
            <Milestones items={m.milestones} now={new Date()} />
          </div>
        </Detail>
        <Detail title="Equipe e produtividade" subtitle="Volume por responsável e ritmo do trabalho">
          <div className="vg-deep-content">
            <Team rows={m.team} period={period} />
          </div>
        </Detail>
      </DeepDive>
    </>
  );
}

function RiskFocus(props: FocusProps) {
  const { metrics: m, onOpen, onGoOperations, onGoFinance } = props;
  const topNeed = m.needs[0];
  const worsening = m.risk.cedentQuality.worsening.length;
  const headline =
    m.market.overdue30 > 0
      ? `${compact(m.market.overdue30)} vencidos há mais de 30 dias`
      : worsening
        ? `${worsening} cedentes com sinal de deterioração`
        : "A carteira não apresenta deterioração relevante";
  return (
    <>
      <DayStatus
        eyebrow="RISCO E COBRANÇA"
        headline={headline}
        detail={`${compact(m.overdueTotal)} vencidos · ${compact(m.market.provision)} de PDD · ${worsening} cedentes piorando`}
        tone={m.market.overdue90 > 0 ? "critical" : m.overdueTotal || worsening ? "watch" : "ok"}
        action={topNeed ? () => actOnNeed(topNeed, onOpen, onGoOperations, onGoFinance) : onGoOperations}
        actionLabel={topNeed?.action ?? "Ver carteira"}
      />
      <div className="vg-focus-grid">
        <PriorityCard
          {...props}
          title="Ações de risco e cobrança"
          subtitle="Atrasos, limites e deteriorações que pedem tratamento."
        />
        <section className="vg-focus-card vg-capacity-card vg-risk-card">
          <header>
            <div>
              <span>CARTEIRA SOB RISCO</span>
              <h2>Exposição e proteção</h2>
              <p>A dimensão financeira dos sinais atuais.</p>
            </div>
            <ShieldIcon />
          </header>
          <div className="vg-capacity-main">
            <span>PDD estimada</span>
            <strong>{compact(m.market.provision)}</strong>
            <small>
              {pct(m.portfolioTotal ? (m.market.provision / m.portfolioTotal) * 100 : 0)} da carteira em aberto
            </small>
          </div>
          <MetricRows>
            <MetricRow label="Vencido total" value={compact(m.overdueTotal)} tone={m.overdueTotal ? "bad" : "good"} />
            <MetricRow label="Vencido > 30 dias" value={compact(m.market.overdue30)} />
            <MetricRow
              label="Vencido > 90 dias"
              value={compact(m.market.overdue90)}
              tone={m.market.overdue90 ? "bad" : undefined}
            />
            <MetricRow label="Cedentes piorando" value={String(worsening)} />
          </MetricRows>
          <button className="vg-btn action-primary vg-capacity-action" onClick={onGoOperations}>
            Abrir tratamento <ArrowIcon />
          </button>
        </section>
      </div>
      <AiReading
        text={
          m.market.overdue90 > 0
            ? `Ataque primeiro a exposição acima de 90 dias (${compact(m.market.overdue90)}). Ela concentra a maior perda esperada e deve preceder novas exceções de limite.`
            : m.market.overdue30 > 0
              ? `Priorize os ${compact(m.market.overdue30)} vencidos há mais de 30 dias. A régua deve avançar de cobrança para recompra antes que essa exposição migre para a faixa crítica.`
              : worsening
                ? `Revise os ${worsening} cedentes em deterioração antes da próxima liberação. O atraso ainda está concentrado em faixas recuperáveis.`
                : "A qualidade da carteira está estável. Mantenha a régua preventiva nos próximos vencimentos."
        }
        evidence={`${compact(m.market.overdue30)} acima de 30 dias, ${compact(m.market.overdue90)} acima de 90 dias e ${pct(m.risk.cedentConcentration.topShare)} nos 10 maiores cedentes`}
      />
      <section className="vg-focus-card vg-flow-card">
        <header>
          <div>
            <span>COMPOSIÇÃO DO ATRASO</span>
            <h2>Carteira por faixa</h2>
            <p>Onde está o saldo e como ele se distribui por envelhecimento.</p>
          </div>
        </header>
        <Aging buckets={m.agingBuckets} total={m.portfolioTotal} />
      </section>
      <DeepDive>
        <Detail title="Agenda de vencimentos" subtitle="Hoje e próximos dias úteis">
          <div className="vg-deep-content">
            <MaturityAgenda days={m.agenda} />
          </div>
        </Detail>
        <Detail title="Alertas e deterioração" subtitle="Limite, concentração, atraso e score">
          <div className="vg-deep-content">
            <Alerts list={m.profileAlerts} onOpen={onOpen} onGoOperations={onGoOperations} />
          </div>
        </Detail>
      </DeepDive>
    </>
  );
}

export function HomeFocus({ profile, ...props }: FocusProps & { profile: HomeProfile }) {
  if (profile === "operacao") return <OperationFocus {...props} />;
  if (profile === "risco") return <RiskFocus {...props} />;
  return <ManagementFocus {...props} />;
}
