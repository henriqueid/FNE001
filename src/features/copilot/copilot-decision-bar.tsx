"use client";

/** Ações finais da análise do Copiloto, isoladas para evitar dependência circular entre conversa e detalhe. */
import { type CopilotDesk } from "./use-copilot-desk";
import { ArrowIcon } from "@/src/ui/icons";
import { useState } from "react";

export function DecisionBar({ desk }: { desk: CopilotDesk }) {
  const [rationale, setRationale] = useState("");
  const scenario = desk.scenarios[desk.scenarios.length - 1];
  if (!scenario) return null;
  const { result } = scenario;
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
        <button type="button" className="cpl-primary is-small" onClick={() => desk.authorityDecides(true, rationale)}>
          Aprovar como Diretoria
        </button>
        <button type="button" className="cpl-ghost" onClick={() => desk.authorityDecides(false, rationale)}>
          Reprovar
        </button>
      </div>
    );
  if (desk.decision)
    return (
      <div className="cpl-decision" data-tone={desk.decision === "approved" ? "good" : "bad"}>
        <span>
          {desk.decision === "approved"
            ? "Aprovada e na fila de formalização manual."
            : "Reprovada pela alçada. Motivo registrado."}
        </span>
        <button type="button" className="cpl-ghost" onClick={desk.reset}>
          Nova análise
        </button>
      </div>
    );
  if (result.blockers.length) return null;
  return (
    <div className="cpl-decision">
      {result.fastTrack ? (
        <button type="button" className="cpl-primary is-small" onClick={desk.approveFast}>
          Aprovar operação <ArrowIcon />
        </button>
      ) : (
        <button type="button" className="cpl-primary is-small" onClick={desk.sendToAuthority}>
          Enviar para alçada <ArrowIcon />
        </button>
      )}
    </div>
  );
}
