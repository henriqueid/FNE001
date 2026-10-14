"use client";
/**
 * Lista "Pendências": itens do perfil ordenadas por severidade, com ação direta.
 */
import { type Operation } from "@/src/domain/core/types";
import type { HomeProfile } from "@/src/domain/home/settings";
import { ArrowIcon } from "@/src/ui/icons";
import { useState } from "react";
import { compact, type Severity, severityLabel } from "@/src/features/home/widgets";
import type { PortfolioFocus } from "@/src/features/portfolio/portfolio-navigation";

export type NeedItem = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  amount?: number;
  due: string;
  action: string;
  op?: Operation;
  kind: string;
  profiles: HomeProfile[];
  go?: "finance" | "portfolio";
  portfolioFocus?: PortfolioFocus;
};

export function NeedsYou({
  items,
  onOpen,
  onGoOperations,
  onGoFinance,
  onGoPortfolio,
  limit = 5,
}: {
  items: NeedItem[];
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
  onGoFinance: () => void;
  onGoPortfolio: (focus: PortfolioFocus) => void;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, limit);
  const critical = items.filter(i => i.severity === "critical").length;
  const urgent = items.filter(i => i.severity === "serious").length;
  const watch = items.length - critical - urgent;
  return (
    <>
      <div className="vg-need-summary">
        {critical > 0 && (
          <span className="critical">
            <b>{critical}</b> crítica{critical > 1 ? "s" : ""}
          </span>
        )}
        {urgent > 0 && (
          <span className="serious">
            <b>{urgent}</b> urgente{urgent > 1 ? "s" : ""}
          </span>
        )}
        {watch > 0 && (
          <span className="watch">
            <b>{watch}</b> para acompanhar
          </span>
        )}
      </div>
      <ul className="vg-need-list">
        {visible.map(item => (
          <li key={item.id} className={`sev-${item.severity}`}>
            <div className="vg-need-copy">
              <span className="vg-need-kind">
                {item.kind} · {severityLabel[item.severity]}
              </span>
              <strong>{item.title}</strong>
              <small>
                {item.detail}
                {item.due ? ` · ${item.due}` : ""}
              </small>
            </div>
            <div className="vg-need-meta">
              {item.amount !== undefined && <b>{compact(item.amount)}</b>}
              <button
                className={item.severity === "critical" ? "vg-btn primary" : "vg-btn"}
                onClick={() =>
                  item.go === "portfolio" && item.portfolioFocus
                    ? onGoPortfolio(item.portfolioFocus)
                    : item.op
                      ? onOpen(item.op)
                      : item.go === "finance"
                        ? onGoFinance()
                        : onGoOperations()
                }
              >
                {item.action}
                <ArrowIcon />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="vg-need-empty">Nenhuma pendência para este perfil.</li>}
      </ul>
      {items.length > limit && (
        <button className="vg-link vg-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Mostrar menos" : `Ver todas as ${items.length} pendências`}
        </button>
      )}
    </>
  );
}
