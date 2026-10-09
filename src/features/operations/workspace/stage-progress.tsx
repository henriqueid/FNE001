"use client";
/**
 * Esteira das 6 etapas do workspace: estado de cada etapa, responsável e data
 * da conclusão, e seleção da etapa exibida.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { stageCompletionFor } from "@/src/domain/operations/stage-insight";
import { StepState } from "@/src/features/operations/components/status";

export function StageProgress({
  operation,
  active,
  onSelect,
}: {
  operation: Operation;
  active: number;
  onSelect: (stageId: number) => void;
}) {
  return (
    <section className="workspace-progress">
      {stages.map((stage, idx) => {
        const completion = stageCompletionFor(operation, stage.id);
        return (
          <button
            key={stage.id}
            className={`${stage.id === active ? "active" : ""} ${stage.id === operation.stage ? "current" : ""} ${stage.id < operation.stage ? "done" : ""}`}
            onClick={() => onSelect(stage.id)}
          >
            <StepState id={stage.id} current={operation.stage} />
            <span className="stage-progress-copy">
              <small>
                {stage.id < operation.stage
                  ? "CONCLUÍDA"
                  : stage.id === operation.stage
                    ? "ETAPA ATUAL"
                    : `ETAPA ${stage.id}`}
              </small>
              <b>{stage.short}</b>
              {completion && (
                <em>
                  <strong>{completion.completedBy}</strong>
                  <time>{completion.completedAt}</time>
                </em>
              )}
            </span>
            {idx < stages.length - 1 && <i className="connector" />}
          </button>
        );
      })}
    </section>
  );
}
