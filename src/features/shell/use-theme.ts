import { THEME_KEY } from "./theme";
import { useEffect, useState } from "react";

/* ---------------------------------------------------------------------------
   Shell do STRATO: navegação, busca global (⌘K), tema claro/escuro e alertas.
   O estado da aplicação chega por contexto, para que qualquer tela use o shell
   sem precisar repassar dados.
   ------------------------------------------------------------------------ */
export type ThemePreference = "light" | "dark" | "system";

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY) as ThemePreference | null;
      if (saved === "light" || saved === "dark" || saved === "system") setPreference(saved); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      /* sem armazenamento: segue o sistema */
    }
  }, []);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preference);
    };
    apply();
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", apply);
    return () => media?.removeEventListener?.("change", apply);
  }, [preference]);
  const update = (next: ThemePreference) => {
    setPreference(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignora */
    }
  };
  return { preference, resolved: resolveTheme(preference), setPreference: update };
}
