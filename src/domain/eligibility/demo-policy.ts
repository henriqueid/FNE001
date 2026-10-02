import { type Operation } from "@/src/domain/core/types";
import { type EligibilityPolicy } from "./model";

function policyIdentity(label: string) {
  const match = label.match(/^(.*)\s(v[\d.]+)$/i);
  return match ? { name: match[1], version: match[2] } : { name: label, version: "demo-0.1" };
}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

/**
 * Configuração provisória para demonstrar o motor com os dados atuais.
 * Os números abaixo são parâmetros da política de demonstração, não limites universais ou "de mercado".
 */
export function demoPoliciesFor(operation: Operation): EligibilityPolicy[] {
  const identity = policyIdentity(operation.policy);
  return [
    {
      id: "POL-UNIVERSAL-DEMO:v0.2",
      name: "Regras universais demonstrativas",
      version: "v0.2",
      layer: "UNIVERSAL",
      effectiveFrom: "2026-01-01",
      status: "ATIVA",
      bindings: [
        {
          ruleId: "TITLE-AMOUNT-MIN-001",
          enabled: true,
          parameter: 1000,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
        {
          ruleId: "TITLE-TERM-MAX-001",
          enabled: true,
          parameter: 120,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
        {
          ruleId: "TITLE-DUPLICATE-001",
          enabled: true,
          parameter: false,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
        {
          ruleId: "TITLE-FISCAL-EVIDENCE-001",
          enabled: true,
          parameter: true,
          failureOutcome: "ALERTA",
          action: "SINALIZAR",
          overrideAllowed: false,
        },
        {
          ruleId: "OPERATION-TITLE-SUM-MATCH-001",
          enabled: true,
          parameter: true,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
        {
          ruleId: "OPERATION-NET-AMOUNT-VALID-001",
          enabled: true,
          parameter: true,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
        {
          ruleId: "STRUCTURE-DEFINED-001",
          enabled: true,
          parameter: true,
          failureOutcome: "REPROVADO",
          action: "BLOQUEAR",
          overrideAllowed: false,
        },
      ],
    },
    {
      id: `POL-${slug(operation.vehicle)}-${slug(identity.name)}-DEMO:v${identity.version.replace(/^v/i, "")}`,
      name: identity.name,
      version: identity.version,
      layer: "PRODUTO",
      modality: operation.institution,
      company: operation.vehicle,
      product: identity.name,
      effectiveFrom: "2026-01-01",
      status: "ATIVA",
      bindings: [
        {
          ruleId: "DEBTOR-OPERATION-CONCENTRATION-MAX-001",
          enabled: true,
          parameter: 35,
          failureOutcome: "EXCECAO",
          action: "SOLICITAR_DECISAO",
          overrideAllowed: true,
          overrideAuthority: "Gerente de crédito",
        },
        {
          ruleId: "CEDENT-PROJECTED-LIMIT-USAGE-MAX-001",
          enabled: true,
          parameter: 70,
          failureOutcome: "EXCECAO",
          action: "SOLICITAR_DECISAO",
          overrideAllowed: true,
          overrideAuthority: "Comitê de crédito",
        },
        {
          ruleId: "PORTFOLIO-CEDENT-OVERDUE-MAX-001",
          enabled: true,
          parameter: 10,
          failureOutcome: "EXCECAO",
          action: "SOLICITAR_DECISAO",
          overrideAllowed: true,
          overrideAuthority: "Gerente de crédito",
        },
        ...(operation.institution === "FIDC"
          ? [
              {
                ruleId: "FIDC-FUND-CLASS-REQUIRED-001",
                enabled: true,
                parameter: true,
                failureOutcome: "REPROVADO" as const,
                action: "BLOQUEAR" as const,
                overrideAllowed: false,
              },
            ]
          : []),
      ],
    },
  ];
}
