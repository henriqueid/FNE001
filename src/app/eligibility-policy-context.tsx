"use client";

import { type EligibilityPolicy } from "@/src/domain/eligibility/model";
import { createContext, useContext } from "react";

const EligibilityPolicyContext = createContext<EligibilityPolicy[] | null>(null);

export const EligibilityPolicyProvider = EligibilityPolicyContext.Provider;

export function useEligibilityPolicies() {
  return useContext(EligibilityPolicyContext);
}
