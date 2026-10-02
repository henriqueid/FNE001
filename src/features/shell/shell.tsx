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
import {
  BellIcon,
  CheckIcon,
  GridIcon,
  LayersIcon,
  MenuIcon,
  MoonIcon,
  PanelIcon,
  SearchIcon,
  SlidersIcon,
  SunIcon,
  UndoIcon,
  UsersIcon,
} from "@/src/ui/icons";
import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

export const SIDEBAR_KEY = "strato-sidebar-collapsed";

// Mantém a preferência entre remontagens do Shell. Isso evita que o menu nasça
// expandido por um frame ao sair de uma operação para outro módulo.
let collapsedPreference = false;

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
  const { preference, resolved, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsedPreference);
  const [mobileMenu, setMobileMenu] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const operations = useMemo(() => context?.operations ?? [], [context?.operations]);
  const openCount = operationCount ?? operations.filter(isOpen).length;
  const signals = useMemo(() => operationSignals(operations), [operations]);

  useEffect(() => {
    try {
      const storedPreference = window.localStorage.getItem(SIDEBAR_KEY) === "true";
      collapsedPreference = storedPreference;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida do localStorage depois de montar
      setCollapsed(storedPreference);
    } catch {
      /* ignora */
    }
  }, []);
  useEffect(() => {
    if (!tenantOpen && !profileOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tenantOpen && tenantRef.current && !tenantRef.current.contains(target)) setTenantOpen(false);
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTenantOpen(false);
        setProfileOpen(false);
      }
    };
    const timer = window.setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen, tenantOpen]);
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
      const next = !current;
      collapsedPreference = next;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        /* ignora */
      }
      return next;
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
  const chooseCompany = (scope: string) => {
    onCompanyScopeChange?.(scope);
    setTenantOpen(false);
    setMobileMenu(false);
  };

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
          <div className="sx-sidebar-control" ref={tenantRef}>
            <button
              type="button"
              className="sx-tenant sx-sidebar-trigger"
              title={scopeLabel}
              aria-haspopup="dialog"
              aria-expanded={tenantOpen}
              onClick={() => {
                setTenantOpen(open => !open);
                setProfileOpen(false);
              }}
            >
              <span>{companyScope === "Consolidado" ? <LayersIcon /> : initials(companyScope)}</span>
              <div>
                <strong>{scopeLabel}</strong>
                <small>
                  {companyScope === "Consolidado" ? `${destinations.length} empresas e veículos` : "Empresa ativa"}
                </small>
              </div>
              <i className="sx-trigger-caret" aria-hidden="true" />
            </button>
            {tenantOpen && (
              <div className="sx-sidebar-popover sx-company-popover" role="dialog" aria-label="Trocar empresa">
                <header>
                  <strong>Empresa de trabalho</strong>
                  <small>O recorte será aplicado em todos os módulos.</small>
                </header>
                <div className="sx-company-options" role="listbox" aria-label="Empresas e veículos">
                  <button
                    type="button"
                    role="option"
                    aria-selected={companyScope === "Consolidado"}
                    className={companyScope === "Consolidado" ? "is-selected" : ""}
                    onClick={() => chooseCompany("Consolidado")}
                  >
                    <span className="sx-menu-symbol">
                      <LayersIcon />
                    </span>
                    <span>
                      <b>Visão consolidada</b>
                      <small>Todas as empresas e veículos</small>
                    </span>
                    {companyScope === "Consolidado" && <CheckIcon />}
                  </button>
                  {destinations.map(destination => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={companyScope === destination.name}
                      className={companyScope === destination.name ? "is-selected" : ""}
                      key={destination.name}
                      onClick={() => chooseCompany(destination.name)}
                    >
                      <span className="sx-menu-symbol sx-company-initials">{initials(destination.name)}</span>
                      <span>
                        <b>{destination.name}</b>
                        <small>
                          {destination.institution} · {destination.detail}
                        </small>
                      </span>
                      {companyScope === destination.name && <CheckIcon />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="sx-sidebar-control" ref={profileRef}>
            <button
              type="button"
              className="sx-profile sx-sidebar-trigger"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen(open => !open);
                setTenantOpen(false);
              }}
            >
              <span>HF</span>
              <div>
                <strong>Henrique</strong>
                <small>Administrador</small>
              </div>
              <i className="sx-trigger-caret" aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className="sx-sidebar-popover sx-profile-popover" role="menu" aria-label="Menu do usuário">
                <header className="sx-profile-head">
                  <span>HF</span>
                  <div>
                    <strong>Henrique</strong>
                    <small>Administrador · sessão de demonstração</small>
                  </div>
                </header>
                <div className="sx-profile-actions">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <SlidersIcon />
                    <span>
                      <b>Preferências de interface</b>
                      <small>Tema e orientação das telas</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      setMobileMenu(false);
                      (onNavigate ?? context?.navigate)?.("registry");
                    }}
                  >
                    <UsersIcon />
                    <span>
                      <b>Cadastros</b>
                      <small>Pessoas, empresas e responsáveis</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      context?.resetDemo();
                    }}
                  >
                    <UndoIcon />
                    <span>
                      <b>Restaurar demonstração</b>
                      <small>Voltar aos dados iniciais</small>
                    </span>
                  </button>
                </div>
                <footer>
                  <GridIcon />
                  <span>STRATO Receivables OS · v0.7</span>
                </footer>
              </div>
            )}
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
