"use client";

import {
  type CalculationMethod,
  type ConfirmationFailureAction,
  type OperationalParameterOverrides,
  type OperationalParameters,
  resolveOperationalParameters,
  type OperationalDefaultsState,
} from "@/src/domain/registry/operational-profile";
import type { ReactNode } from "react";
import { LocalizedNumberInput } from "@/src/ui/localized-number-input";

type NumericKey = {
  [K in keyof OperationalParameters]: OperationalParameters[K] extends number ? K : never;
}[keyof OperationalParameters];

const groups: Array<{
  title: string;
  description: string;
  fields: Array<{ key: NumericKey; label: string; suffix?: string; step?: number }>;
}> = [
  {
    title: "Taxas e cálculo",
    description: "Condição econômica e intervalo permitido para a operação.",
    fields: [
      { key: "monthlyRate", label: "Taxa padrão", suffix: "% a.m.", step: 0.01 },
      { key: "minimumMonthlyRate", label: "Taxa mínima", suffix: "% a.m.", step: 0.01 },
      { key: "maximumMonthlyRate", label: "Taxa máxima", suffix: "% a.m.", step: 0.01 },
    ],
  },
  {
    title: "Prazos e títulos",
    description: "Faixas aceitas antes da análise de exceções.",
    fields: [
      { key: "minimumTermDays", label: "Prazo mínimo", suffix: "dias" },
      { key: "maximumTermDays", label: "Prazo máximo", suffix: "dias" },
      { key: "maximumAverageTermDays", label: "Prazo médio máximo", suffix: "dias" },
      { key: "minimumTitleAmount", label: "Valor mínimo por título", suffix: "R$", step: 0.01 },
      { key: "maximumTitleAmount", label: "Valor máximo por título", suffix: "R$", step: 0.01 },
      { key: "maximumOperationAmount", label: "Valor máximo por operação", suffix: "R$", step: 0.01 },
      { key: "maximumTitlesPerOperation", label: "Máximo de títulos" },
    ],
  },
  {
    title: "Lastro e confirmação",
    description: "Mínimos calculados tanto por quantidade quanto por valor financeiro.",
    fields: [
      { key: "minimumConfirmationCountPercent", label: "Mínimo confirmado por quantidade", suffix: "%" },
      { key: "minimumConfirmationAmountPercent", label: "Mínimo confirmado por valor", suffix: "%" },
      { key: "minimumConfirmedTitles", label: "Quantidade mínima confirmada" },
      { key: "samplePercent", label: "Amostra mínima", suffix: "%" },
      { key: "confirmationValidityDays", label: "Validade da confirmação", suffix: "dias" },
      { key: "firstOperationsConfirmationPercent", label: "Confirmação nas primeiras operações", suffix: "%" },
      { key: "firstOperationsCount", label: "Quantidade de primeiras operações" },
    ],
  },
  {
    title: "Concentração",
    description: "Limites de diversificação da carteira do cliente.",
    fields: [
      { key: "maximumDebtorConcentrationPercent", label: "Máximo por sacado", suffix: "%" },
      { key: "maximumTopFiveConcentrationPercent", label: "Máximo nos 5 maiores", suffix: "%" },
      { key: "maximumGroupConcentrationPercent", label: "Máximo por grupo econômico", suffix: "%" },
      { key: "maximumSectorConcentrationPercent", label: "Máximo por setor", suffix: "%" },
    ],
  },
  {
    title: "Tarifas, reserva e recompra",
    description: "Custos operacionais e condições posteriores à aquisição.",
    fields: [
      { key: "operationFee", label: "Tarifa por operação", suffix: "R$", step: 0.01 },
      { key: "titleFee", label: "Tarifa por título", suffix: "R$", step: 0.01 },
      { key: "analysisFee", label: "Tarifa de análise", suffix: "R$", step: 0.01 },
      { key: "registrationFee", label: "Tarifa de registro", suffix: "R$", step: 0.01 },
      { key: "checkingFee", label: "Tarifa de checagem", suffix: "R$", step: 0.01 },
      { key: "bankFee", label: "Tarifa bancária", suffix: "R$", step: 0.01 },
      { key: "reservePercent", label: "Fundo de reserva", suffix: "%", step: 0.01 },
      { key: "repurchaseTermDays", label: "Prazo para recompra", suffix: "dias" },
      { key: "lateFinePercent", label: "Multa de atraso", suffix: "%", step: 0.01 },
      { key: "lateInterestPercent", label: "Juros de atraso", suffix: "% a.m.", step: 0.01 },
    ],
  },
];

export function OperationalParametersEditor({
  defaults,
  overrides,
  onChange,
  allowInheritance = true,
}: {
  defaults: OperationalDefaultsState;
  overrides: OperationalParameterOverrides;
  onChange: (next: OperationalParameterOverrides) => void;
  allowInheritance?: boolean;
}) {
  const effective = resolveOperationalParameters(defaults, overrides);
  const setValue = <K extends keyof OperationalParameters>(key: K, value: OperationalParameters[K]) =>
    onChange({ ...overrides, [key]: value });
  const inherit = (key: keyof OperationalParameters) => {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="rg-parameter-groups">
      <section className="rg-parameter-group">
        <header>
          <div>
            <h3>Método operacional</h3>
            <p>Base usada na precificação e ação quando a confirmação mínima não é atingida.</p>
          </div>
        </header>
        <div className="rg-parameter-grid">
          <ParameterShell
            label="Método de cálculo"
            inherited={allowInheritance && overrides.calculationMethod === undefined}
            onInherit={() => inherit("calculationMethod")}
            allowInheritance={allowInheritance}
          >
            <select
              value={effective.calculationMethod}
              onChange={event => setValue("calculationMethod", event.target.value as CalculationMethod)}
            >
              {(["Nominal", "Efetiva", "Mista", "Composta Mista"] as CalculationMethod[]).map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </ParameterShell>
          <ParameterShell
            label="Base de dias"
            inherited={allowInheritance && overrides.dayBasis === undefined}
            onInherit={() => inherit("dayBasis")}
            allowInheritance={allowInheritance}
          >
            <select
              value={effective.dayBasis}
              onChange={event => setValue("dayBasis", Number(event.target.value) as 30 | 360 | 365)}
            >
              <option value={30}>30 dias</option>
              <option value={360}>360 dias</option>
              <option value={365}>365 dias</option>
            </select>
          </ParameterShell>
          <ParameterShell
            label="Quando não atingir a confirmação"
            inherited={allowInheritance && overrides.confirmationFailureAction === undefined}
            onInherit={() => inherit("confirmationFailureAction")}
            allowInheritance={allowInheritance}
          >
            <select
              value={effective.confirmationFailureAction}
              onChange={event => setValue("confirmationFailureAction", event.target.value as ConfirmationFailureAction)}
            >
              {(["Bloquear", "Enviar para alçada", "Solicitar nova amostra", "Alertar"] as const).map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </ParameterShell>
          <ParameterShell
            label="Usar dias úteis"
            inherited={allowInheritance && overrides.businessDays === undefined}
            onInherit={() => inherit("businessDays")}
            allowInheritance={allowInheritance}
          >
            <label className="rg-check">
              <input
                type="checkbox"
                checked={effective.businessDays}
                onChange={event => setValue("businessDays", event.target.checked)}
              />
              Calcular prazos em dias úteis
            </label>
          </ParameterShell>
          <ParameterShell
            label="Maiores títulos obrigatórios"
            inherited={allowInheritance && overrides.requireLargestTitles === undefined}
            onInherit={() => inherit("requireLargestTitles")}
            allowInheritance={allowInheritance}
          >
            <label className="rg-check">
              <input
                type="checkbox"
                checked={effective.requireLargestTitles}
                onChange={event => setValue("requireLargestTitles", event.target.checked)}
              />
              Sempre incluir os maiores títulos na amostra
            </label>
          </ParameterShell>
        </div>
      </section>

      {groups.map(group => (
        <section className="rg-parameter-group" key={group.title}>
          <header>
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
          </header>
          <div className="rg-parameter-grid">
            {group.fields.map(field => (
              <ParameterShell
                key={field.key}
                label={field.label}
                inherited={allowInheritance && overrides[field.key] === undefined}
                onInherit={() => inherit(field.key)}
                allowInheritance={allowInheritance}
                suffix={field.suffix}
              >
                <LocalizedNumberInput
                  min={0}
                  decimals={field.step && field.step < 1 ? 2 : 0}
                  value={effective[field.key]}
                  aria-label={field.label}
                  onValueChange={value => setValue(field.key, value)}
                />
              </ParameterShell>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ParameterShell({
  label,
  inherited,
  onInherit,
  allowInheritance,
  suffix,
  children,
}: {
  label: string;
  inherited: boolean;
  onInherit: () => void;
  allowInheritance: boolean;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <label className={`rg-parameter ${inherited ? "inherited" : "custom"}`}>
      <span>
        <b>{label}</b>
        {allowInheritance && (
          <button type="button" onClick={onInherit} disabled={inherited}>
            {inherited ? "Padrão geral" : "Usar padrão"}
          </button>
        )}
      </span>
      <div>
        {children}
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}
