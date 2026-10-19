"use client";
/** Instala somente o worker do aviso de desconexão em produção com contexto seguro. */
import { useEffect } from "react";
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Falha de instalação não afeta a sessão ou os fluxos online.
    });
  }, []);
  return null;
}
