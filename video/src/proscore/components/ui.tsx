import { interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";

// Peças visuais compartilhadas pelas cenas dos vídeos STRATO × proScore e STRATO × Financia.

export const status = {
  real: { label: "Tela real · ambiente de demonstração", color: "#34D399" },
  partial: { label: "Recurso parcial · em evolução", color: "#F59E0B" },
  vision: { label: "Visão de evolução", color: "#7AA7FF" },
  proposal: { label: "Integração proposta · sujeita a validação", color: "#C084FC" },
  simulation: { label: "Simulação ilustrativa · dados sintéticos", color: "#94A3B8" },
  partners: { label: "Parcerias que estamos buscando · não firmadas", color: "#C084FC" },
  offer: { label: "Proposta STRATO · condições desta parceria", color: "#38BDF8" },
} as const;
export type StatusKey = keyof typeof status;

/** Aparece (opacidade + leve subida) a partir do frame `at`. */
export const appear = (frame: number, at: number, dur = 14, dy = 18) => ({
  opacity: interpolate(frame, [at, at + dur], [0, 1], clamp),
  translate: interpolate(frame, [at, at + dur + 6], [`0px ${dy}px`, "0px 0px"], { ...clamp, easing: ease.out }),
});

/** Selo de veracidade no canto superior direito. */
export const Badge: React.FC<{ kind: StatusKey; from?: number }> = ({ kind, from = 0 }) => {
  const frame = useCurrentFrame();
  const s = status[kind];
  return (
    <div
      style={{
        position: "absolute",
        top: 34,
        right: 48,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 18px",
        borderRadius: 999,
        background: "rgba(7, 18, 51, 0.82)",
        border: `1px solid ${s.color}66`,
        color: colors.white,
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: "0.02em",
        opacity: interpolate(frame, [from, from + 12], [0, 1], clamp),
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
      {s.label}
    </div>
  );
};

/** Rótulo de capítulo no canto superior esquerdo. */
export const SceneLabel: React.FC<{ index: number; title: string }> = ({ index, title }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 36,
        left: 56,
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: colors.textSoft,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        opacity: interpolate(frame, [4, 18], [0, 1], clamp),
      }}
    >
      <span style={{ color: colors.accent }}>{String(index).padStart(2, "0")}</span>
      <span style={{ width: 28, height: 2, background: colors.accent, opacity: 0.6 }} />
      {title}
    </div>
  );
};

/** Frase de destaque (texto de impacto), centralizada ou ancorada. */
export const Impact: React.FC<{
  lines: [string, string?];
  at: number;
  position?: "center" | "bottom";
}> = ({ lines, at, position = "bottom" }) => {
  const frame = useCurrentFrame();
  const a = appear(frame, at, 18, 26);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...(position === "center" ? { top: 0, bottom: 0 } : { bottom: 150 }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...a,
          padding: "26px 44px",
          borderRadius: 26,
          background: "rgba(7, 18, 51, 0.9)",
          border: `1px solid ${colors.captionBorder}`,
          boxShadow: "0 30px 90px rgba(2,6,23,0.6)",
          textAlign: "center",
          fontSize: 50,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: colors.white,
        }}
      >
        {lines[0]}
        {lines[1] ? (
          <>
            {" "}
            <span style={{ color: colors.accent }}>{lines[1]}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};

/** Cartão escuro genérico para diagramas. */
export const Tile: React.FC<{
  style?: React.CSSProperties;
  accent?: string;
  children: React.ReactNode;
}> = ({ style, accent = colors.accent, children }) => (
  <div
    style={{
      padding: "18px 22px",
      borderRadius: 18,
      background: "linear-gradient(180deg, rgba(20,36,92,0.92), rgba(9,20,56,0.92))",
      border: `1px solid ${accent}55`,
      boxShadow: `0 18px 50px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`,
      color: colors.white,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Dot: React.FC<{ color: string; size?: number }> = ({ color, size = 10 }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
);
