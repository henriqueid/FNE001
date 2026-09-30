/**
 * Ação "Concluir etapa e avançar": valida as pendências da etapa atual
 * (regras em `workspace-model.ts`) e registra a conclusão quando possível.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { type AutomationBreakdown } from "@/src/domain/operations/automation";
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
  commit: (next: Operation) => void;
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
      commit(next);
      onActiveChange(next.stage);
      onFeedback({
        tone: "success",
        message: `Etapa concluída. A operação avançou para ${stages[next.stage - 1].title}.`,
      });
    } else onFeedback({ tone: "success", message: "Liberação autorizada e registrada na linha do tempo da operação." });
  };
}
