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
  if (value.legalName.trim().length < 3) return "Informe a razão social.";
  if (value.tradeName.trim().length < 2) return "Informe o nome do veículo ou nome fantasia.";
  if (!isValidCnpj(onlyDigits(value.document))) return "Informe um CNPJ válido.";
  if (value.detail.trim().length < 3) return "Descreva a classe, produto ou finalidade do veículo.";
  return undefined;
}
