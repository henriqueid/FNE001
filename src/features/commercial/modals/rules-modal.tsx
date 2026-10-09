"use client";

/**
 * Regras de comissão: base, faixas por atingimento, bônus de conta nova e estorno de recompra.
 */
import { type CResult, type CommercialState } from "@/src/domain/commercial/types";
import { inputMoney, num } from "@/src/features/commercial/commercial-ui";
import { Field, Modal } from "@/src/features/finance/finance-ui";
import { useState } from "react";

export function RulesModal({
  state,
  onClose,
  onApply,
}: {
  state: CommercialState;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [rules, setRules] = useState(state.rules);
  const setTier = (i: number, k: "from" | "rate", v: string) =>
    setRules({ ...rules, tiers: rules.tiers.map((t, j) => (j === i ? { ...t, [k]: num(v) } : t)) });
  return (
    <Modal
      wide
      title="Regras de comissão"
      subtitle="Valem para as competências ainda abertas. As já fechadas guardam a regra da época."
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => {
              const tiers = [...rules.tiers].filter(t => t.rate > 0 || t.from === 0).sort((a, b) => a.from - b.from);
              if (!tiers.length || tiers[0].from !== 0) {
                onApply({ state, error: "A primeira faixa precisa começar em 0% da meta." });
                return;
              }
              if (
                onApply({ state: { ...state, rules: { ...rules, tiers } }, message: "Regras de comissão atualizadas." })
              )
                onClose();
            }}
          >
            Salvar regras
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Base de cálculo">
          <select value={rules.base} onChange={e => setRules({ ...rules, base: e.target.value as typeof rules.base })}>
            <option value="receita">Receita (deságio + tarifas)</option>
            <option value="volume">Volume operado (valor de face)</option>
          </select>
        </Field>
        <Field label="Bônus por conta nova ativada (R$)">
          <input
            inputMode="decimal"
            value={inputMoney(rules.newAccountBonus)}
            onChange={e => setRules({ ...rules, newAccountBonus: num(e.target.value) })}
          />
        </Field>
        <Field label="Janela para ativar a conta nova (dias)" hint="Da data do vínculo até a 1ª operação">
          <input
            inputMode="numeric"
            value={rules.newAccountWindow}
            onChange={e => setRules({ ...rules, newAccountWindow: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </Field>
        <Field label="Recompras">
          <select
            value={rules.clawback ? "sim" : "nao"}
            onChange={e => setRules({ ...rules, clawback: e.target.value === "sim" })}
          >
            <option value="sim">Estornar a comissão da parte recomprada</option>
            <option value="nao">Não estornar</option>
          </select>
        </Field>
      </div>
      <h4 className="cm-subtitle">Faixas por atingimento da meta de receita</h4>
      <table className="fn-table cm-tiers">
        <thead>
          <tr>
            <th>A partir de (% da meta)</th>
            <th>Comissão (% da base)</th>
          </tr>
        </thead>
        <tbody>
          {rules.tiers.map((t, i) => (
            <tr key={i}>
              <td>
                <input
                  inputMode="decimal"
                  value={String(t.from)}
                  disabled={i === 0}
                  onChange={e => setTier(i, "from", e.target.value)}
                />
              </td>
              <td>
                <input
                  inputMode="decimal"
                  value={String(t.rate).replace(".", ",")}
                  onChange={e => setTier(i, "rate", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="fn-btn link"
        onClick={() =>
          setRules({
            ...rules,
            tiers: [
              ...rules.tiers,
              { from: (rules.tiers.at(-1)?.from ?? 0) + 20, rate: (rules.tiers.at(-1)?.rate ?? 0) + 1 },
            ],
          })
        }
      >
        + Faixa
      </button>
      <p className="fn-note">
        A faixa atingida vale para toda a base do mês (não é progressiva). Comerciais com % fixo, como agentes, não usam
        as faixas.
      </p>
    </Modal>
  );
}
