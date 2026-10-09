import { type InstitutionType } from "@/src/domain/core/types";
import { type EligibilityLevel } from "./model";

export type EligibilityProfile = {
  modality: InstitutionType;
  description: string;
  levels: EligibilityLevel[];
  structuralVariables: string[];
  futurePolicySources: string[];
};

const universalLevels: EligibilityLevel[] = ["TITULO", "SACADO", "CEDENTE", "OPERACAO", "CARTEIRA", "ESTRUTURA"];

/** Perfis ativam conjuntos de regras sobre o mesmo motor; não são motores separados. */
export const eligibilityProfiles: Record<InstitutionType, EligibilityProfile> = {
  Factoring: {
    modality: "Factoring",
    description: "Aquisição de recebíveis conforme política da empresa e condições contratuais aplicáveis.",
    levels: universalLevels,
    structuralVariables: ["regress", "coobligation", "repurchaseTerms"],
    futurePolicySources: ["Política comercial", "Contrato de fomento", "Política de crédito"],
  },
  FIDC: {
    modality: "FIDC",
    description: "Elegibilidade e enquadramento conforme regulamento, suplemento, política e classe do fundo.",
    levels: universalLevels,
    structuralVariables: ["fundClass", "participants", "revolving", "coobligation"],
    futurePolicySources: ["Regulamento", "Suplemento da classe", "Política de investimento", "Contrato de cessão"],
  },
  Securitizadora: {
    modality: "Securitizadora",
    description: "Elegibilidade conforme produto, cessão, emissão e estrutura de funding aplicável.",
    levels: universalLevels,
    structuralVariables: ["vehicle", "fundingStructure", "guarantees", "assignmentRegistration"],
    futurePolicySources: ["Política de crédito", "Termo da emissão", "Contrato de cessão", "Estrutura de funding"],
  },
};
