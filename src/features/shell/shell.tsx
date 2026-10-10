"use client";

/**
 * Moldura da aplicação. Desktop: barra Ledger v10 com módulos em ícones.
 * Tablet e celular preservam o menu completo e os atalhos inferiores.
 */
import { CommandPalette } from "./command-palette";
import { ModuleMenu } from "./module-menu";
import { type NavItem, bottomNav, desktopNav } from "./navigation";
import { NotificationsPopover, isOpen, operationSignals } from "./notifications";
import { type AppView, ShellContext } from "./shell-context";
import { useTheme } from "./use-theme";
import { UserMenu } from "./user-menu";
import { ExperienceGuide } from "./experience-guide";
import { DailyBriefing } from "@/src/features/copilot/daily-briefing";
import { type AppUserProfile, type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";

import { BellIcon, MenuIcon, SearchIcon } from "@/src/ui/icons";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export { initials } from "./user-menu";

export function Shell({
  children,
  active = "Operações",
  operationCount,
  companyScope = "Consolidado",
  onCompanyScopeChange,
  onOpenSettings,
  onNavigate,
  showJourney = false,
  currentUser,
  dailyBriefing,
  briefingReady = false,
}: {
  children: ReactNode;
  active?: string;
  operationCount?: number;
  companyScope?: string;
  onCompanyScopeChange?: (scope: string) => void;
  onOpenSettings: () => void;
  onNavigate?: (target: AppView) => void;
  /** Barra da jornada ("Você está em" e "Entenda esta tela"); ligada nas Configurações. */
  showJourney?: boolean;
  currentUser: AppUserProfile;
  dailyBriefing: DailyBriefingData;
  briefingReady?: boolean;
}) {
  const context = useContext(ShellContext);
  const { preference, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const operations = useMemo(() => context?.operations ?? [], [context?.operations]);
  const openCount = operationCount ?? operations.filter(isOpen).length;
  const signals = useMemo(() => operationSignals(operations), [operations]);
  const briefingStorageKey = `strato-daily-briefing-v1-${currentUser.id}`;
  const closeBriefing = useCallback(() => {
    setBriefingOpen(false);
    try {
      window.localStorage.setItem(briefingStorageKey, dailyBriefing.referenceDate);
    } catch {
      /* sem armazenamento: fecha apenas nesta sessão */
    }
  }, [briefingStorageKey, dailyBriefing.referenceDate]);
  useEffect(() => {
    if (!briefingReady) return;
    try {
      if (window.localStorage.getItem(briefingStorageKey) === dailyBriefing.referenceDate) return;
    } catch {
      /* sem armazenamento: ainda apresenta o resumo */
    }
    const timer = window.setTimeout(() => setBriefingOpen(true), 550);
    return () => window.clearTimeout(timer);
  }, [briefingReady, briefingStorageKey, dailyBriefing.referenceDate]);
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
            {desktopNav.map(item => (
              <button
                key={item.label}
                type="button"
                className={active === item.label ? "is-active" : ""}
                aria-current={active === item.label ? "page" : undefined}
                aria-label={item.label}
                title={`${item.label} · ${item.hint}`}
                onClick={() => go(item)}
              >
                <span className="lx-nav-icon">
                  {item.icon}
                  {badge(item)}
                </span>
                <span className="lx-nav-label">{item.label}</span>
              </button>
            ))}
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
                <span className="lx-action-icon">
                  <BellIcon />
                  {signals.length > 0 && <i className="sx-dot">{signals.length}</i>}
                </span>
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
              user={currentUser}
              companyScope={companyScope}
              onCompanyScopeChange={onCompanyScopeChange}
              theme={preference}
              onTheme={setPreference}
              onOpenSettings={onOpenSettings}
              onResetDemo={context?.resetDemo}
              onOpenDailyBriefing={() => setBriefingOpen(true)}
            />
          </div>
        </header>
        {menuOpen && <ModuleMenu active={active} openCount={openCount} onGo={go} onClose={closeMenu} />}
        <ExperienceGuide
          showJourney={showJourney}
          active={active}
          operations={operations}
          signals={signals}
          onNavigate={view => (onNavigate ?? context?.navigate)?.(view)}
        />
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
      {briefingOpen && (
        <DailyBriefing
          briefing={dailyBriefing}
          onClose={closeBriefing}
          onNavigate={view => (onNavigate ?? context?.navigate)?.(view)}
        />
      )}
    </div>
  );
}
