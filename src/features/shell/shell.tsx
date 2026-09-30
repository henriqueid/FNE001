"use client";

/**
 * Moldura da aplicação: menu lateral (recolhível e em gaveta no celular), barra superior, tema e busca global.
 */
import { CommandPalette } from "./command-palette";
import { type NavItem, allNav, navGroups } from "./navigation";
import { NotificationsPopover, isOpen, operationSignals } from "./notifications";
import { type AppView, ShellContext } from "./shell-context";
import { useTheme } from "./use-theme";

import { destinations } from "@/src/domain/core/demo/companies";
import { BellIcon, LayersIcon, MenuIcon, MoonIcon, PanelIcon, SearchIcon, SunIcon } from "@/src/ui/icons";
import { type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export const SIDEBAR_KEY = "strato-sidebar-collapsed";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

export function Shell({
  children,
  active = "Operações",
  operationCount,
  companyScope = "Consolidado",
  onOpenSettings,
  onNavigate,
}: {
  children: ReactNode;
  active?: string;
  operationCount?: number;
  companyScope?: string;
  onOpenSettings: () => void;
  onNavigate?: (target: AppView) => void;
}) {
  const context = useContext(ShellContext);
  const { preference, resolved, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const operations = useMemo(() => context?.operations ?? [], [context?.operations]);
  const openCount = operationCount ?? operations.filter(isOpen).length;
  const signals = useMemo(() => operationSignals(operations), [operations]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida do localStorage depois de montar
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true");
    } catch {
      /* ignora */
    }
  }, []);
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

  const toggleCollapsed = () =>
    setCollapsed(current => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, String(!current));
      } catch {
        /* ignora */
      }
      return !current;
    });
  const go = (item: NavItem) => {
    setMobileMenu(false);
    if (!item.view) {
      onOpenSettings();
      return;
    }
    (onNavigate ?? context?.navigate)?.(item.view);
  };
  const cycleTheme = () => setPreference(resolved === "dark" ? "light" : "dark");
  const scopeLabel = companyScope === "Consolidado" ? "Visão consolidada" : companyScope;

  return (
    <div className={`sx-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`sx-sidebar ${mobileMenu ? "is-open" : ""}`} aria-label="Navegação principal">
        <div className="sx-brand">
          <img className="sx-logo" src="/brand/strato-logo-horizontal-negative.png" alt="STRATO" />
          <img className="sx-symbol" src="/brand/strato-symbol-32.png" alt="" aria-hidden="true" />
          <span className="sx-brand-tag">Receivables OS</span>
        </div>
        <nav>
          {navGroups.map(group => (
            <div className="sx-nav-group" key={group.title}>
              <span className="sx-nav-label">{group.title}</span>
              {group.items.map(item => (
                <button
                  key={item.label}
                  type="button"
                  className={active === item.label ? "is-active" : ""}
                  aria-current={active === item.label ? "page" : undefined}
                  title={collapsed ? item.label : item.hint}
                  onClick={() => go(item)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.label === "Operações" && openCount > 0 && <b>{openCount}</b>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sx-sidebar-foot">
          <div className="sx-tenant" title={scopeLabel}>
            <span>{companyScope === "Consolidado" ? <LayersIcon /> : initials(companyScope)}</span>
            <div>
              <strong>{scopeLabel}</strong>
              <small>
                {companyScope === "Consolidado" ? `${destinations.length} empresas e veículos` : "Empresa ativa"}
              </small>
            </div>
          </div>
          <div className="sx-profile">
            <span>HF</span>
            <div>
              <strong>Henrique</strong>
              <small>Administrador</small>
            </div>
          </div>
          <button
            type="button"
            className="sx-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelIcon />
            <span>{collapsed ? "Expandir" : "Recolher menu"}</span>
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button type="button" className="sx-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />
      )}
      <div className="sx-main">
        <header className="sx-topbar">
          <button
            type="button"
            className="sx-icon-btn sx-menu-btn"
            aria-label="Abrir menu"
            onClick={() => setMobileMenu(true)}
          >
            <MenuIcon />
          </button>
          <button type="button" className="sx-search" onClick={() => setPaletteOpen(true)} aria-label="Buscar (Ctrl+K)">
            <SearchIcon />
            <span>Buscar operação, aditivo, cedente, CNPJ ou módulo</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="sx-top-actions">
            <span className="sx-env" title="Dados fictícios; ações simuladas no navegador">
              <i /> Demonstração
            </span>
            <button
              type="button"
              className="sx-icon-btn"
              onClick={cycleTheme}
              aria-label={resolved === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              title={`Tema: ${preference === "system" ? "sistema" : preference === "dark" ? "escuro" : "claro"}`}
            >
              {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="sx-bell-wrap">
              <button
                type="button"
                className="sx-icon-btn"
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
          </div>
        </header>
        <main className="sx-content">{children}</main>
      </div>
      <nav className="sx-bottom-nav" aria-label="Navegação rápida">
        {allNav
          .filter(item => ["home", "operations", "portfolio", "finance"].includes(item.view ?? ""))
          .map(item => (
            <button
              key={item.label}
              type="button"
              className={active === item.label ? "is-active" : ""}
              onClick={() => go(item)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.label === "Operações" && openCount > 0 && <b>{openCount}</b>}
            </button>
          ))}
        <button type="button" onClick={() => setMobileMenu(true)}>
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
