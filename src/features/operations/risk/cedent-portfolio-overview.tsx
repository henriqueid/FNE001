"use client";
/**
 * Análise completa do cedente: limites, relacionamento, posição e comportamento da carteira,
 * últimas operações, maiores sacados e apontamentos. Derivações em `cedent-portfolio-model`.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent } from "@/src/domain/core/types";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";
import { useState } from "react";
import { CedentHistoryList } from "./cedent-history-list";
import { CedentLedgerSection } from "./cedent-ledger-section";
import {
  type CedentDebtorRanking,
  type CedentRecentOperation,
  buildCedentPortfolio,
  confirmationTone,
  percent,
} from "./cedent-portfolio-model";
import { CedentTopDebtors } from "./cedent-top-debtors";

export type { CedentDebtorRanking, CedentRecentOperation } from "./cedent-portfolio-model";

export function CedentPortfolioOverview({ cedent }: { cedent?: Cedent }) {
  const [selectedHistoricOperation, setSelectedHistoricOperation] = useState<CedentRecentOperation | null>(null);
  const [selectedRankedDebtor, setSelectedRankedDebtor] = useState<CedentDebtorRanking | null>(null);
  if (!cedent)
    return (
      <div className="risk-empty">
        <AlertIcon />
        <strong>Cadastro do cedente não localizado</strong>
        <span>Vincule o cedente para consultar sua posição na carteira.</span>
      </div>
    );
  const portfolio = buildCedentPortfolio(cedent);
  const { utilization, available, criticalProfile, healthyProfile, confirmationRate, repurchaseRate } = portfolio;

  return (
    <div className="cedent-overview">
      <div className="cedent-overview-kpis">
        <div>
          <span>SCORE INTERNO</span>
          <strong className={criticalProfile ? "negative" : healthyProfile ? "positive" : "warning-text"}>
            {cedent.score}
          </strong>
          <small>{cedent.publicStatus}</small>
        </div>
        <div>
          <span>LIMITE APROVADO</span>
          <strong>{preciseMoney.format(cedent.creditLimit)}</strong>
          <small>Política vigente do cedente</small>
        </div>
        <div>
          <span>LIMITE UTILIZADO</span>
          <strong>{preciseMoney.format(cedent.usedLimit)}</strong>
          <small>{percent(utilization)}% comprometido</small>
        </div>
        <div>
          <span>DISPONÍVEL</span>
          <strong className={available > 0 ? "positive" : "negative"}>{preciseMoney.format(available)}</strong>
          <small>Antes da nova operação</small>
        </div>
      </div>
      <div className="cedent-utilization">
        <div>
          <span>UTILIZAÇÃO DO LIMITE</span>
          <strong>{percent(utilization)}%</strong>
        </div>
        <div className="cedent-utilization-track">
          <i
            className={utilization >= 80 ? "danger" : utilization >= 65 ? "attention" : "healthy"}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <small>
          {preciseMoney.format(cedent.usedLimit)} utilizados de {preciseMoney.format(cedent.creditLimit)}
        </small>
      </div>
      <div className="cedent-relationship-kpis">
        <div>
          <span>PERIODICIDADE</span>
          <strong>{portfolio.frequencyLabel}</strong>
          <small>Uma operação a cada {portfolio.frequencyDays} dias</small>
        </div>
        <div>
          <span>ÍNDICE DE CONFIRMAÇÃO</span>
          <strong className={confirmationTone(confirmationRate)}>{percent(confirmationRate)}%</strong>
          <small>Confirmações positivas sobre a amostra</small>
        </div>
        <div>
          <span>QUALIDADE DOS SACADOS</span>
          <strong>{portfolio.positiveDebtors * 10}% positiva</strong>
          <small>
            {portfolio.positiveDebtors} positivos · {portfolio.attentionDebtors} atenção · {portfolio.criticalDebtors}{" "}
            críticos
          </small>
        </div>
        <div>
          <span>ÍNDICE DE RECOMPRA</span>
          <strong className={repurchaseRate > 3 ? "negative" : repurchaseRate > 1 ? "warning-text" : "positive"}>
            {percent(repurchaseRate)}%
          </strong>
          <small>
            {cedent.repurchases} recompras · {preciseMoney.format(portfolio.repurchased.amount)}
          </small>
        </div>
      </div>
      <div className="cedent-overview-columns">
        <CedentLedgerSection
          title="POSIÇÃO NA CARTEIRA"
          subtitle="Exposição anterior no ambiente"
          rows={portfolio.portfolioRows}
          totalLabel="Total em aberto"
          totalCount={portfolio.openDue.count + portfolio.openOverdue.count}
          totalAmount={cedent.portfolioReceivable}
          highlightLabel="Maior concentração por sacado"
          highlightValue={<>{percent(portfolio.metrics?.concentrationPercent ?? 0)}%</>}
        />
        <CedentLedgerSection
          title="COMPORTAMENTO HISTÓRICO"
          subtitle="Liquidações e eventos de risco"
          rows={portfolio.behaviorRows}
          totalLabel="Total de liquidações"
          totalCount={cedent.settlements}
          totalAmount={portfolio.onTime.amount + portfolio.late.amount}
          highlightLabel="Atraso médio histórico"
          highlightValue={<>{cedent.averageDelayDays} dias</>}
          highlightClassName={cedent.averageDelayDays > 7 ? "negative" : "positive"}
        />
      </div>
      <CedentHistoryList
        operations={portfolio.recentOperations}
        selected={selectedHistoricOperation}
        onToggle={item => setSelectedHistoricOperation(current => (current?.aditivo === item.aditivo ? null : item))}
      />
      <CedentTopDebtors
        debtors={portfolio.topDebtors}
        selected={selectedRankedDebtor}
        onToggle={item => setSelectedRankedDebtor(current => (current?.name === item.name ? null : item))}
      />
      <div className={`cedent-incidents-summary ${cedent.incidents ? "has-incidents" : "clear"}`}>
        <div>
          <span>APONTAMENTOS CADASTRAIS</span>
          <strong>{cedent.incidents}</strong>
        </div>
        {cedent.incidentDetails?.length ? (
          cedent.incidentDetails.map(item => (
            <p key={item}>
              <b>!</b>
              {item}
            </p>
          ))
        ) : (
          <p>
            <CheckIcon />
            Nenhum apontamento cadastral ativo.
          </p>
        )}
      </div>
    </div>
  );
}
