"use client";

/**
 * Moldura da aplicação. Desktop: barra Ledger v10 com módulos em ícones.
 * Tablet e celular preservam o menu completo e os atalhos inferiores.
 */
import { CommandPalette } from "./command-palette";
import { ModuleMenu } from "./module-menu";
import { type NavItem, bottomNav, desktopNav, visibleNavigation } from "./navigation";
import { NotificationsPopover, isOpen, operationSignals } from "./notifications";
import { type AppView, ShellContext } from "./shell-context";
import { useTheme } from "./use-theme";
import { UserMenu } from "./user-menu";
import { ExperienceGuide } from "./experience-guide";
import { DailyBriefing } from "@/src/features/copilot/daily-briefing";
import { type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { can, type AccessUser } from "@/src/domain/access/model";
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
import { AttentionCenter } from "@/src/features/copilot/attention-center";
import { type ManagedTask, type TaskCommand } from "@/src/domain/tasks/model";
import { type IntelligenceState } from "@/src/domain/intelligence/model";

import { BellIcon, CloseIcon, MenuIcon, SearchIcon } from "@/src/ui/icons";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export { initials } from "./user-menu";

const viewBySection: Record<string, AppView> = {
  "Visão geral": "home",
  Operações: "operations",
  Controladoria: "controlleria",
  Carteira: "portfolio",
  Comercial: "commercial",
  Financeiro: "finance",
  Cadastros: "registry",
  Configurações: "settings",
};

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
  intelligence,
  dailyBriefing,
  attentionItems,
  taskItems,
  onTaskCommand,
  briefingReady = false,
  previewedBy,
  onEndPreview,
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
  currentUser: AccessUser;
  intelligence: IntelligenceState;
  dailyBriefing: DailyBriefingData;
  attentionItems: AttentionItem[];
  taskItems: ManagedTask[];
  onTaskCommand: (id: string, command: TaskCommand) => void;
  briefingReady?: boolean;
  previewedBy?: string;
  onEndPreview?: () => void;
}) {
  const context = useContext(ShellContext);
  const { preference, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionSelectedId, setAttentionSelectedId] = useState<string>();
  const [taskTabs, setTaskTabs] = useState<AttentionItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [taskOrigin, setTaskOrigin] = useState<{ label: string; view: AppView }>();
  const operations = useMemo(() => context?.operations ?? [], [context?.operations]);
  const openCount = operationCount ?? operations.filter(isOpen).length;
  const signals = useMemo(() => operationSignals(operations), [operations]);
  const desktopItems = useMemo(() => visibleNavigation(desktopNav, currentUser), [currentUser]);
  const bottomItems = useMemo(() => visibleNavigation(bottomNav, currentUser), [currentUser]);
  const openAttention = useCallback((itemId?: string) => {
    setBriefingOpen(false);
    setBellOpen(false);
    setAttentionSelectedId(itemId);
    setAttentionOpen(true);
  }, []);
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
  const activateTask = (item: AttentionItem) => {
    setActiveTaskId(item.id);
    if (item.operation) context?.openOperation(item.operation);
    else (onNavigate ?? context?.navigate)?.(item.view);
  };
  const openTask = (item: AttentionItem) => {
    setTaskOrigin(origin => origin ?? { label: active, view: viewBySection[active] ?? "operations" });
    setTaskTabs(current => (current.some(tab => tab.id === item.id) ? current : [...current, item]));
    setAttentionOpen(false);
    activateTask(item);
  };
  const returnToOrigin = () => {
    setActiveTaskId(undefined);
    (onNavigate ?? context?.navigate)?.(taskOrigin?.view ?? "home");
  };
  const closeTask = (id: string) => {
    const remaining = taskTabs.filter(tab => tab.id !== id);
    setTaskTabs(remaining);
    if (activeTaskId !== id) return;
    const next = remaining.at(-1);
    if (next) activateTask(next);
    else returnToOrigin();
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
            {desktopItems.map(item => (
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
                aria-label={`Alertas: ${attentionItems.length}`}
                aria-expanded={bellOpen}
                onClick={() => setBellOpen(open => !open)}
              >
                <span className="lx-action-icon">
                  <BellIcon />
                  {attentionItems.length > 0 && <i className="sx-dot">{attentionItems.length}</i>}
                </span>
              </button>
              {bellOpen && (
                <NotificationsPopover
                  items={attentionItems}
                  onClose={() => setBellOpen(false)}
                  onInspect={item => openAttention(item.id)}
                  onSeeAll={() => openAttention()}
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
              canOpenSettings={can(currentUser, "settings:manage")}
            />
          </div>
        </header>
        {previewedBy && onEndPreview && (
          <div className="sx-access-preview" role="status">
            <span>
              <b>Visão simulada:</b> você está conferindo o sistema como {currentUser.name}.
            </span>
            <button type="button" onClick={onEndPreview}>
              Voltar para {previewedBy}
            </button>
          </div>
        )}
        {taskTabs.length > 0 && (
          <nav className="sx-task-tabs" aria-label="Abas de trabalho">
            <button
              type="button"
              role="tab"
              aria-selected={!activeTaskId}
              className={!activeTaskId ? "is-active" : ""}
              onClick={returnToOrigin}
            >
              <span>{taskOrigin?.label ?? "Tela anterior"}</span>
            </button>
            {taskTabs.map(item => (
              <div key={item.id} className={activeTaskId === item.id ? "is-active" : ""}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTaskId === item.id}
                  onClick={() => activateTask(item)}
                >
                  <i data-tone={item.tone} />
                  <span>{item.title}</span>
                </button>
                <button type="button" aria-label={`Fechar aba ${item.title}`} onClick={() => closeTask(item.id)}>
                  <CloseIcon />
                </button>
              </div>
            ))}
          </nav>
        )}
        {menuOpen && (
          <ModuleMenu active={active} openCount={openCount} onGo={go} onClose={closeMenu} user={currentUser} />
        )}
        <ExperienceGuide
          showJourney={showJourney}
          active={active}
          operations={operations}
          signals={signals}
          dailyBriefing={dailyBriefing}
          attentionItems={attentionItems}
          currentUser={currentUser}
          intelligence={intelligence}
          onOpenAttention={openAttention}
          onNavigate={view => (onNavigate ?? context?.navigate)?.(view)}
        />
        <main className="sx-content">{children}</main>
      </div>
      <nav className="sx-bottom-nav" aria-label="Navegação rápida">
        {bottomItems.map(item => (
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
          user={currentUser}
        />
      )}
      {briefingOpen && (
        <DailyBriefing
          briefing={dailyBriefing}
          onClose={closeBriefing}
          onNavigate={view => (onNavigate ?? context?.navigate)?.(view)}
          onOpenAttention={() => openAttention()}
        />
      )}
      {attentionOpen && (
        <AttentionCenter
          items={taskItems}
          briefing={dailyBriefing}
          currentUser={currentUser}
          initialItemId={attentionSelectedId}
          onClose={() => setAttentionOpen(false)}
          onOpenTask={openTask}
          onTaskCommand={onTaskCommand}
        />
      )}
    </div>
  );
}
