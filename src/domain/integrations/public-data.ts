export type CepEvidence = {
  provider: "BRASIL_API";
  fetchedAt: string;
  expiresAt: string;
  zipCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  service: string;
  ibgeCity: string;
  ibgeState: string;
  location?: { latitude: number; longitude: number };
};

export type BankEvidence = {
  provider: "BRASIL_API_BCB";
  fetchedAt: string;
  expiresAt: string;
  code?: number;
  ispb: string;
  name: string;
  fullName: string;
};

export type HolidayEvidence = {
  provider: "BRASIL_API";
  fetchedAt: string;
  expiresAt: string;
  date: string;
  name: string;
  type: string;
};

export type PixParticipantEvidence = {
  provider: "BRASIL_API_BCB";
  fetchedAt: string;
  expiresAt: string;
  ispb: string;
  name: string;
  shortName: string;
  participationMode: string;
  participationType: string;
};

export const formatBankLabel = (bank: BankEvidence) =>
  `${bank.code != null ? String(bank.code).padStart(3, "0") : bank.ispb} · ${bank.name || bank.fullName}`;
