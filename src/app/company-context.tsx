"use client";

import { destinations as demoDestinations } from "@/src/domain/core/demo/companies";
import type { Destination } from "@/src/domain/core/types";
import type { CompanyProfile } from "@/src/domain/company/profile";
import { useStratoAuth } from "@/src/features/auth/auth-context";
import { createContext, useContext, useMemo } from "react";

const CompanyContext = createContext<CompanyProfile | null>(null);
export const CompanyProvider = CompanyContext.Provider;
export const useCompany = () => useContext(CompanyContext);

export function useCompanyDestinations(): Destination[] {
  const company = useCompany();
  const auth = useStratoAuth();
  return useMemo(
    () =>
      company
        ? [
            {
              name: company.tradeName,
              institution:
                company.institutionType === "Empresa de fomento" || company.institutionType === "Outro"
                  ? "Factoring"
                  : company.institutionType,
              detail: company.document
                .replace(/\D/g, "")
                .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
            },
          ]
        : auth?.mode === "demo"
          ? demoDestinations
          : [],
    [company, auth?.mode],
  );
}
