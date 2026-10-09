/**
 * Empresas e veículos do grupo (FIDC, securitizadora, factoring) e suas contas pagadoras.
 */
import { type BankAccount, type Destination } from "@/src/domain/core/types";
export const destinations: Destination[] = [
  { name: "Lastro Prime FIDC · Classe Sênior", institution: "FIDC", detail: "Classe Sênior · Subclasse A" },
  { name: "Aurora Recebíveis FIDC · Classe Única", institution: "FIDC", detail: "Classe Única" },
  { name: "Órbita Securitizadora S.A.", institution: "Securitizadora", detail: "Companhia securitizadora" },
  { name: "Lastro Fomento Mercantil", institution: "Factoring", detail: "Factoring com regresso" },
];

// Contas pagadoras de cada empresa/veículo (saldo simulado)
export const payingAccounts: Record<string, BankAccount[]> = {
  "Lastro Prime FIDC · Classe Sênior": [
    {
      id: "pay-lp-1",
      label: "Conta movimento",
      holder: "Lastro Prime FIDC",
      document: "41.228.905/0001-09",
      bank: "341 · Itaú Unibanco",
      agency: "0912",
      account: "45781-2",
      balance: 2450000,
    },
    {
      id: "pay-lp-2",
      label: "Conta arrecadação",
      holder: "Lastro Prime FIDC",
      document: "41.228.905/0001-09",
      bank: "237 · Bradesco",
      agency: "3310",
      account: "11820-4",
      balance: 180000,
    },
  ],
  "Aurora Recebíveis FIDC · Classe Única": [
    {
      id: "pay-au-1",
      label: "Conta movimento",
      holder: "Aurora Recebíveis FIDC",
      document: "38.550.117/0001-11",
      bank: "208 · BTG Pactual",
      agency: "0001",
      account: "998812-7",
      balance: 1320000,
    },
    {
      id: "pay-au-2",
      label: "Conta reserva",
      holder: "Aurora Recebíveis FIDC",
      document: "38.550.117/0001-11",
      bank: "033 · Santander",
      agency: "2211",
      account: "13004455-1",
      balance: 420000,
    },
  ],
  "Órbita Securitizadora S.A.": [
    {
      id: "pay-or-1",
      label: "Conta movimento",
      holder: "Órbita Securitizadora S.A.",
      document: "27.604.331/0001-97",
      bank: "001 · Banco do Brasil",
      agency: "1834-5",
      account: "60771-9",
      balance: 960000,
    },
    {
      id: "pay-or-2",
      label: "Conta operacional",
      holder: "Órbita Securitizadora S.A.",
      document: "27.604.331/0001-97",
      bank: "748 · Sicredi",
      agency: "0710",
      account: "38112-0",
      balance: 75000,
    },
  ],
  "Lastro Fomento Mercantil": [
    {
      id: "pay-lf-1",
      label: "Conta movimento",
      holder: "Lastro Fomento Mercantil Ltda",
      document: "19.774.602/0001-24",
      bank: "756 · Sicoob",
      agency: "4402",
      account: "20917-3",
      balance: 310000,
    },
    {
      id: "pay-lf-2",
      label: "Conta secundária",
      holder: "Lastro Fomento Mercantil Ltda",
      document: "19.774.602/0001-24",
      bank: "104 · Caixa",
      agency: "0388",
      account: "00012077-8",
      balance: 55000,
    },
  ],
};
