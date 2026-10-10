"use client";

import { createContext, useContext } from "react";

export type StratoAuthMode = "supabase" | "demo";

export type StratoAuthContextValue = {
  mode: StratoAuthMode;
  signOut: () => Promise<void>;
};

const StratoAuthContext = createContext<StratoAuthContextValue | undefined>(undefined);

export const StratoAuthProvider = StratoAuthContext.Provider;

export function useStratoAuth() {
  return useContext(StratoAuthContext);
}
