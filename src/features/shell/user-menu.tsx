"use client";

/**
 * Menu do usuário na barra superior: empresa de trabalho (recorte de todos os módulos),
 * aparência (claro, escuro, sistema), preferências e restaurar a demonstração.
 */
import { type ThemePreference } from "./use-theme";

import { destinations } from "@/src/domain/core/demo/companies";
import { CheckIcon, LayersIcon, MonitorIcon, MoonIcon, SlidersIcon, SunIcon, UndoIcon } from "@/src/ui/icons";
import { useEffect, useRef, useState } from "react";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

const themes: { id: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Claro", icon: <SunIcon /> },
  { id: "dark", label: "Escuro", icon: <MoonIcon /> },
  { id: "system", label: "Sistema", icon: <MonitorIcon /> },
];

export function UserMenu({
  companyScope,
  onCompanyScopeChange,
  theme,
  onTheme,
  onOpenSettings,
  onResetDemo,
}: {
  companyScope: string;
  onCompanyScopeChange?: (scope: string) => void;
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
  onOpenSettings: () => void;
  onResetDemo?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const scopeLabel = companyScope === "Consolidado" ? "Consolidado" : companyScope;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const timer = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (scope: string) => {
    onCompanyScopeChange?.(scope);
    setOpen(false);
  };

  return (
    <div className="lx-user-wrap" ref={ref}>
      <button
        type="button"
        className="lx-user"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Henrique, ${scopeLabel}. Abrir menu do usuário`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="lx-avatar">HF</span>
        <span className="lx-user-text">
          <strong>Henrique</strong>
          <small>{scopeLabel}</small>
        </span>
        <i className="sx-trigger-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="lx-drop lx-user-menu" role="dialog" aria-label="Menu do usuário">
          <header>
            <span className="lx-avatar">HF</span>
            <div>
              <strong>Henrique</strong>
              <small>Administrador · sessão de demonstração</small>
            </div>
          </header>

          <section>
            <span className="lx-label">Empresa de trabalho</span>
            <div className="lx-company-list" role="listbox" aria-label="Empresas e veículos">
              {[{ name: "Consolidado", detail: `Todas as ${destinations.length} empresas e veículos` }]
                .concat(destinations.map(d => ({ name: d.name, detail: `${d.institution} · ${d.detail}` })))
                .map(option => (
                  <button
                    key={option.name}
                    type="button"
                    role="option"
                    aria-selected={companyScope === option.name}
                    className={companyScope === option.name ? "is-selected" : ""}
                    onClick={() => choose(option.name)}
                  >
                    <span className="lx-company-mark">
                      {option.name === "Consolidado" ? <LayersIcon /> : initials(option.name)}
                    </span>
                    <span>
                      <b>{option.name === "Consolidado" ? "Visão consolidada" : option.name}</b>
                      <small>{option.detail}</small>
                    </span>
                    {companyScope === option.name && <CheckIcon />}
                  </button>
                ))}
            </div>
          </section>

          <section>
            <span className="lx-label">Aparência</span>
            <div className="lx-theme-switch" role="radiogroup" aria-label="Tema">
              {themes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  className={theme === t.id ? "is-active" : ""}
                  onClick={() => onTheme(t.id)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <footer>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <SlidersIcon /> Preferências de interface
            </button>
            {onResetDemo && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onResetDemo();
                }}
              >
                <UndoIcon /> Restaurar demonstração
              </button>
            )}
          </footer>
        </div>
      )}
    </div>
  );
}
