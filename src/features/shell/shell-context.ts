"use client";
import { type Operation } from "@/src/domain/core/types";
import { createContext } from "react";

/* ---------------------------------------------------------------------------
   Shell do STRATO: navegação, busca global (⌘K), tema claro/escuro e alertas.
   O estado da aplicação chega por contexto, para que qualquer tela use o shell
   sem precisar repassar dados.
   ------------------------------------------------------------------------ */

export type AppView =
  "home" | "operations" | "portfolio" | "commercial" | "finance" | "registry" | "policies" | "integrations";

export type ShellContextValue = {
  operations: Operation[];
  navigate: (view: AppView) => void;
  openOperation: (operation: Operation) => void;
  newOperation: () => void;
  openSettings: () => void;
  resetDemo: () => void;
};

export const ShellContext = createContext<ShellContextValue | null>(null);
