"use client";
/**
 * Estado de visualização da visão geral: período e perfil escolhidos (lembrados no
 * localStorage) e o relógio que atualiza a cada minuto a saudação, os marcos e o rodapé.
 */
import type { HomePeriod, HomeProfile } from "@/src/domain/home/settings";
import { useEffect, useState } from "react";

export function useHomePreferences() {
  const [period, setPeriodState] = useState<HomePeriod>("mes");
  const [profile, setProfile] = useState<HomeProfile>("gestao");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("strato-home-profile");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferências lidas do localStorage depois de montar
      if (saved === "gestao" || saved === "operacao" || saved === "risco") setProfile(saved);
      const savedPeriod = window.localStorage.getItem("strato-home-period");
      if (savedPeriod === "dia" || savedPeriod === "semana" || savedPeriod === "mes") setPeriodState(savedPeriod);
    } catch {
      /* sem armazenamento */
    }
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const setPeriod = (p: HomePeriod) => {
    setPeriodState(p);
    try {
      window.localStorage.setItem("strato-home-period", p);
    } catch {
      /* sem armazenamento */
    }
  };
  const chooseProfile = (p: HomeProfile) => {
    setProfile(p);
    try {
      window.localStorage.setItem("strato-home-profile", p);
    } catch {
      /* sem armazenamento */
    }
  };
  return { period, setPeriod, profile, chooseProfile, now };
}
