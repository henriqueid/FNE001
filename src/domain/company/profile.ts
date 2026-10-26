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
  if (typeof company?.legalName !== "string" || company.legalName.trim().length < 3) return "Informe a razão social.";
  if (typeof company.tradeName !== "string" || company.tradeName.trim().length < 2) return "Informe o nome fantasia.";
  if (typeof company.document !== "string" || !isValidCnpj(onlyDigits(company.document)))
    return "Informe um CNPJ válido.";
  if (!["Factoring", "FIDC", "Securitizadora", "Empresa de fomento", "Outro"].includes(company.institutionType))
    return "Escolha um tipo de instituição válido.";
  if ([company.email, company.phone, company.website, company.foundationDate].some(value => typeof value !== "string"))
    return "Dados de contato ou constituição inválidos.";
  if (
    !company.address ||
    ["zipCode", "street", "number", "complement", "district", "city", "state"].some(
      key => typeof company.address[key as keyof CompanyProfile["address"]] !== "string",
    )
  )
    return "Informe os dados do endereço da empresa.";
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) return "Informe um e-mail válido.";
  return undefined;
}
