// Padrão visual dos vídeos STRATO. Toda cor, tempo e tamanho usado nas cenas sai daqui.
import { Easing } from "remotion";

export const colors = {
  navy950: "#040A1C",
  navy900: "#071233",
  navy800: "#0B1D4F",
  glow: "#1D4ED8",
  accent: "#7AA7FF",
  accentStrong: "#3B6BFF",
  decide: "#34D399",
  alert: "#F87171",
  warn: "#F59E0B",
  white: "#FFFFFF",
  textSoft: "rgba(226, 232, 255, 0.72)",
  textFaint: "rgba(226, 232, 255, 0.38)",
  ink: "#0F172A",
  inkSoft: "#475569",
  inkFaint: "#94A3B8",
  line: "#E2E8F0",
  surface: "#F8FAFC",
  card: "#FFFFFF",
  captionBg: "rgba(14, 28, 74, 0.86)",
  captionBorder: "rgba(122, 167, 255, 0.28)",
};

export const fontFamily = "Urbanist, sans-serif";

// Curvas únicas para toda a peça: entrada suave e mola sem rebote.
export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Durações em segundos; converter com fps dentro das cenas.
export const timing = {
  crossfade: 0.4,
  captionIn: 0.5,
  wordStagger: 0.06,
  highlightDelay: 1.1,
};
