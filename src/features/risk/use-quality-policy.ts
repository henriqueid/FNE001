"use client";
/**
 * Política de qualidade em uso: começa na política de demonstração e guarda os ajustes do usuário
 * no navegador (até existir o cadastro de políticas no servidor). A raiz do app (`strato-app.tsx`)
 * guarda uma única política no `QualityContext`, junto com os históricos e o score de cada cliente,
 * para que cadastro, operação, Risco e panorama mostrem o mesmo score.
 */
import { type QualityHistory, type QualityTrend } from "@/src/domain/risk/quality";
import { demoQualityPolicy, type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { createContext, useContext, useEffect, useState } from "react";

/** v2: score na escala 0–1000 (a v1 guardava o índice em 0–100). */
export const QUALITY_POLICY_KEY = "strato-quality-policy-v2";

export type QualityState = ReturnType<typeof useQualityPolicyState>;

export type QualityValue = QualityState & {
  cedentHistories: QualityHistory[];
  debtorHistories: QualityHistory[];
  /** Tendência de qualidade por documento (só dígitos), cedentes e sacados. */
  byDocument: Map<string, QualityTrend>;
};

export const QualityContext = createContext<QualityValue | null>(null);

/** Política, históricos e scores compartilhados (null fora do provedor, como em testes). */
export function useQuality() {
  return useContext(QualityContext);
}

/** Política em uso: a do app quando há provedor; senão, estado local. */
export function useQualityPolicy(): QualityState {
  const local = useQualityPolicyState();
  return useContext(QualityContext) ?? local;
}

export function useQualityPolicyState() {
  const [policy, setPolicy] = useState<QualityPolicy>(demoQualityPolicy);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUALITY_POLICY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QualityPolicy;
        if (parsed?.components?.length)
          // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida do navegador depois de montar
          setPolicy({
            ...demoQualityPolicy,
            ...parsed,
            healthyIndex: demoQualityPolicy.healthyIndex,
            indicators: { ...demoQualityPolicy.indicators, ...(parsed.indicators ?? {}) },
          });
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
