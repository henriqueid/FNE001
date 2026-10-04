"use client";

import { type IntegrationState } from "@/src/domain/integrations/model";
import { createContext, useContext } from "react";

const IntegrationContext = createContext<IntegrationState | null>(null);

export const IntegrationProvider = IntegrationContext.Provider;

export function useIntegrations() {
  const value = useContext(IntegrationContext);
  if (!value) throw new Error("IntegrationProvider não configurado");
  return value;
}
