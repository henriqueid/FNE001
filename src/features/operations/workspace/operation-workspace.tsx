"use client";
/**
 * Workspace de uma operação: mantém o estado local (etapa ativa, feedback,
 * modais, resumo) e compõe cabeçalho, esteira, conteúdo da etapa e resumo lateral.
 */
import { RegistryContext, useCedents } from "@/src/app/registry-context";
import { type Cedent, type Debtor, type ManualEntryData, type Operation } from "@/src/domain/core/types";
import { operationNeedsCedent } from "@/src/domain/operations/queries";
import { stageInsightFor } from "@/src/domain/operations/stage-insight";
import { ReleasedOperationSummary } from "@/src/features/operations/release/released-summary";
import { useContext, useState } from "react";
import { AssignCedentModal } from "./assign-cedent-modal";
import { CancellationModal } from "./cancellation-modal";
import { OperationSummaryAside } from "./operation-summary-aside";
import { StageContent } from "./stage-content";
import { StageProgress } from "./stage-progress";
import { useStageAdvance } from "./use-stage-advance";
import { WorkspaceHeader, WorkspaceNotices } from "./workspace-header";
import {
  automationFor,
  isStageLocked,
  type SummaryDensity,
  type WorkspaceFeedback,
  type WorkspaceView,
  withCancellation,
  withCedent,
  withManualEntry,
} from "./workspace-model";

export function OperationWorkspace({
  operation: initialOperation,
  debtors,
  onRegisterDebtor,
  onBack,
  onUpdate,
  showGuidance,
}: {
  operation: Operation;
  debtors: Debtor[];
  onRegisterDebtor: (debtor: Debtor) => void;
  onBack: () => void;
  onUpdate: (operation: Operation) => void;
  showGuidance: boolean;
}) {
  const registryCedents = useCedents();
  const workspaceRegistry = useContext(RegistryContext);
  const [operation, setOperation] = useState(initialOperation);
  const [active, setActive] = useState(initialOperation.stage);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(
    initialOperation.status === "Liberada ao financeiro" ? "summary" : "stages",
  );
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(null);
  const [showCancellation, setShowCancellation] = useState(false);
  const [showCedentAssignment, setShowCedentAssignment] = useState(operationNeedsCedent(initialOperation));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDensity, setSummaryDensity] = useState<SummaryDensity>("expanded");
  const [summaryPinned, setSummaryPinned] = useState(true);
  const [financialObservation, setFinancialObservation] = useState(initialOperation.financialObservation ?? "");
  const automation = automationFor(operation);
  const stageInsight = stageInsightFor(operation, active, automation);

  function commit(next: Operation) {
    setOperation(next);
    onUpdate(next);
  }

  const advance = useStageAdvance({
    operation,
    automation,
    commit,
    onActiveChange: setActive,
    onFeedback: setFeedback,
    onRequireCedent: () => setShowCedentAssignment(true),
  });

  function cancelOperation(category: string, reason: string) {
    commit(withCancellation(operation, category, reason));
    setShowCancellation(false);
    setFeedback({
      tone: "warning",
      message: "A operação foi cancelada sem excluir seu histórico. Uma nova importação poderá consultar esta memória.",
    });
  }

  function saveManualEntry(data: ManualEntryData) {
    commit(withManualEntry(operation, data));
    setFeedback({
      tone: "success",
      message: `${data.entries.length} títulos digitados. A operação foi travada como ${data.receivableType.toLowerCase()} para evitar mistura com outros recebíveis.`,
    });
  }

  function assignCedent(cedent: Cedent) {
    commit(withCedent(operation, cedent));
    setShowCedentAssignment(false);
    setFeedback({
      tone: "success",
      message: `${cedent.name} foi vinculado à operação. Limite, score e histórico já estão disponíveis para análise.`,
    });
  }

  const stageLocked = isStageLocked(operation, active);
  const commercialRep =
    workspaceRegistry?.commercial.reps.find(rep => rep.id === operation.commercialRepId) ??
    workspaceRegistry?.repOf(operation.document);
  return (
    <>
      <div className="workspace-wrap">
        <WorkspaceHeader
          operation={operation}
          commercialRepName={commercialRep?.name}
          onBack={onBack}
          onCancel={() => setShowCancellation(true)}
          onAdvance={advance}
        />
        <WorkspaceNotices
          operation={operation}
          feedback={feedback}
          onDismissFeedback={() => setFeedback(null)}
          workspaceView={workspaceView}
          onWorkspaceViewChange={setWorkspaceView}
        />
        {operation.status === "Liberada ao financeiro" && workspaceView === "summary" ? (
          <ReleasedOperationSummary
            operation={operation}
            onViewStages={() => {
              setWorkspaceView("stages");
              setActive(6);
            }}
          />
        ) : (
          <>
            <StageProgress operation={operation} active={active} onSelect={setActive} />
            <div className={`workspace-grid ${active === 5 ? "approval-focus" : ""}`}>
              <StageContent
                operation={operation}
                active={active}
                stageInsight={stageInsight}
                stageLocked={stageLocked}
                debtors={debtors}
                onRegisterDebtor={onRegisterDebtor}
                onSaveManualEntry={saveManualEntry}
                onChange={commit}
                showGuidance={showGuidance}
                onGoToCurrentStage={() => setActive(operation.stage)}
              />
              {active !== 5 && (
                <OperationSummaryAside
                  operation={operation}
                  cedents={registryCedents}
                  automation={automation}
                  open={summaryOpen}
                  onToggleOpen={() => setSummaryOpen(value => !value)}
                  density={summaryDensity}
                  onDensityChange={setSummaryDensity}
                  pinned={summaryPinned}
                  onTogglePinned={() => setSummaryPinned(value => !value)}
                  observation={financialObservation}
                  onObservationChange={setFinancialObservation}
                  onObservationCommit={() => commit({ ...operation, financialObservation })}
                />
              )}
            </div>
          </>
        )}
      </div>
      {showCancellation && (
        <CancellationModal
          operation={operation}
          onClose={() => setShowCancellation(false)}
          onConfirm={cancelOperation}
        />
      )}
      {showCedentAssignment && <AssignCedentModal operation={operation} onBack={onBack} onAssign={assignCedent} />}
    </>
  );
}
