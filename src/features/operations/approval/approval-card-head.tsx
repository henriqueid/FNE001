"use client";
/**
 * Cabeçalho padrão dos cartões da Aprovação (rótulo, título, resumo à direita)
 * e o botão Abrir/Fechar que recolhe cada seção.
 */
import type { ReactNode } from "react";

export type SectionToggle = {
  collapsed: boolean;
  onToggle: () => void;
};

export function CollapseButton({ collapsed, label, onToggle }: SectionToggle & { label: string }) {
  return (
    <button
      type="button"
      className={`approval-collapse${collapsed ? " collapsed" : ""}`}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? "Abrir" : "Fechar"} ${label}`}
      onClick={onToggle}
    >
      <span>{collapsed ? "Abrir" : "Fechar"}</span>
      <i>⌃</i>
    </button>
  );
}

export function ApprovalCardHead({
  eyebrow,
  title,
  meta,
  toggleLabel,
  collapsed,
  onToggle,
}: SectionToggle & {
  eyebrow: string;
  title: string;
  meta: ReactNode;
  toggleLabel: string;
}) {
  return (
    <div className="approval-card-head">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="approval-head-actions">
        <small>{meta}</small>
        <CollapseButton collapsed={collapsed} label={toggleLabel} onToggle={onToggle} />
      </div>
    </div>
  );
}
