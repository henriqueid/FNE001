/**
 * Contratos do Motor Universal de Elegibilidade.
 * O catálogo descreve o que avaliar; a política versionada fornece os parâmetros.
 */
import { type InstitutionType } from "@/src/domain/core/types";

export type EligibilityLevel = "TITULO" | "SACADO" | "CEDENTE" | "OPERACAO" | "CARTEIRA" | "ESTRUTURA";
export type EligibilityOutcome = "APROVADO" | "ALERTA" | "EXCECAO" | "REPROVADO" | "NAO_AVALIADO";
export type EligibilityOperator = "EQ" | "NE" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "NOT_IN";
export type EligibilityAction = "CONTINUAR" | "SINALIZAR" | "SOLICITAR_DECISAO" | "BLOQUEAR";
export type PolicyLayer = "UNIVERSAL" | "MODALIDADE" | "INSTITUICAO" | "PRODUTO" | "CARTEIRA";
export type EligibilityValue = string | number | boolean | null | string[] | number[];

export type MasterRule = {
  id: string;
  name: string;
  description: string;
  category: string;
  modalities: InstitutionType[] | ["TODAS"];
  level: EligibilityLevel;
  variable: string;
  dataSource: string;
  defaultOperator: EligibilityOperator;
  technicalMessage: string;
  friendlyMessage: string;
  readiness?: "DISPONIVEL" | "REQUER_DADO" | "REQUER_INTEGRACAO";
  requiredData?: string;
};

export type PolicyRuleBinding = {
  ruleId: string;
  enabled: boolean;
  operator?: EligibilityOperator;
  parameter: EligibilityValue;
  failureOutcome: Exclude<EligibilityOutcome, "APROVADO" | "NAO_AVALIADO">;
  action: EligibilityAction;
  overrideAllowed: boolean;
  overrideAuthority?: string;
};

export type EligibilityPolicy = {
  id: string;
  name: string;
  version: string;
  layer: PolicyLayer;
  modality?: InstitutionType;
  company?: string;
  product?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "RASCUNHO" | "ATIVA" | "ENCERRADA";
  bindings: PolicyRuleBinding[];
};

export type EligibilitySubject = {
  id: string;
  level: EligibilityLevel;
  label: string;
  facts: Record<string, EligibilityValue>;
  evidence: Record<string, string>;
};

export type ResolvedRule = {
  rule: MasterRule;
  binding: PolicyRuleBinding;
  policy: EligibilityPolicy;
};

export type EligibilityEvaluation = {
  id: string;
  ruleId: string;
  ruleName: string;
  variable: string;
  subjectId: string;
  subjectLabel: string;
  level: EligibilityLevel;
  outcome: EligibilityOutcome;
  action: EligibilityAction;
  observed: EligibilityValue;
  parameter: EligibilityValue;
  operator: EligibilityOperator;
  policyName: string;
  policyVersion: string;
  overrideAllowed: boolean;
  overrideAuthority?: string;
  technicalMessage: string;
  explanation: string;
  evidence: string;
};

export type EligibilityRun = {
  id: string;
  evaluatedAt: string;
  overallOutcome: EligibilityOutcome;
  policyVersions: { id: string; name: string; version: string }[];
  evaluations: EligibilityEvaluation[];
  counts: Record<EligibilityOutcome, number>;
};

export type EligibilityOverrideDecision = "APROVAR_EXCECAO" | "REJEITAR_EXCECAO";

export type EligibilityOverride = {
  id: string;
  evaluationId: string;
  ruleId: string;
  subjectId: string;
  originalOutcome: EligibilityOutcome;
  observed: EligibilityValue;
  parameter: EligibilityValue;
  decision: EligibilityOverrideDecision;
  justification: string;
  authority: string;
  decidedBy: string;
  decidedAt: string;
  evidence: string;
};

export type EligibilityReview = {
  run: EligibilityRun;
  overrides: EligibilityOverride[];
};
