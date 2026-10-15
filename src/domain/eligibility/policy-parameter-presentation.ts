import type { EligibilityOperator, EligibilityValue, MasterRule } from "./model";

export type PolicyParameterKind =
  "boolean" | "currency" | "percentage" | "days" | "integer" | "number" | "list" | "text";

export type PolicyParameterPresentation = {
  kind: PolicyParameterKind;
  label: string;
  placeholder: string;
  help: string;
  suffix?: string;
  decimals?: number;
};

const operatorLabels: Record<EligibilityOperator, string> = {
  EQ: "deve ser igual a",
  NE: "deve ser diferente de",
  GT: "deve ser maior que",
  GTE: "deve ser maior ou igual a",
  LT: "deve ser menor que",
  LTE: "deve ser menor ou igual a",
  IN: "deve estar na lista",
  NOT_IN: "não pode estar na lista",
};

export const eligibilityOperatorLabel = (operator: EligibilityOperator) => operatorLabels[operator];

export function policyParameterPresentation(rule: MasterRule, current: EligibilityValue): PolicyParameterPresentation {
  const variable = rule.variable.toLocaleLowerCase();
  if (rule.defaultOperator === "IN" || rule.defaultOperator === "NOT_IN" || Array.isArray(current))
    return {
      kind: "list",
      label: "Lista de valores",
      placeholder: variable.includes("state") ? "Ex.: SP, RJ, MG" : "Ex.: valor 1, valor 2",
      help: "Separe cada opção com vírgula. Não use aspas.",
    };
  if (
    typeof current === "boolean" ||
    /(present|valid|active|allowed|exists|eligible|compliant|regular|defined|free|required)/.test(variable)
  )
    return { kind: "boolean", label: "Condição esperada", placeholder: "", help: "Escolha Sim ou Não." };
  if (/(percent|percentage|ratio|concentration|share|utilization|delinquency)/.test(variable))
    return {
      kind: "percentage",
      label: "Percentual limite",
      placeholder: "Ex.: 25,00",
      help: "Informe o percentual, sem dividir por 100.",
      suffix: "%",
      decimals: 2,
    };
  if (/(amount|value|exposure|balance|face|price|financial)/.test(variable))
    return {
      kind: "currency",
      label: "Valor em reais",
      placeholder: "Ex.: 100.000,00",
      help: "Informe o valor monetário em reais.",
      suffix: "R$",
      decimals: 2,
    };
  if (/(days|term|age|maturity|overdue)/.test(variable))
    return {
      kind: "days",
      label: "Quantidade de dias",
      placeholder: "Ex.: 90",
      help: "Informe um número inteiro de dias.",
      suffix: "dias",
      decimals: 0,
    };
  if (/(count|quantity|number|score)/.test(variable) || typeof current === "number")
    return {
      kind: "integer",
      label: variable.includes("score") ? "Pontos de score" : "Valor numérico",
      placeholder: variable.includes("score") ? "Ex.: 700" : "Ex.: 10",
      help: "Informe somente números.",
      decimals: 0,
    };
  return {
    kind: "text",
    label: "Texto esperado",
    placeholder: "Digite o valor esperado",
    help: "Use o mesmo texto recebido na fonte de dados indicada pela regra.",
  };
}

export function parsePolicyParameter(kind: PolicyParameterKind, raw: string): EligibilityValue {
  if (kind === "list")
    return raw
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
  if (["currency", "percentage", "days", "integer", "number"].includes(kind)) {
    const normalized = raw
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return raw;
}

export function policyParameterText(value: EligibilityValue) {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}
