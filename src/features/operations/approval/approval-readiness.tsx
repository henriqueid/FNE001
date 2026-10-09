"use client";
/**
 * Cartão de prontidão: lista os requisitos das etapas anteriores (risco,
 * lastro, condição comercial, bloqueios) e se cada um já foi concluído.
 */
import { AlertIcon, CheckIcon } from "@/src/ui/icons";
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { type ReadinessItem } from "./approval-model";

export function ApprovalReadiness({
  checklist,
  collapsed,
  onToggle,
}: SectionToggle & {
  checklist: ReadinessItem[];
}) {
  return (
    <section className={`approval-card${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="PRONTIDÃO"
        title="Requisitos anteriores"
        meta={
          <>
            {checklist.filter(item => item.ok).length}/{checklist.length} concluídos
          </>
        }
        toggleLabel="prontidão"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <div className="approval-readiness-list">
          {checklist.map(item => (
            <div className={item.ok ? "ready" : "pending"} key={item.label}>
              {item.ok ? <CheckIcon /> : <AlertIcon />}
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <b>{item.ok ? "Concluído" : "Pendente"}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
