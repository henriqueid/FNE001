import { isValidCnpj, onlyDigits } from "@/src/domain/registry/parties";

export type CompanyProfile = {
  legalName: string;
  tradeName: string;
  document: string;
  institutionType: "Factoring" | "FIDC" | "Securitizadora" | "Empresa de fomento" | "Outro";
  email: string;
  phone: string;
  website: string;
  foundationDate: string;
  address: {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
};

export function validateCompanyProfile(company: CompanyProfile) {
  if (company.legalName.trim().length < 3) return "Informe a razão social.";
  if (company.tradeName.trim().length < 2) return "Informe o nome fantasia.";
  if (!isValidCnpj(onlyDigits(company.document))) return "Informe um CNPJ válido.";
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) return "Informe um e-mail válido.";
  return undefined;
}
