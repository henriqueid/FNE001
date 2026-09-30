"use client";
/**
 * Resumo financeiro lateral do workspace (e o botão que o abre no mobile):
 * líquido, limite, spread, composição, observação, automação, veículo e ritmo.
 * O estado de exibição fica no workspace para sobreviver à troca de etapa.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent, type Operation } from "@/src/domain/core/types";
import { type AutomationBreakdown } from "@/src/domain/operations/automation";
import { paceFor } from "@/src/domain/operations/pace";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, ArrowIcon, CheckIcon, ClockIcon } from "@/src/ui/icons";
import { type SummaryDensity, summaryFinancialsFor } from "./workspace-model";

export function OperationSummaryAside({
  operation,
  cedents,
  automation,
  open,
  onToggleOpen,
  density,
  onDensityChange,
  pinned,
  onTogglePinned,
  observation,
  onObservationChange,
  onObservationCommit,
}: {
  operation: Operation;
  cedents: Cedent[];
  automation: AutomationBreakdown;
  open: boolean;
  onToggleOpen: () => void;
  density: SummaryDensity;
  onDensityChange: (density: SummaryDensity) => void;
  pinned: boolean;
  onTogglePinned: () => void;
  observation: string;
  onObservationChange: (value: string) => void;
  onObservationCommit: () => void;
}) {
  const pace = paceFor(operation);
  const { pricing, calculation, offsets, face, net, availableLimit, limitAfterOperation, approvals, approvedCount } =
    summaryFinancialsFor(operation, cedents);
  return (
    <>
      <button className="summary-mobile-toggle" onClick={onToggleOpen}>
        <span>Resumo da operação</span>
        <strong>{open ? "Recolher" : "Abrir resumo"}</strong>
      </button>
      <aside className={`operation-summary ${open ? "open" : ""} ${density} ${pinned ? "pinned" : ""}`}>
        <div className="summary-title">
          <span>RESUMO FINANCEIRO</span>
          <div className="summary-display-actions">
            <button
              aria-label={pinned ? "Desafixar resumo" : "Fixar resumo"}
              title={pinned ? "Desafixar painel" : "Fixar painel"}
              onClick={onTogglePinned}
            >
              {pinned ? "Fixado" : "Fixar"}
            </button>
            <button
              aria-label="Resumo compacto"
              title="Diminuir painel"
              className={density === "compact" ? "active" : ""}
              onClick={() => onDensityChange("compact")}
            >
              −
            </button>
            <button
              aria-label="Resumo detalhado"
              title="Aumentar painel"
              className={density === "expanded" ? "active" : ""}
              onClick={() => onDensityChange("expanded")}
            >
              +
            </button>
          </div>
        </div>
        <div className="summary-identifiers">
          <div>
            <span>ADITIVO</span>
            <strong>{operation.aditivoNumber}</strong>
          </div>
          <div>
            <span>BORDERÔ</span>
            <strong>{operation.borderoNumber}</strong>
          </div>
        </div>
        <div className="summary-financial-hero">
          <span>LÍQUIDO DO BORDERÔ</span>
          <strong>{preciseMoney.format(net)}</strong>
          <small>
            Face {preciseMoney.format(face)} · {operation.titleCount} recebíveis
          </small>
          <div>
            <b>
              {pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.<small>taxa base</small>
            </b>
            <b>
              {calculation.allInMonthly.toFixed(2).replace(".", ",")}% a.m.
              <small>taxa final calculada</small>
            </b>
          </div>
        </div>
        <div className="summary-analytics">
          <div>
            <span>LIMITE DISPONÍVEL</span>
            <strong>{preciseMoney.format(availableLimit)}</strong>
            <small>Após operação: {preciseMoney.format(limitAfterOperation)}</small>
          </div>
          <div>
            <span>SPREAD</span>
            <strong className={calculation.spread >= 0 ? "positive" : "negative"}>
              {calculation.spread.toFixed(2).replace(".", ",")}%
            </strong>
            <small>Custo {pricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.</small>
          </div>
          <div>
            <span>PRAZO MÉDIO</span>
            <strong>{Math.round(calculation.weightedTerm)} dias</strong>
            <small>Float {pricing.floatDays} dia(s)</small>
          </div>
          <div>
            <span>ALÇADAS</span>
            <strong>
              {approvedCount}/{approvals.length || 2}
            </strong>
            <small>
              {approvals.length ? `${approvals.length - approvedCount} pendente(s)` : "Aguardando configuração"}
            </small>
          </div>
        </div>
        <details className="summary-breakdown" open>
          <summary>
            COMPOSIÇÃO DO LÍQUIDO <b>{preciseMoney.format(net)}</b>
          </summary>
          <div>
            <span>Valor de face</span>
            <strong>{preciseMoney.format(face)}</strong>
          </div>
          <div>
            <span>(−) Deságio</span>
            <strong>{preciseMoney.format(calculation.originalDiscount)}</strong>
          </div>
          <div>
            <span>(−) Tarifas</span>
            <strong>{preciseMoney.format(calculation.fees)}</strong>
          </div>
          <div>
            <span>(−) IOF / impostos</span>
            <strong>{preciseMoney.format(calculation.iof)}</strong>
          </div>
          <div>
            <span>(−) Garantia / retenções</span>
            <strong>{preciseMoney.format(calculation.guarantee + pricing.manualRetention)}</strong>
          </div>
          <div>
            <span>(−) Recompra e compensações</span>
            <strong>{preciseMoney.format(offsets)}</strong>
          </div>
          <div className="total">
            <span>Total líquido</span>
            <strong>{preciseMoney.format(net)}</strong>
          </div>
        </details>
        <details className="summary-breakdown expanded-only">
          <summary>
            ESTATÍSTICAS E CONDIÇÃO <b>{pricing.method}</b>
          </summary>
          <div>
            <span>Taxa final desejada</span>
            <strong>
              {(pricing.targetFinalRateMonthly ?? calculation.allInMonthly).toFixed(2).replace(".", ",")}% a.m.
            </strong>
          </div>
          <div>
            <span>Taxa final calculada</span>
            <strong>{calculation.allInMonthly.toFixed(2).replace(".", ",")}% a.m.</strong>
          </div>
          <div>
            <span>Taxa VA ajustada</span>
            <strong>{calculation.adjustedRate.toFixed(4).replace(".", ",")}% a.m.</strong>
          </div>
          <div>
            <span>Prazo mínimo</span>
            <strong>{pricing.minimumTermDays} dias</strong>
          </div>
          <div>
            <span>Regresso</span>
            <strong>{pricing.regress}</strong>
          </div>
          <div>
            <span>Coobrigação</span>
            <strong>{pricing.coobligation ? "Sim" : "Não"}</strong>
          </div>
        </details>
        <div className="summary-note">
          <label>
            <span>OBSERVAÇÃO DA OPERAÇÃO</span>
            <textarea
              value={observation}
              onChange={event => onObservationChange(event.target.value)}
              onBlur={onObservationCommit}
              placeholder="Registre uma orientação, ressalva ou informação para as alçadas..."
            />
          </label>
          <small>Visível para crédito, aprovação e financeiro.</small>
        </div>
        <div className="automation-explainer expanded-only">
          <div>
            <span>AUTOMAÇÃO ASSISTIDA</span>
            <strong>{automation.score}%</strong>
          </div>
          <p>É o quanto o sistema conseguiu preencher ou validar sem decisão humana. Não é o progresso da operação.</p>
          {automation.items.map(item => (
            <div className="automation-line" key={item.label}>
              <span>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </span>
              <strong>
                {item.points}/{item.maximum}
              </strong>
            </div>
          ))}
        </div>
        {operation.source && (
          <div className="summary-section">
            <span>ORIGEM E TIPO</span>
            <Badge tone="current">{operation.source}</Badge>
            <strong>{operation.operationType}</strong>
            <small>Classificação definida na entrada da operação</small>
          </div>
        )}
        {operation.cancellation && (
          <div className="summary-section cancellation-memory">
            <span>MEMÓRIA DO CANCELAMENTO</span>
            <Badge tone="cancelled">{operation.cancellation.category}</Badge>
            <strong>{operation.cancellation.reason}</strong>
            <small>Assinatura preservada: {operation.cancellation.operationSignature}</small>
          </div>
        )}
        <div className="summary-section">
          <span>VEÍCULO</span>
          <Badge tone={operation.institution.toLowerCase()}>{operation.institution}</Badge>
          <strong>{operation.vehicle}</strong>
          {operation.fundClass && <small>{operation.fundClass}</small>}
          <button>
            Ver estrutura do veículo <ArrowIcon />
          </button>
        </div>
        {operation.participants && (
          <div className="summary-section expanded-only">
            <span>PARTICIPANTES</span>
            {operation.participants.map((p, i) => (
              <div className="participant" key={p}>
                <i>{["GE", "AF", "CU"][i]}</i>
                <b>{p}</b>
                <CheckIcon />
              </div>
            ))}
          </div>
        )}
        <div className="summary-section">
          <span>PRÓXIMA AÇÃO</span>
          <div className="next-action">
            <AlertIcon />
            <div>
              <strong>{operation.nextAction}</strong>
              <small>Responsável: {operation.owner}</small>
            </div>
          </div>
        </div>
        <div className="summary-section">
          <span>RITMO DA OPERAÇÃO</span>
          <div className={`pace-summary ${pace.tone}`}>
            <ClockIcon />
            <div>
              <strong>{pace.label}</strong>
              <small>
                {operation.waitingFor} nesta operação · {pace.detail}
              </small>
            </div>
          </div>
        </div>
        <div className="summary-section timeline-mini expanded-only">
          <span>ATIVIDADE RECENTE</span>
          <div>
            <i />
            <p>
              <strong>Política reavaliada</strong>
              <small>Agora · pelo motor de regras</small>
            </p>
          </div>
          <div>
            <i />
            <p>
              <strong>Dados do sacado atualizados</strong>
              <small>Há 3 min · Serasa API</small>
            </p>
          </div>
          <button>
            Ver linha do tempo completa <ArrowIcon />
          </button>
        </div>
      </aside>
    </>
  );
}
