import { THEME_KEY } from "./theme";
import { useEffect } from "react";

/* ---------------------------------------------------------------------------
   Shell do STRATO: navegação, busca global (⌘K), tema claro/escuro e alertas.
   O estado da aplicação chega por contexto, para que qualquer tela use o shell
   sem precisar repassar dados.
   ------------------------------------------------------------------------ */
export type ThemePreference = "light" | "dark" | "system";

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  void preference;
  return "light";
}

export function useTheme() {
  const preference: ThemePreference = "light";
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    try {
      window.localStorage.removeItem(THEME_KEY);
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  const update = (next: ThemePreference) => {
    void next;
  };
  return { preference, resolved: resolveTheme(preference), setPreference: update };
}
