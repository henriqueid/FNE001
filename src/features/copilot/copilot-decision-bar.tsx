"use client";

/** Ações finais da análise do Copiloto, isoladas para evitar dependência circular entre conversa e detalhe. */
import { type CopilotDesk } from "./use-copilot-desk";
import { ArrowIcon } from "@/src/ui/icons";
import { useState } from "react";
import type { Operation } from "@/src/domain/core/types";

export type CopilotOperationActions = {
  operation?: Operation;
  error?: string;
  onGenerate: () => void;
  onApprove: (authorityApproved?: boolean) => void;
  onOpen: () => void;
};

export function DecisionBar({
  desk,
  operationActions,
}: {
  desk: CopilotDesk;
  operationActions: CopilotOperationActions;
}) {
  const [rationale, setRationale] = useState("");
  const scenario = desk.scenarios[desk.scenarios.length - 1];
  if (!scenario) return null;
  const { result } = scenario;
  if (!operationActions.operation)
    return (
      <div className="cpl-decision">
        <span>Gere a operação para congelar este cenário, registrar a Entrada concluída e colocá-la na esteira.</span>
        {operationActions.error && <small className="cpl-decision-error">{operationActions.error}</small>}
        <button type="button" className="cpl-primary is-small" onClick={operationActions.onGenerate}>
          Gerar operação <ArrowIcon />
        </button>
      </div>
    );
  if (desk.decision === "pending")
    return (
      <div className="cpl-decision">
        <span>
          Aguardando Diretoria de crédito. A decisão vale somente para esta operação, esta política e esta janela de
          validade.
        </span>
        <label className="cpl-decision-rationale">
          <span>Justificativa obrigatória</span>
          <textarea
            rows={2}
            value={rationale}
            onChange={event => setRationale(event.target.value)}
            placeholder="Registre os fatos, a motivação e as condições da decisão"
          />
        </label>
        {desk.decisionError && <small className="cpl-decision-error">{desk.decisionError}</small>}
        <button
          type="button"
          className="cpl-primary is-small"
          onClick={() => {
            if (desk.authorityDecides(true, rationale)) operationActions.onApprove(true);
          }}
        >
          Aprovar como Diretoria
        </button>
        <button type="button" className="cpl-ghost" onClick={() => desk.authorityDecides(false, rationale)}>
          Reprovar
        </button>
        <button type="button" className="cpl-ghost" onClick={operationActions.onOpen}>
          Abrir na fila
        </button>
      </div>
    );
  if (desk.decision)
    return (
      <div className="cpl-decision" data-tone={desk.decision === "approved" ? "good" : "bad"}>
        <span>
          {desk.decision === "approved"
            ? `Aprovada e encaminhada. Etapa atual: ${operationActions.operation.nextAction}.`
            : "Reprovada pela alçada. Motivo registrado."}
        </span>
        <button type="button" className="cpl-primary is-small" onClick={operationActions.onOpen}>
          Abrir para finalizar <ArrowIcon />
        </button>
        <button type="button" className="cpl-ghost" onClick={desk.reset}>
          Nova análise
        </button>
      </div>
    );
  if (result.blockers.length)
    return (
      <div className="cpl-decision" data-tone="bad">
        <span>A operação foi gerada com impedimentos e aguarda tratamento na etapa de Risco.</span>
        <button type="button" className="cpl-primary is-small" onClick={operationActions.onOpen}>
          Abrir na fila <ArrowIcon />
        </button>
      </div>
    );
  return (
    <div className="cpl-decision">
      {result.fastTrack ? (
        <button
          type="button"
          className="cpl-primary is-small"
          onClick={() => {
            operationActions.onApprove();
            desk.approveFast();
          }}
        >
          Aprovar e encaminhar <ArrowIcon />
        </button>
      ) : (
        <button type="button" className="cpl-primary is-small" onClick={desk.sendToAuthority}>
          Enviar para alçada <ArrowIcon />
        </button>
      )}
      <button type="button" className="cpl-ghost" onClick={operationActions.onOpen}>
        Abrir na fila
      </button>
    </div>
  );
}
