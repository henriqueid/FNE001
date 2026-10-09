"use client";
/**
 * Trilha da decisão: etapas concluídas e eventos de auditoria da aprovação,
 * do mais recente para o mais antigo.
 */
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { type TimelineEvent } from "./approval-model";

export function ApprovalTimeline({
  events,
  collapsed,
  onToggle,
}: SectionToggle & {
  events: TimelineEvent[];
}) {
  return (
    <section className={`approval-timeline${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="TRILHA DA DECISÃO"
        title="Quem fez o quê e quando"
        meta="Mais recente primeiro"
        toggleLabel="trilha da decisão"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed &&
        (events.length ? (
          <div className="approval-timeline-list">
            {events.map((event, index) => (
              <div key={`${event.at}-${event.action}-${index}`}>
                <i>{index + 1}</i>
                <span>
                  <strong>{event.action}</strong>
                  <small>
                    {event.at} · {event.by}
                  </small>
                  <em>{event.detail}</em>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="approval-audit-empty">
            A trilha será iniciada quando a operação for enviada para as alçadas.
          </div>
        ))}
    </section>
  );
}
