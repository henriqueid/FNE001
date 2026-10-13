/**
 * Paleta do vídeo, espelhando o app:
 * - conteúdo: tokens do Visual Ledger (app/styles/design-system.css, tema claro);
 * - marca do Copiloto "STRATO Intelligence": degradê azul-marinho, brilhos azul/índigo e avatar
 *   branco→azul-claro (app/styles/ledger.css, "Copiloto · experience v3", Central do Dia e abertura diária).
 */
export const theme = {
  font: '"Urbanist Variable", "Urbanist", system-ui, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Consolas, monospace',

  // Ledger (conteúdo)
  canvas: "#ececec",
  surface: "#f7f7f7",
  elev: "#ffffff",
  surface2: "#f2f2f2",
  surface3: "#e6e6e6",
  border: "#dedede",
  borderStrong: "#d3d3d3",
  text: "#0d0d0d",
  text2: "#3f3f3f",
  text3: "#5c5c5c",
  ink: "#111827",
  inkText: "#ffffff",
  mint: "#75f890",
  mintInk: "#0b3d17",

  // STRATO Intelligence (marca do Copiloto)
  navy: "#07111f",
  slate: "#0f172a",
  blue: "#2563eb",
  blueDeep: "#1d4ed8",
  blueLight: "#60a5fa",
  blueMist: "#bfdbfe",
  kicker: "rgb(191 219 254 / 85%)",
  onNavy: "rgb(226 232 240 / 80%)",
  headGradient: [
    "radial-gradient(circle at 12% -80%, rgb(96 165 250 / 62%), transparent 48%)",
    "radial-gradient(circle at 86% 160%, rgb(79 70 229 / 34%), transparent 52%)",
    "linear-gradient(118deg, #07111f 0%, #102d55 65%, #242478 100%)",
  ].join(", "),
  stageGradient: [
    "radial-gradient(circle at 15% -20%, rgb(96 165 250 / 45%), transparent 45%)",
    "radial-gradient(circle at 85% 115%, rgb(79 70 229 / 45%), transparent 50%)",
    "linear-gradient(118deg, #07111f 0%, #102d55 62%, #242478 100%)",
  ].join(", "),
  tileGradient: "linear-gradient(145deg, #0f172a, #2563eb)",
  avatarGradient: "linear-gradient(145deg, #ffffff 0%, #bfdbfe 100%)",
  launcherGradient:
    "radial-gradient(circle at 30% 20%, rgb(96 165 250 / 56%), transparent 34%), linear-gradient(145deg, #07111f, #17315c)",
  progressGradient: "linear-gradient(90deg, #111827, #60a5fa)",

  // Estados (Central do Dia)
  critical: "#dc2626",
  criticalSoft: "rgb(220 38 38 / 10%)",
  warning: "#d97706",
  warningSoft: "rgb(217 119 6 / 11%)",
  good: "#16865c",
  goodSoft: "rgb(22 134 92 / 10%)",
  live: "#4ade80",

  shadowPanel: "0 32px 90px rgb(15 23 42 / 24%), 0 8px 28px rgb(15 23 42 / 13%)",
  shadowSoft: "0 8px 24px rgb(15 23 42 / 6%)",
};

export const FPS = 30;
