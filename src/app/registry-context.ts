"use client";

/**
 * Contexto React do cadastro único: cedentes efetivos, pessoas do Cadastro, estado comercial e ações de gravação.
 * Fornecido por `strato-app.tsx`; consumido por Operação, Comercial, Carteira e Cadastros.
 */
import { type CommercialState, type SalesRep } from "@/src/domain/commercial/types";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { type Cedent } from "@/src/domain/core/types";
import { type Party } from "@/src/domain/registry/parties";
import { type ClientRecord } from "@/src/domain/registry/registry";
import { createContext, useContext } from "react";

export type RegistryValue = {
  commercial: CommercialState;
  cedents: Cedent[];
  records: ClientRecord[];
  repOf: (document: string, date?: string) => SalesRep | undefined;
  onCommercial: (next: CommercialState) => void;
  /** Pessoas do Cadastro (salvas + derivadas dos módulos), uma por documento. */
  parties: Party[];
  /** Valida, grava e propaga para Operação, Comercial e sacados. */
  saveParty: (party: Party) => { error?: string; message?: string };
};

export const RegistryContext = createContext<RegistryValue | null>(null);

export function useRegistry(): RegistryValue {
  const value = useContext(RegistryContext);
  if (!value) throw new Error("RegistryContext ausente");
  return value;
}

/** Versão tolerante (componentes que também rodam fora do provedor, como testes). */
export function useCedents(): Cedent[] {
  return useContext(RegistryContext)?.cedents ?? initialCedents;
}
