import type { Destination, InstitutionType } from "@/src/domain/core/types";
import { isValidCnpj, onlyDigits } from "@/src/domain/registry/parties";

export type CompanyDestination = Destination & {
  id: string;
  legalName: string;
  tradeName: string;
  document: string;
  status: "ACTIVE" | "INACTIVE";
};

export type CompanyDestinationDraft = {
  legalName: string;
  tradeName: string;
  document: string;
  institution: InstitutionType;
  detail: string;
};

export const emptyCompanyDestination = (): CompanyDestinationDraft => ({
  legalName: "",
  tradeName: "",
  document: "",
  institution: "Factoring",
  detail: "",
});

export function validateCompanyDestination(value: CompanyDestinationDraft) {
  if (typeof value?.legalName !== "string" || value.legalName.trim().length < 3) return "Informe a razão social.";
  if (typeof value.tradeName !== "string" || value.tradeName.trim().length < 2)
    return "Informe o nome do veículo ou nome fantasia.";
  if (typeof value.document !== "string" || !isValidCnpj(onlyDigits(value.document))) return "Informe um CNPJ válido.";
  if (typeof value.detail !== "string" || value.detail.trim().length < 3)
    return "Descreva a classe, produto ou finalidade do veículo.";
  if (!["Factoring", "FIDC", "Securitizadora"].includes(value.institution))
    return "Escolha um tipo de instituição válido.";
  return undefined;
}
