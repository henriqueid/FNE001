"use client";

/**
 * Abas das seções de um módulo (Financeiro, Carteira, Comercial, Cadastros): barra em pílula
 * com ícone, nome e contador. Contadores de pendência usam tom de alerta.
 */
import { type ReactNode } from "react";

export type ModuleTab<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** "alert" quando o contador indica pendência (ex.: vencidos, a conciliar). */
  tone?: "alert" | "neutral";
};

export function ModuleTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className = "",
}: {
  tabs: ModuleTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <nav className={`lx-modtabs ${className}`} aria-label={label}>
      <div role="tablist" aria-label={label}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            className={value === t.id ? "active" : ""}
            onClick={() => onChange(t.id)}
          >
            {t.icon && <span className="lx-modtab-icon">{t.icon}</span>}
            <span>{t.label}</span>
            {typeof t.count === "number" && (t.count > 0 || t.tone === "neutral") && (
              <b className={t.tone === "alert" ? "alert" : ""}>{t.count}</b>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
