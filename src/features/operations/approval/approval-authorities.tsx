"use client";
/**
 * Cartão de alçadas: cadeia de aprovadores com status e ações de
 * aprovar/reprovar nas pendentes, mais a observação que acompanha a decisão.
 */
import { Badge } from "@/src/features/operations/components/status";
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { type ApprovalItem } from "./approval-model";

export function ApprovalAuthorities({
  approvals,
  approvedCount,
  observation,
  onObservationChange,
  onDecide,
  collapsed,
  onToggle,
}: SectionToggle & {
  approvals: ApprovalItem[];
  approvedCount: number;
  observation: string;
  onObservationChange: (value: string) => void;
  onDecide: (id: string, decision: "Aprovado" | "Reprovado") => void;
}) {
  return (
    <section className={`approval-card${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="ALÇADAS"
        title="Decisões e responsáveis"
        meta={
          <>
            {approvedCount}/{approvals.length} aprovadas
          </>
        }
        toggleLabel="alçadas"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <>
          <div className="approval-chain">
            {approvals.map((item, index) => (
              <div className={`approval-row ${item.status.toLowerCase()}`} key={item.id}>
                <i>{index + 1}</i>
                <span>
                  <strong>{item.role}</strong>
                  <small>
                    {item.approver}
                    {item.decidedAt ? ` · ${item.decidedAt}` : ""}
                  </small>
                  {item.note && <em>{item.note}</em>}
                </span>
                <Badge
                  tone={item.status === "Aprovado" ? "ready" : item.status === "Reprovado" ? "cancelled" : "attention"}
                >
                  {item.status}
                </Badge>
                {item.status === "Pendente" && (
                  <div className="approval-row-actions">
                    <button onClick={() => onDecide(item.id, "Reprovado")}>Reprovar</button>
                    <button className="approve" onClick={() => onDecide(item.id, "Aprovado")}>
                      Aprovar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <label className="approval-observation inline">
            <span>OBSERVAÇÃO OU JUSTIFICATIVA DA DECISÃO</span>
            <textarea
              value={observation}
              placeholder="Registre condicionantes, ressalvas ou a justificativa da aprovação/reprovação."
              onChange={event => onObservationChange(event.target.value)}
            />
          </label>
        </>
      )}
    </section>
  );
}
