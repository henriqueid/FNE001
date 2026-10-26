import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ScreenCapture } from "../components/ScreenCapture";
import { appear, Badge, Dot, Impact, SceneLabel } from "../components/ui";
import { INTEGRATION_MAP } from "../data/integrationMap";

const PURPLE = "#C084FC";

// Cena 08: módulo a módulo, onde a proScore agregaria e qual encaixe já existe no STRATO.
export const Scene08IntegrationMap: React.FC = () => {
  const { frame, at } = useNarration("s08");
  const realAt = at(8);
  const ringFade = interpolate(frame, [realAt - 6, realAt + 12], [1, 0], clamp);
  const cx = 960;
  const cy = 520;
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={8} title="Mapa de integrações" />
      <AbsoluteFill style={{ opacity: ringFade }}>
        <Badge kind="proposal" from={10} />
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {INTEGRATION_MAP.map((m, i) => {
            const a = (i / INTEGRATION_MAP.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * 640;
            const y = cy + Math.sin(a) * 320;
            const active = frame >= at(i + 1);
            return <line key={m.module} x1={cx} y1={cy} x2={x} y2={y} stroke={active ? PURPLE : "rgba(255,255,255,0.12)"} strokeWidth={active ? 2.5 : 1.5} strokeDasharray="8 8" />;
          })}
        </svg>
        <div
          style={{
            position: "absolute",
            left: cx - 150,
            top: cy - 70,
            width: 300,
            height: 140,
            borderRadius: 24,
            display: "grid",
            placeItems: "center",
            background: "rgba(7,18,51,0.95)",
            border: `2px solid ${colors.accentStrong}`,
            boxShadow: "0 0 60px rgba(59,107,255,0.4)",
            ...appear(frame, at(0)),
          }}
        >
          <Img src={staticFile("strato-logo.png")} style={{ width: 220 }} />
        </div>
        {INTEGRATION_MAP.map((m, i) => {
          const a = (i / INTEGRATION_MAP.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 640;
          const y = cy + Math.sin(a) * 320;
          const start = at(i + 1);
          const current = frame >= start && frame < at(i + 2);
          return (
            <div
              key={m.module}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 430,
                transform: "translate(-50%, -50%)",
                padding: "16px 20px",
                borderRadius: 18,
                background: current ? "rgba(46,16,101,0.95)" : "rgba(11,29,79,0.92)",
                border: `1px solid ${current ? PURPLE : "rgba(192,132,252,0.35)"}`,
                boxShadow: current ? `0 0 0 3px ${PURPLE}55` : "0 14px 40px rgba(2,6,23,0.4)",
                color: colors.white,
                ...appear(frame, start, 14, 14),
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800 }}>{m.module}</div>
              <div style={{ fontSize: 19, color: "#E9D5FF", marginTop: 4 }}>{m.adds}</div>
              <div style={{ fontSize: 17, color: colors.textSoft, marginTop: 8, display: "flex", gap: 8, alignItems: "baseline" }}>
                <Dot color={m.hookState === "existente" ? "#34D399" : m.hookState === "demonstração" ? "#F59E0B" : "#7AA7FF"} size={8} />
                <span>
                  <b style={{ color: colors.white }}>Encaixe hoje:</b> {m.hook}
                </span>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - ringFade }}>
        <Badge kind="real" from={realAt} />
        <ScreenCapture
          enterAt={realAt}
          images={[{ src: "proscore/screens/integracoes.jpg", at: 0 }]}
          camera={[
            { at: 0, rect: [280, 230, 1320, 660] },
            { at: realAt + 90, rect: [280, 600, 1320, 330] },
          ]}
          marks={[
            { at: realAt + 30, end: realAt + 100, rect: [300, 352, 330, 22] },
            { at: realAt + 110, rect: [296, 648, 1284, 236], color: PURPLE },
          ]}
          view={{ x: 230, y: 110, w: 1460, h: 740 }}
        />
      </AbsoluteFill>
      <Impact lines={["Uma plataforma.", "Múltiplas oportunidades de inteligência."]} at={realAt + 200} />
    </AbsoluteFill>
  );
};
