"use client";

/** Gerencia contas no mesmo estado financeiro, preservando validações e persistência. */
import { useRef, useState } from "react";
import { useCompanyDestinations } from "@/src/app/company-context";
import type { FinanceState } from "@/src/domain/finance/model";
import type { Result } from "@/src/domain/finance/ledger";
import { BanksTab } from "@/src/features/finance/tabs/banks-tab";
import { Field } from "@/src/features/finance/finance-ui";

export function BankSettingsPanel({
  state,
  onState,
  initialScope,
}: {
  state: FinanceState;
  onState: (state: FinanceState) => void | Promise<void>;
  initialScope: string;
}) {
  const destinations = useCompanyDestinations();
  const [scope, setScope] = useState(initialScope);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const apply = async (result: Result) => {
    if (savingRef.current) return false;
    if (result.error) {
      setFeedback({ error: true, text: result.error });
      return false;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await onState(result.state);
      setFeedback({ error: false, text: result.message ?? "Conta bancária salva." });
      return true;
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : "Não foi possível salvar a conta." });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <section aria-label="Configurações bancárias" aria-busy={saving}>
      <Field label="Empresa ou veículo">
        <select
          value={scope}
          disabled={saving}
          onChange={event => {
            setScope(event.target.value);
            setFeedback(undefined);
          }}
        >
          <option value="Consolidado">Todas as empresas</option>
          {destinations.map(destination => (
            <option key={destination.name}>{destination.name}</option>
          ))}
        </select>
      </Field>
      {feedback && (
        <p className={feedback.error ? "fn-warning" : "fn-note"} role={feedback.error ? "alert" : "status"}>
          {feedback.text}
        </p>
      )}
      <BanksTab
        key={scope}
        state={state}
        scope={scope}
        editable
        onApply={apply}
        onEdit={() => setFeedback(undefined)}
        saving={saving}
        error={feedback?.error ? feedback.text : undefined}
      />
    </section>
  );
}
