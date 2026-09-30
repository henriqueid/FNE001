"use client";

/**
 * Trava de saneamento: operação antiga sem cedente precisa ser vinculada antes de seguir.
 */
import { useCedents } from "@/src/app/registry-context";
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent, type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { ShieldIcon, UsersIcon } from "@/src/ui/icons";
import { useState } from "react";

export function AssignCedentModal({
  operation,
  onBack,
  onAssign,
}: {
  operation: Operation;
  onBack: () => void;
  onAssign: (cedent: Cedent) => void;
}) {
  const registryCedents = useCedents();
  const [cedentId, setCedentId] = useState("");
  const cedent = registryCedents.find(item => item.id === cedentId);
  return (
    <div className="modal-backdrop mandatory-backdrop">
      <section className="assign-cedent-modal" role="dialog" aria-modal="true" aria-label="Definir cedente obrigatório">
        <div className="mandatory-icon">
          <UsersIcon />
        </div>
        <Badge tone="attention">VÍNCULO OBRIGATÓRIO</Badge>
        <h2>Defina o cedente para continuar</h2>
        <p>
          O aditivo {operation.aditivoNumber} foi criado sem cedente. A operação não poderá avançar até que o
          responsável pelos recebíveis esteja identificado.
        </p>
        <label className="modal-field">
          <span>CEDENTE DA OPERAÇÃO</span>
          <select
            aria-label="Selecionar cedente obrigatório"
            value={cedentId}
            onChange={event => setCedentId(event.target.value)}
          >
            <option value="">Selecione o cedente</option>
            {registryCedents.map(item => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.document}
              </option>
            ))}
          </select>
        </label>
        {cedent && (
          <div className="assignment-preview">
            <div>
              <span>SCORE</span>
              <strong>{cedent.score}</strong>
              <small>
                {cedent.score >= 700 ? "Faixa positiva" : cedent.score >= 600 ? "Faixa de atenção" : "Faixa crítica"}
              </small>
            </div>
            <div>
              <span>LIMITE DISPONÍVEL</span>
              <strong>{preciseMoney.format(Math.max(0, cedent.creditLimit - cedent.usedLimit))}</strong>
              <small>{preciseMoney.format(cedent.usedLimit)} utilizado</small>
            </div>
            <div>
              <span>APONTAMENTOS</span>
              <strong className={cedent.incidents ? "negative" : "positive"}>{cedent.incidents}</strong>
              <small>{cedent.publicStatus}</small>
            </div>
          </div>
        )}
        <div className="assignment-note">
          <ShieldIcon />
          <span>
            Ao confirmar, score, limite e histórico do cedente passam a compor a análise de risco desta operação.
          </span>
        </div>
        <div className="modal-actions">
          <button className="secondary-action" onClick={onBack}>
            Voltar para operações
          </button>
          <button className="primary-action" disabled={!cedent} onClick={() => cedent && onAssign(cedent)}>
            Vincular cedente e continuar
          </button>
        </div>
      </section>
    </div>
  );
}
