export type CnpjPartner = {
  name: string;
  document: string;
  qualification: string;
  joinedAt: string;
};

export type CnpjEvidence = {
  provider: "BRASIL_API" | "RECEITA_WS" | "SERPRO_CNPJ";
  registrationNumber: string;
  fetchedAt: string;
  expiresAt: string;
  legalName: string;
  tradeName: string;
  registrationStatus: { code: string; label: string };
  openedAt: string;
  legalNature: string;
  companySize: string;
  shareCapital: number;
  email: string;
  phones: string[];
  address: {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  mainActivity: { code: string; description: string };
  secondaryActivities: Array<{ code: string; description: string }>;
  partners: CnpjPartner[];
  simples: boolean | null;
  mei: boolean | null;
};

export const cnpjEvidenceChanges = (
  current: {
    name: string;
    tradeName: string;
    birthOrFoundation: string;
    email: string;
    phone: string;
    address: CnpjEvidence["address"];
  },
  evidence: CnpjEvidence,
) => {
  const changes: string[] = [];
  if (evidence.legalName && current.name !== evidence.legalName) changes.push("Razão social");
  if (evidence.tradeName && current.tradeName !== evidence.tradeName) changes.push("Nome fantasia");
  if (evidence.openedAt && current.birthOrFoundation !== evidence.openedAt) changes.push("Data de abertura");
  if (evidence.email && current.email !== evidence.email) changes.push("E-mail");
  if (evidence.phones[0] && current.phone !== evidence.phones[0]) changes.push("Telefone");
  if (evidence.address.zipCode && current.address.zipCode !== evidence.address.zipCode) changes.push("Endereço");
  return changes;
};
