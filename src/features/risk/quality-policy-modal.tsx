"use client";
/**
 * Critérios do índice de qualidade: janela de comparação, variação mínima, tamanho dos
 * rankings, faixas de concentração e, para cada componente, peso e valores "bom" e "ruim".
 * Os números de fábrica são de demonstração; cada instituição ajusta os seus.
 */
import { type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { CloseIcon } from "@/src/ui/icons";
import { useState } from "react";

const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function QualityPolicyModal({
  policy,
  onSave,
  onReset,
  onClose,
}: {
  policy: QualityPolicy;
  onSave: (p: QualityPolicy) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QualityPolicy>(policy);
  const totalWeight = draft.components.reduce((s, c) => s + c.weight, 0);
  const setComponent = (i: number, patch: Partial<QualityPolicy["components"][number]>) =>
    setDraft(d => ({ ...d, components: d.components.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const invalid = draft.components.some(c => c.good === c.bad) || totalWeight <= 0 || draft.windowMonths < 1;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="lx-policy-modal" role="dialog" aria-modal="true" aria-labelledby="qp-title">
        <header>
          <div>
            <span className="lx-label">Política de risco</span>
            <h2 id="qp-title">Critérios do índice de qualidade</h2>
            <p>
              {draft.name} · {draft.version}. Valores de demonstração: ajuste para a política da sua instituição.
            </p>
          </div>
          <button type="button" className="lx-square" aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="lx-policy-general">
          <label>
            <span>Janela comparada (meses)</span>
            <input
              type="number"
              min={1}
              max={3}
              value={draft.windowMonths}
              onChange={e => setDraft({ ...draft, windowMonths: Math.max(1, Math.min(3, num(e.target.value))) })}
            />
          </label>
          <label>
            <span>Variação mínima (pontos)</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.minDelta}
              onChange={e => setDraft({ ...draft, minDelta: Math.max(0, num(e.target.value)) })}
            />
          </label>
          <label>
            <span>Clientes por ranking</span>
            <input
              type="number"
              min={1}
              max={50}
              value={draft.rankingSize}
              onChange={e => setDraft({ ...draft, rankingSize: Math.max(1, num(e.target.value)) })}
            />
          </label>
          <label>
            <span>Índice saudável a partir de</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.healthyIndex}
              onChange={e => setDraft({ ...draft, healthyIndex: Math.max(0, Math.min(100, num(e.target.value))) })}
            />
          </label>
          <label>
            <span>HHI moderado a partir de</span>
            <input
              type="number"
              min={0}
              value={draft.hhiModerate}
              onChange={e => setDraft({ ...draft, hhiModerate: num(e.target.value) })}
            />
          </label>
          <label>
            <span>HHI concentrado a partir de</span>
            <input
              type="number"
              min={0}
              value={draft.hhiHigh}
              onChange={e => setDraft({ ...draft, hhiHigh: num(e.target.value) })}
            />
          </label>
        </div>

        <table className="lx-policy-table">
          <thead>
            <tr>
              <th>Componente</th>
              <th>Peso</th>
              <th>Bom (nota 100%)</th>
              <th>Ruim (nota 0%)</th>
              <th>Unidade</th>
              <th>Vale para sacados</th>
            </tr>
          </thead>
          <tbody>
            {draft.components.map((c, i) => (
              <tr key={c.id}>
                <th scope="row">{c.label}</th>
                <td>
                  <input
                    type="number"
                    min={0}
                    aria-label={`Peso de ${c.label}`}
                    value={c.weight}
                    onChange={e => setComponent(i, { weight: Math.max(0, num(e.target.value)) })}
                  />
                  <small>{totalWeight ? `${((c.weight / totalWeight) * 100).toFixed(0)}%` : "—"}</small>
                </td>
                <td>
                  <input
                    type="number"
                    aria-label={`Valor bom de ${c.label}`}
                    value={c.good}
                    onChange={e => setComponent(i, { good: num(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    aria-label={`Valor ruim de ${c.label}`}
                    value={c.bad}
                    onChange={e => setComponent(i, { bad: num(e.target.value) })}
                  />
                </td>
                <td>{c.unit}</td>
                <td>{c.appliesToDebtors ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invalid && (
          <p className="lx-policy-error" role="alert">
            Cada componente precisa de valores “bom” e “ruim” diferentes, e a soma dos pesos deve ser maior que zero.
          </p>
        )}

        <footer>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            Voltar aos valores de demonstração
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={invalid}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Aplicar critérios
          </button>
        </footer>
      </section>
    </div>
  );
}
