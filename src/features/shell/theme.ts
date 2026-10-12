// Tema claro/escuro. Arquivo sem "use client" para poder ser usado no layout (servidor).
export const THEME_KEY = "strato-theme";

/** Script inline que aplica o tema salvo antes da primeira pintura (evita piscar). */
export const themeBootScript = `(function(){try{localStorage.removeItem('${THEME_KEY}');document.documentElement.dataset.theme='light';}catch(e){document.documentElement.dataset.theme='light';}})();`;
