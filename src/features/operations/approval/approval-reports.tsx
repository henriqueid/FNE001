"use client";
/**
 * Cartão de relatórios e impressão: atalhos para abrir a prévia de cada
 * documento da decisão e da formalização.
 */
import { ArrowIcon } from "@/src/ui/icons";
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { reportInitials, type ReportType, reportTypes } from "./approval-model";

export function ApprovalReports({
  onOpenReport,
  collapsed,
  onToggle,
}: SectionToggle & {
  onOpenReport: (report: ReportType) => void;
}) {
  return (
    <section className={`approval-card approval-report-panel${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="RELATÓRIOS E IMPRESSÃO"
        title="Documentos da decisão e da formalização"
        meta="4 documentos"
        toggleLabel="relatórios"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <div className="approval-report-options">
          {reportTypes.map(report => (
            <button key={report} onClick={() => onOpenReport(report)}>
              <span>{reportInitials(report)}</span>
              <b>{report}</b>
              <small>Abrir prévia</small>
              <ArrowIcon />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
