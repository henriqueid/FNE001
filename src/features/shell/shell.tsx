"use client";

/**
 * Moldura da aplicação. Desktop: barra superior com os módulos com nome, "Plataforma ▾",
 * busca, alertas e menu do usuário (empresa e tema). Tablet: botão "Menu" com o painel de
 * módulos. Celular: barra inferior com atalhos e o menu completo em folha.
 */
import { CommandPalette } from "./command-palette";
import { ModuleMenu } from "./module-menu";
import { type NavItem, bottomNav, platformNav, primaryNav } from "./navigation";
import { NotificationsPopover, isOpen, operationSignals } from "./notifications";
import { type AppView, ShellContext } from "./shell-context";
import { useTheme } from "./use-theme";
import { UserMenu } from "./user-menu";

import { BellIcon, GridIcon, MenuIcon, SearchIcon } from "@/src/ui/icons";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export { initials } from "./user-menu";

export function Shell({
  children,
  active = "Operações",
  operationCount,
  companyScope = "Consolidado",
  onCompanyScopeChange,
  onOpenSettings,
  onNavigate,
}: {
  children: ReactNode;
  active?: string;
  operationCount?: number;
  companyScope?: string;
  onCompanyScopeChange?: (scope: string) => void;
  onOpenSettings: () => void;
  onNavigate?: (target: AppView) => void;
}) {
  const context = useContext(ShellContext);
  const { preference, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const operations = useMemo(() => context?.operations ?? [], [context?.operations]);
  const openCount = operationCount ?? operations.filter(isOpen).length;
  const signals = useMemo(() => operationSignals(operations), [operations]);
  const platformActive = platformNav.some(item => item.label === active);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMoreOpen(false);
    const timer = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(open => !open);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (item: NavItem) => {
    setMenuOpen(false);
    setMoreOpen(false);
    if (!item.view) {
      onOpenSettings();
      return;
    }
    (onNavigate ?? context?.navigate)?.(item.view);
  };
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const badge = (item: NavItem) => item.label === "Operações" && openCount > 0 && <b>{openCount}</b>;

  return (
    <div className="sx-shell lx-shell">
      <div className="sx-main">
        <header className="lx-topbar">
          <button
            type="button"
            className="lx-menu-btn"
            aria-label="Abrir menu de módulos"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            <MenuIcon />
            <span>Menu</span>
          </button>
          <div className="lx-brand">
            <img className="sx-logo sx-logo-light" src="/brand/strato-logo-horizontal-color.png" alt="STRATO" />
            <img
              className="sx-logo sx-logo-dark"
              src="/brand/strato-logo-horizontal-negative.png"
              alt=""
              aria-hidden="true"
            />
          </div>
          <nav className="lx-nav" aria-label="Módulos">
            {primaryNav.map(item => (
              <button
                key={item.label}
                type="button"
                className={active === item.label ? "is-active" : ""}
                aria-current={active === item.label ? "page" : undefined}
                title={item.hint}
                onClick={() => go(item)}
              >
                {item.icon}
                <span>{item.label}</span>
                {badge(item)}
              </button>
            ))}
            <div className="lx-more" ref={moreRef}>
              <button
                type="button"
                className={platformActive ? "is-active" : ""}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(v => !v)}
              >
                <GridIcon />
                <span>{platformActive ? active : "Plataforma"}</span>
                <i className="sx-trigger-caret" aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="lx-drop lx-more-menu" role="menu" aria-label="Plataforma">
                  {platformNav.map(item => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      className={active === item.label ? "is-active" : ""}
                      onClick={() => go(item)}
                    >
                      <span className="lx-module-icon">{item.icon}</span>
                      <span className="lx-module-text">
                        <b>{item.label}</b>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="lx-actions">
            <button
              type="button"
              className="lx-search"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buscar (Ctrl+K)"
            >
              <SearchIcon />
              <span>Buscar cliente, operação ou CNPJ</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="sx-bell-wrap">
              <button
                type="button"
                className="lx-icon"
                aria-label={`Alertas: ${signals.length}`}
                aria-expanded={bellOpen}
                onClick={() => setBellOpen(open => !open)}
              >
                <BellIcon />
                {signals.length > 0 && <i className="sx-dot">{signals.length}</i>}
              </button>
              {bellOpen && (
                <NotificationsPopover
                  signals={signals}
                  onClose={() => setBellOpen(false)}
                  onOpen={operation => {
                    setBellOpen(false);
                    context?.openOperation(operation);
                  }}
                  onSeeAll={() => {
                    setBellOpen(false);
                    (onNavigate ?? context?.navigate)?.("operations");
                  }}
                />
              )}
            </div>
            <UserMenu
              companyScope={companyScope}
              onCompanyScopeChange={onCompanyScopeChange}
              theme={preference}
              onTheme={setPreference}
              onOpenSettings={onOpenSettings}
              onResetDemo={context?.resetDemo}
            />
          </div>
        </header>
        {menuOpen && <ModuleMenu active={active} openCount={openCount} onGo={go} onClose={closeMenu} />}
        <main className="sx-content">{children}</main>
      </div>
      <nav className="sx-bottom-nav" aria-label="Navegação rápida">
        {bottomNav.map(item => (
          <button
            key={item.label}
            type="button"
            className={active === item.label ? "is-active" : ""}
            onClick={() => go(item)}
          >
            {item.icon}
            <span>{item.label}</span>
            {badge(item)}
          </button>
        ))}
        <button type="button" className={menuOpen ? "is-active" : ""} onClick={() => setMenuOpen(v => !v)}>
          <MenuIcon />
          <span>Menu</span>
        </button>
      </nav>
      {paletteOpen && (
        <CommandPalette
          operations={operations}
          themePreference={preference}
          onTheme={setPreference}
          onClose={() => setPaletteOpen(false)}
          onNavigate={view => {
            setPaletteOpen(false);
            (onNavigate ?? context?.navigate)?.(view);
          }}
          onOpen={operation => {
            setPaletteOpen(false);
            context?.openOperation(operation);
          }}
          onNew={() => {
            setPaletteOpen(false);
            context?.newOperation();
          }}
          onSettings={() => {
            setPaletteOpen(false);
            onOpenSettings();
          }}
          onReset={() => {
            setPaletteOpen(false);
            context?.resetDemo();
          }}
        />
      )}
    </div>
  );
}
