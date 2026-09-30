// Tema claro/escuro. Arquivo sem "use client" para poder ser usado no layout (servidor).
export const THEME_KEY = "strato-theme";

/** Script inline que aplica o tema salvo antes da primeira pintura (evita piscar). */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;
