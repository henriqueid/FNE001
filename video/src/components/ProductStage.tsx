import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "./Background";

export const WINDOW = { w: 1200, h: 760 };
// Área útil da janela (coordenadas usadas pelas telas, destaques e cursor): 1136 × 600,
// com origem em (32, 96) da janela.
export const CONTENT_ORIGIN: [number, number] = [32, 96];

// Palco das cenas de produto: app desfocado ao fundo, janela nítida e câmera que aproxima
// do ponto de foco (coordenadas da janela) para guiar o olhar antes do anel de destaque.
export const ProductStage: React.FC<{
  title: string;
  focus: [number, number];
  zoom?: number;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ title, focus, zoom = 1.12, children, overlay }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { width, height, vertical, u } = useLayout();

  const base = vertical ? (width - u(80)) / WINDOW.w : u(1.02);
  const left = vertical ? u(40) : u(600);
  const top = vertical ? u(330) : (height - WINDOW.h * base) / 2 - u(10);

  const push = interpolate(frame, [0.6 * fps, durationInFrames], [1, zoom], { ...clamp, easing: ease.inOut });
  const enter = interpolate(frame, [0, 0.7 * fps], [0, 1], { ...clamp, easing: ease.out });

  return (
    <AbsoluteFill>
      <Background grid={false} />
      <BlurredShell />
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: WINDOW.w,
          height: WINDOW.h,
          transformOrigin: "0 0",
          scale: String(base),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: `${focus[0] + CONTENT_ORIGIN[0]}px ${focus[1] + CONTENT_ORIGIN[1]}px`,
            scale: String(push * (0.94 + enter * 0.06)),
            opacity: enter,
          }}
        >
          <AppWindow title={title}>{children}</AppWindow>
          {overlay}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const AppWindow: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: 26,
      overflow: "hidden",
      background: colors.surface,
      boxShadow: "0 40px 120px rgba(2, 6, 23, 0.6), 0 0 0 1px rgba(255,255,255,0.12)",
      color: colors.ink,
    }}
  >
    <div
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 24px",
        background: `linear-gradient(90deg, ${colors.navy900}, ${colors.navy800} 70%, ${colors.glow})`,
        color: colors.white,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "rgba(255,255,255,0.14)",
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        S
      </div>
      <div style={{ fontSize: 13, letterSpacing: "0.14em", opacity: 0.7, fontWeight: 600 }}>STRATO</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
    </div>
    <div style={{ position: "absolute", top: 64, left: 0, right: 0, bottom: 0, padding: 32 }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>{children}</div>
    </div>
  </div>
);

// Silhueta da aplicação ao fundo, desfocada, para dar contexto sem competir com a janela.
const BlurredShell: React.FC = () => {
  const { u } = useLayout();
  const block = (l: number, t: number, w: number, h: number, c = "rgba(255,255,255,0.75)") => (
    <div style={{ position: "absolute", left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, borderRadius: u(18), background: c }} />
  );
  return (
    <AbsoluteFill style={{ filter: `blur(${u(14)}px)`, opacity: 0.32 }}>
      <AbsoluteFill style={{ background: "#E8EDF6" }} />
      {block(0, 0, 100, 7, "#FFFFFF")}
      {block(4, 12, 30, 5, "#CBD5E1")}
      {block(4, 22, 20, 14)}
      {block(26, 22, 20, 14)}
      {block(48, 22, 20, 14)}
      {block(70, 22, 26, 14)}
      {block(4, 40, 64, 50)}
      {block(70, 40, 26, 50)}
      {block(80, 12, 16, 5, colors.accentStrong)}
    </AbsoluteFill>
  );
};
