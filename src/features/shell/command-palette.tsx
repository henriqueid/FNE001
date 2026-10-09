"use client";

/**
 * Busca global (Ctrl K ou /): operações, módulos e ações, com navegação por teclado.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { allNav } from "./navigation";
import { isOpen } from "./notifications";
import { type AppView } from "./shell-context";
import { type ThemePreference } from "./use-theme";
import {
  ActivityIcon,
  CloseIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  ReturnIcon,
  SearchIcon,
  SlidersIcon,
  SunIcon,
  UndoIcon,
} from "@/src/ui/icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type PaletteItem = {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: ReactNode;
  run: () => void;
  keywords: string;
};

export function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette({
  operations,
  themePreference,
  onTheme,
  onClose,
  onNavigate,
  onOpen,
  onNew,
  onSettings,
  onReset,
}: {
  operations: Operation[];
  themePreference: ThemePreference;
  onTheme: (value: ThemePreference) => void;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onOpen: (operation: Operation) => void;
  onNew: () => void;
  onSettings: () => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = normalize(query.trim());
    const digits = query.replace(/\D/g, "");
    const opItems: PaletteItem[] = operations
      .filter(operation => {
        if (!q) return isOpen(operation);
        const haystack = normalize(
          [
            operation.cedent,
            operation.vehicle,
            operation.institution,
            operation.aditivoNumber,
            operation.borderoNumber,
            operation.proposal,
            operation.status,
            operation.owner,
            operation.source ?? "",
            stages.find(item => item.id === operation.stage)?.short ?? "",
          ].join(" "),
        );
        return (
          haystack.includes(q) ||
          (digits.length >= 3 &&
            [operation.document, operation.aditivoNumber, operation.borderoNumber].some(value =>
              (value ?? "").replace(/\D/g, "").includes(digits),
            ))
        );
      })
      .slice(0, q ? 8 : 5)
      .map(operation => ({
        id: operation.id,
        group: q ? "Operações" : "Operações em andamento",
        icon: <ActivityIcon />,
        keywords: "",
        label: `${operation.cedent}`,
        detail: `Aditivo ${operation.aditivoNumber} · Borderô ${operation.borderoNumber} · ${stages.find(item => item.id === operation.stage)?.short ?? ""} · ${money.format(operation.amount)}`,
        run: () => onOpen(operation),
      }));
    const navItems: PaletteItem[] = allNav
      .filter(item => item.view)
      .map(item => ({
        id: `nav-${item.view}`,
        group: "Ir para",
        label: item.label,
        detail: item.hint,
        icon: item.icon,
        keywords: normalize(`${item.label} ${item.hint}`),
        run: () => onNavigate(item.view!),
      }));
    const actions: PaletteItem[] = [
      {
        id: "new",
        group: "Ações",
        label: "Nova operação",
        detail: "Escolher cedente, origem e destino",
        icon: <PlusIcon />,
        keywords: "nova operacao criar bordero",
        run: onNew,
      },
      {
        id: "theme-light",
        group: "Ações",
        label: "Tema claro",
        detail: themePreference === "light" ? "Em uso" : undefined,
        icon: <SunIcon />,
        keywords: "tema claro light aparencia",
        run: () => onTheme("light"),
      },
      {
        id: "theme-dark",
        group: "Ações",
        label: "Tema escuro",
        detail: themePreference === "dark" ? "Em uso" : undefined,
        icon: <MoonIcon />,
        keywords: "tema escuro dark aparencia",
        run: () => onTheme("dark"),
      },
      {
        id: "theme-system",
        group: "Ações",
        label: "Tema do sistema",
        detail: themePreference === "system" ? "Em uso" : undefined,
        icon: <MonitorIcon />,
        keywords: "tema sistema automatico aparencia",
        run: () => onTheme("system"),
      },
      {
        id: "settings",
        group: "Ações",
        label: "Preferências da interface",
        icon: <SlidersIcon />,
        keywords: "configuracoes preferencias explicacoes",
        run: onSettings,
      },
      {
        id: "reset",
        group: "Ações",
        label: "Restaurar dados de demonstração",
        icon: <UndoIcon />,
        keywords: "restaurar reset demonstracao limpar",
        run: onReset,
      },
    ];
    const match = (item: PaletteItem) => !q || item.keywords.includes(q) || normalize(item.label).includes(q);
    return [...opItems, ...navItems.filter(match), ...actions.filter(match)];
  }, [operations, query, themePreference, onNavigate, onOpen, onNew, onSettings, onReset, onTheme]);

  const safeCursor = Math.min(cursor, Math.max(0, items.length - 1));
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeCursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeCursor]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor(Math.min(items.length - 1, safeCursor + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(Math.max(0, safeCursor - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[safeCursor]?.run();
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  };

  let lastGroup = "";
  // Fundo clicável fecha a busca; o teclado é tratado no diálogo (Esc, setas e Enter).
  return (
    <div
      className="sx-palette-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div className="sx-palette" role="dialog" aria-modal="true" aria-label="Busca global" onKeyDown={onKeyDown}>
        <div className="sx-palette-input">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="Aditivo, borderô, cedente, CNPJ, veículo, etapa ou módulo…"
            aria-label="Buscar"
            aria-controls="sx-palette-list"
          />
          <button type="button" className="sx-icon-btn" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>
        <ul id="sx-palette-list" ref={listRef} role="listbox">
          {items.length === 0 && <li className="sx-palette-empty">Nada encontrado para “{query}”.</li>}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id}>
                {header && <span className="sx-palette-group">{header}</span>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === safeCursor}
                  data-index={index}
                  className={index === safeCursor ? "is-active" : ""}
                  onMouseMove={() => setCursor(index)}
                  onClick={item.run}
                >
                  <span className="sx-palette-icon">{item.icon}</span>
                  <span className="sx-palette-text">
                    <b>{item.label}</b>
                    {item.detail && <small>{item.detail}</small>}
                  </span>
                  {index === safeCursor && <ReturnIcon className="sx-palette-enter" />}
                </button>
              </li>
            );
          })}
        </ul>
        <footer>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> fechar
          </span>
        </footer>
      </div>
    </div>
  );
}
