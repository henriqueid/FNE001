"use client";

import { destinations as demoDestinations } from "@/src/domain/core/demo/companies";
import type { Destination } from "@/src/domain/core/types";
import type { CompanyProfile } from "@/src/domain/company/profile";
import type { CompanyDestination, CompanyDestinationDraft } from "@/src/domain/company/destination";
import { createCompanyDestination, loadCompanyDestinations } from "./company-destinations-client";
import { useStratoAuth } from "@/src/features/auth/auth-context";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const CompanyContext = createContext<CompanyProfile | null>(null);
export const CompanyProvider = CompanyContext.Provider;
export const useCompany = () => useContext(CompanyContext);

type CompanyDirectoryValue = {
  entries: CompanyDestination[];
  loading: boolean;
  error: string;
  create: (draft: CompanyDestinationDraft) => Promise<CompanyDestination>;
};

const CompanyDirectoryContext = createContext<CompanyDirectoryValue | null>(null);

export function CompanyDirectoryProvider({ children }: { children: ReactNode }) {
  const company = useCompany();
  const auth = useStratoAuth();
  const [entries, setEntries] = useState<CompanyDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const demoEntries = useMemo<CompanyDestination[]>(
    () =>
      demoDestinations.map((destination, index) => ({
        ...destination,
        id: `demo-${index}`,
        legalName: destination.name,
        tradeName: destination.name,
        document: "",
        status: "ACTIVE" as const,
      })),
    [],
  );

  useEffect(() => {
    if (auth?.mode === "demo") return;
    let cancelled = false;
    loadCompanyDestinations()
      .then(result => {
        if (!cancelled) setEntries(result);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os cadastros.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.mode, company?.document]);

  const value = useMemo<CompanyDirectoryValue>(
    () => ({
      entries: auth?.mode === "demo" ? [...demoEntries, ...entries] : entries,
      loading: auth?.mode === "demo" ? false : loading,
      error,
      create: async draft => {
        if (auth?.mode === "demo") {
          const created: CompanyDestination = {
            ...draft,
            id: `demo-${crypto.randomUUID()}`,
            name: draft.tradeName.trim(),
            status: "ACTIVE",
          };
          setEntries(current => [...current, created]);
          return created;
        }
        const created = await createCompanyDestination(draft);
        setEntries(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        return created;
      },
    }),
    [auth?.mode, demoEntries, entries, error, loading],
  );
  return <CompanyDirectoryContext.Provider value={value}>{children}</CompanyDirectoryContext.Provider>;
}

export const useCompanyDirectory = () => useContext(CompanyDirectoryContext);

export function useCompanyDestinations(): Destination[] {
  const company = useCompany();
  const directory = useCompanyDirectory();
  const auth = useStratoAuth();
  return useMemo(
    () =>
      directory?.entries.length
        ? directory.entries.filter(destination => destination.status === "ACTIVE")
        : company
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
    [directory, company, auth?.mode],
  );
}
