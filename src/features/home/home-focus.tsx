"use client";

import type { Operation } from "@/src/domain/core/types";
import type { HomeProfile } from "@/src/domain/home/settings";
import { AlertIcon, ArrowIcon, BankIcon, CheckIcon, SparkIcon } from "@/src/ui/icons";
import { CashHero } from "./cash-hero";
import { NeedsYou, type NeedItem } from "./sections/needs-you";
import { Pipeline } from "./sections/pipeline";
import type { HomeMetrics } from "./use-home-metrics";
import { compact, pct } from "./widgets";

const profileCopy: Record<HomeProfile, { eyebrow: string; quiet: string }> = {
  gestao: {
    eyebrow: "Prioridades da gestão",
    quiet: "A operação está sob controle. Acompanhe as exceções e preserve capacidade para continuar originando.",
  },
  operacao: {
    eyebrow: "Prioridades da operação",
    quiet: "A esteira está fluindo. Concentre o time nos itens fora do padrão e nas liberações do dia.",
  },
  risco: {
    eyebrow: "Prioridades de risco e cobrança",
    quiet: "A carteira está monitorada. Atue primeiro nos sinais de deterioração e nos atrasos mais antigos.",
  },
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

export function HomeFocus({
  metrics,
  profile,
  onOpen,
  onGoOperations,
  onGoFinance,
}: {
  metrics: HomeMetrics;
  profile: HomeProfile;
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onGoFinance: () => void;
}) {
  const m = metrics;
  const topNeed = m.needs[0];
  const attention = m.criticalCount + m.urgentCount;
  const headline = m.criticalCount
    ? m.criticalCount === 1
      ? "1 decisão crítica precisa de você"
      : `${m.criticalCount} decisões críticas precisam de você`
    : m.urgentCount
      ? `${m.urgentCount} prioridade${m.urgentCount > 1 ? "s" : ""} para resolver hoje`
      : "Nada crítico exige sua intervenção agora";
  const aiText = topNeed
    ? `Comece por “${topNeed.title}”. É o item de maior impacto na fila e deve ser tratado antes de ampliar o volume em andamento.`
    : profileCopy[profile].quiet;

  return (
    <>
      <section className={`vg-day-status tone-${m.health.tone}`} aria-labelledby="vg-day-title">
        <div className="vg-day-icon">{attention ? <AlertIcon /> : <CheckIcon />}</div>
        <div>
          <span>{profileCopy[profile].eyebrow}</span>
          <h2 id="vg-day-title">{headline}</h2>
          <p>
            {m.active.length} {m.active.length === 1 ? "operação" : "operações"} em andamento · {m.ready.length}{" "}
            {m.ready.length === 1 ? "pronta" : "prontas"} para liberar · posição de hoje
          </p>
        </div>
        {topNeed && (
          <button
            className={topNeed.severity === "critical" ? "vg-btn primary" : "vg-btn"}
            onClick={() => actOnNeed(topNeed, onOpen, onGoOperations, onGoFinance)}
          >
            {topNeed.action} <ArrowIcon />
          </button>
        )}
      </section>

      <div className="vg-focus-grid">
        <section className="vg-focus-card vg-priority-card">
          <header>
            <div>
              <span>AGORA</span>
              <h2>O que exige ação</h2>
              <p>Ordenado por impacto e urgência, sem misturar relatórios.</p>
            </div>
            <button className="vg-link" onClick={onGoOperations}>
              Ver central <ArrowIcon />
            </button>
          </header>
          <NeedsYou
            items={m.needs}
            limit={4}
            onOpen={onOpen}
            onGoOperations={onGoOperations}
            onGoFinance={onGoFinance}
          />
        </section>

        <section className="vg-focus-card vg-capacity-card">
          <header>
            <div>
              <span>CAPACIDADE</span>
              <h2>Caixa e espaço para operar</h2>
              <p>O suficiente para decidir sem abrir o fluxo financeiro.</p>
            </div>
            <BankIcon />
          </header>
          <div className="vg-capacity-main">
            <span>Caixa livre hoje</span>
            <strong>{compact(m.freeCash)}</strong>
            <small>
              saldo {compact(m.bankBalance)} menos mínimo operacional {compact(m.minimumCash)}
            </small>
          </div>
          <div className="vg-capacity-rows">
            <div>
              <span>Capacidade em 7 dias</span>
              <b>{compact(m.liquidity.operatingCapacity)}</b>
            </div>
            <div>
              <span>Menor saldo projetado</span>
              <b>{compact(m.liquidity.minimumProjectedValue)}</b>
            </div>
            <div>
              <span>Liberações prontas</span>
              <b>{compact(m.readyAmount)}</b>
            </div>
          </div>
          <button className="vg-btn action-primary vg-capacity-action" onClick={onGoFinance}>
            Abrir Financeiro <ArrowIcon />
          </button>
        </section>
      </div>

      <section className="vg-ai-reading" aria-label="Leitura assistida da situação">
        <div className="vg-ai-icon">
          <SparkIcon />
        </div>
        <div>
          <span>LEITURA STRATO · IA ASSISTIVA</span>
          <strong>{aiText}</strong>
          <small>
            Evidências: {m.blockedOps.length}{" "}
            {m.blockedOps.length === 1 ? "operação bloqueada" : "operações bloqueadas"}, {compact(m.market.overdue30)}{" "}
            vencidos acima de 30 dias e {compact(m.liquidity.operatingCapacity)} de capacidade operacional.
          </small>
        </div>
        <em>Recomendação · decisão humana</em>
      </section>

      <section className="vg-focus-card vg-flow-card">
        <header>
          <div>
            <span>FLUXO</span>
            <h2>Onde o trabalho está agora</h2>
            <p>{m.active.length} operações em andamento · veja apenas o desvio que precisa de atenção.</p>
          </div>
          <button className="vg-link" onClick={onGoOperations}>
            Abrir esteira <ArrowIcon />
          </button>
        </header>
        <Pipeline operations={m.scoped} onOpen={onOpen} />
      </section>

      <section className="vg-deep-dive" aria-labelledby="vg-deep-title">
        <div className="vg-deep-heading">
          <span>QUANDO PRECISAR</span>
          <h2 id="vg-deep-title">Aprofundar a análise</h2>
          <p>Os detalhes continuam disponíveis, mas não disputam atenção com as decisões do dia.</p>
        </div>

        <details>
          <summary>
            <span>
              <b>Liquidez projetada</b>
              <small>Cenários, entradas, saídas e saldo mínimo</small>
            </span>
            <ArrowIcon />
          </summary>
          <div className="vg-deep-content">
            <CashHero timeline={m.timeline} balance={m.bankBalance} minimum={m.minimumCash} onGoFinance={onGoFinance} />
          </div>
        </details>

        <details>
          <summary>
            <span>
              <b>Resultado e qualidade da carteira</b>
              <small>Rentabilidade, provisão, atraso e concentração</small>
            </span>
            <ArrowIcon />
          </summary>
          <div className="vg-deep-metrics">
            <div>
              <span>Resultado líquido</span>
              <b className={m.economics.result < 0 ? "bad" : "good"}>{compact(m.economics.result)}</b>
              <small>receitas menos despesas reconhecidas</small>
            </div>
            <div>
              <span>Resultado após PDD</span>
              <b className={m.economics.result - m.market.provision < 0 ? "bad" : "good"}>
                {compact(m.economics.result - m.market.provision)}
              </b>
              <small>resultado menos provisão estimada</small>
            </div>
            <div>
              <span>Carteira em aberto</span>
              <b>{compact(m.portfolioTotal)}</b>
              <small>{m.titles.length} título(s) monitorado(s)</small>
            </div>
            <div>
              <span>Inadimplência</span>
              <b className={m.overdueRatio > 5 ? "bad" : ""}>{pct(m.overdueRatio)}</b>
              <small>{compact(m.overdueTotal)} vencidos</small>
            </div>
            <div>
              <span>PDD estimada</span>
              <b>{compact(m.market.provision)}</b>
              <small>pelas faixas da política ativa</small>
            </div>
            <div>
              <span>10 maiores cedentes</span>
              <b>{pct(m.risk.cedentConcentration.topShare)}</b>
              <small>participação na carteira em aberto</small>
            </div>
          </div>
        </details>
      </section>
    </>
  );
}
