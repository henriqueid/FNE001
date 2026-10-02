"use client";

/**
 * Menu completo dos módulos, agrupado (Operação, Gestão, Plataforma) e com uma linha de
 * descrição por módulo. No tablet abre como painel sob a barra superior; no celular, como
 * folha que sobe da barra inferior.
 */
import { type NavItem, navGroups } from "./navigation";

import { CloseIcon } from "@/src/ui/icons";
import { useEffect } from "react";

export function ModuleMenu({
  active,
  openCount,
  onGo,
  onClose,
}: {
  active: string;
  openCount: number;
  onGo: (item: NavItem) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <button type="button" className="lx-menu-scrim" aria-label="Fechar menu" onClick={onClose} />
      <div className="lx-module-menu" role="dialog" aria-modal="true" aria-label="Módulos do STRATO">
        <header>
          <strong>Módulos</strong>
          <button type="button" className="lx-square" aria-label="Fechar menu" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        {navGroups.map(group => (
          <section key={group.title}>
            <span className="lx-label">{group.title}</span>
            <div className="lx-module-grid">
              {group.items.map(item => (
                <button
                  key={item.label}
                  type="button"
                  className={active === item.label ? "is-active" : ""}
                  aria-current={active === item.label ? "page" : undefined}
                  onClick={() => onGo(item)}
                >
                  <span className="lx-module-icon">{item.icon}</span>
                  <span className="lx-module-text">
                    <b>{item.label}</b>
                    <small>{item.hint}</small>
                  </span>
                  {item.label === "Operações" && openCount > 0 && <i className="lx-count">{openCount}</i>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
