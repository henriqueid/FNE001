"use client";
/**
 * Política de qualidade em uso na tela de Risco: começa na política de demonstração e
 * guarda os ajustes do usuário no navegador (até existir o cadastro de políticas no servidor).
 */
import { demoQualityPolicy, type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { useEffect, useState } from "react";

export const QUALITY_POLICY_KEY = "strato-quality-policy";

export function useQualityPolicy() {
  const [policy, setPolicy] = useState<QualityPolicy>(demoQualityPolicy);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUALITY_POLICY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QualityPolicy;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida do navegador depois de montar
        if (parsed?.components?.length) setPolicy({ ...demoQualityPolicy, ...parsed });
      }
    } catch {
      /* sem armazenamento: fica a política de demonstração */
    }
  }, []);
  const save = (next: QualityPolicy) => {
    setPolicy(next);
    try {
      window.localStorage.setItem(QUALITY_POLICY_KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
  };
  const reset = () => {
    setPolicy(demoQualityPolicy);
    try {
      window.localStorage.removeItem(QUALITY_POLICY_KEY);
    } catch {
      /* ignora */
    }
  };
  return { policy, save, reset, customized: policy !== demoQualityPolicy };
}
