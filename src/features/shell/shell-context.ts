"use client";
import { type Operation } from "@/src/domain/core/types";
import type { CopilotOperationRequest } from "@/src/domain/copilot/operation-handoff";
import { createContext } from "react";

/* ---------------------------------------------------------------------------
   Shell do STRATO: navegação, busca global (⌘K), tema claro/escuro e alertas.
   O estado da aplicação chega por contexto, para que qualquer tela use o shell
   sem precisar repassar dados.
   ------------------------------------------------------------------------ */

export type AppView =
  | "home"
  | "operations"
  | "controlleria"
  | "portfolio"
  | "commercial"
  | "live"
  | "finance"
  | "registry"
  | "policies"
  | "integrations"
  | "settings";

export type ShellContextValue = {
  operations: Operation[];
  navigate: (view: AppView) => void;
  openOperation: (operation: Operation) => void;
  newOperation: () => void;
  createCopilotOperation: (request: CopilotOperationRequest) => Operation | undefined;
  approveCopilotOperation: (operationId: string, authorityApproved?: boolean) => Operation | undefined;
  openSettings: () => void;
  resetDemo?: () => void;
};

export const ShellContext = createContext<ShellContextValue | null>(null);
