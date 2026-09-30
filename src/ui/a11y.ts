import type { KeyboardEvent } from "react";

/**
 * Torna acionável por mouse e teclado (Enter/Espaço) um elemento que não é um botão nativo,
 * como um item de lista clicável. Use quando trocar o elemento por <button> mudaria o layout.
 */
export function pressable(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
