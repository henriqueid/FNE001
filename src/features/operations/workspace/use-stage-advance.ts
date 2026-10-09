/**
 * Ação "Concluir etapa e avançar": valida as pendências da etapa atual
 * (regras em `workspace-model.ts`) e registra a conclusão quando possível.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { type AutomationBreakdown } from "@/src/domain/operations/automation";
import { type AutoAdvanceResult, autoAdvanceMessage } from "@/src/domain/operations/auto-advance";
import { stageAdvanceBlocker, type WorkspaceFeedback, withCurrentStageCompleted } from "./workspace-model";

export function useStageAdvance({
  operation,
  automation,
  commit,
  onActiveChange,
  onFeedback,
  onRequireCedent,
}: {
  operation: Operation;
  automation: AutomationBreakdown;
  commit: (next: Operation) => AutoAdvanceResult | void;
  onActiveChange: (stageId: number) => void;
  onFeedback: (feedback: WorkspaceFeedback) => void;
  onRequireCedent: () => void;
}) {
  return function advance() {
    const blocker = stageAdvanceBlocker(operation, automation);
    if (blocker) {
      if (blocker.requireCedent) onRequireCedent();
      onFeedback(blocker.feedback);
      return;
    }
    if (operation.stage < 6) {
      const next = withCurrentStageCompleted(operation);
      const result = commit(next);
      const final = result?.operation ?? next;
      onActiveChange(final.stage);
      onFeedback({
        tone: "success",
        message: result?.steps.length
          ? autoAdvanceMessage(result)
          : `Etapa concluída. A operação avançou para ${stages[final.stage - 1].title}.${result?.stoppedAt ? ` ${autoAdvanceMessage(result)}` : ""}`,
      });
    } else onFeedback({ tone: "success", message: "Liberação autorizada e registrada na linha do tempo da operação." });
  };
}
