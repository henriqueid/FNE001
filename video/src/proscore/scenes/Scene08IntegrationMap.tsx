import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen } from "../components/LiveScreen";
import { ImpactMoment, Particles, usePop } from "../components/motion";
import { Badge, Dot, SceneLabel } from "../components/ui";
import { INTEGRATION_MAP } from "../data/integrationMap";

const PURPLE = "#C084FC";

// Cena 08: módulo a módulo, onde a proScore agregaria e qual encaixe já existe no STRATO.
export const Scene08IntegrationMap: React.FC = () => {
  const { frame, at } = useNarration("s08");
  const realAt = at(8);
  const pop = usePop();
  const ringFade = interpolate(frame, [realAt - 6, realAt + 12], [1, 0], clamp);
  const cx = 960;
  const cy = 520;
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={26} seed="s08" color="#C084FC" />
      <SceneLabel index={8} title="Mapa de integrações" />
      <AbsoluteFill style={{ opacity: ringFade }}>
        <Badge kind="proposal" from={10} />
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {INTEGRATION_MAP.map((m, i) => {
            const a = (i / INTEGRATION_MAP.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * 640;
            const y = cy + Math.sin(a) * 320;
            const active = frame >= at(i + 1);
            const k = ((frame + i * 9) % 45) / 45;
            return (
              <g key={m.module}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke={active ? PURPLE : "rgba(255,255,255,0.12)"} strokeWidth={active ? 2.5 : 1.5} strokeDasharray="8 8" strokeDashoffset={-frame * 0.8} />
                {active ? <circle cx={cx + (x - cx) * k} cy={cy + (y - cy) * k} r={6} fill={PURPLE} style={{ filter: `drop-shadow(0 0 6px ${PURPLE})` }} /> : null}
              </g>
            );
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
            ...pop(at(0), { from: 0.5 }),
          }}
        >
          <Img src={staticFile("strato-logo.png")} style={{ width: 220 }} />
        </div>
        {INTEGRATION_MAP.map((m, i) => {
          const a = (i / INTEGRATION_MAP.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 650;
          const y = cy + Math.sin(a) * 330;
          const start = at(i + 1);
          const current = frame >= start && frame < at(i + 2);
          return (
            <div
              key={m.module}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 500,
                transform: "translate(-50%, -50%)",
                padding: "16px 20px",
                borderRadius: 18,
                background: current ? "rgba(46,16,101,0.95)" : "rgba(11,29,79,0.92)",
                border: `1px solid ${current ? PURPLE : "rgba(192,132,252,0.35)"}`,
                boxShadow: current ? `0 0 0 3px ${PURPLE}55` : "0 14px 40px rgba(2,6,23,0.4)",
                color: colors.white,
                ...pop(start, { from: 0.7, dy: 0 }),
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 800 }}>{m.module}</div>
              <div style={{ fontSize: 23, color: "#E9D5FF", marginTop: 4, lineHeight: 1.25 }}>{m.adds}</div>
              <div style={{ fontSize: 20, color: colors.textSoft, marginTop: 8, display: "flex", gap: 8, alignItems: "baseline", lineHeight: 1.25 }}>
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
        <LiveScreen
          enterAt={realAt}
          shots={[{ at: 0, state: "cfg-integracoes" }]}
          camera={[
            { at: 0, rect: [280, 230, 1320, 693] },
            { at: realAt + 80, rect: [280, 560, 1320, 693], dur: 1.4 },
          ]}
          cursor={[
            { at: realAt + 16, x: 900, y: 500 },
            { at: realAt + 40, ...aim("cfg-integracoes.resumo", 3.2, 0.5), dur: 0.9 },
            { at: realAt + 110, ...aim("cfg-integracoes.bureau", 0.3, 4), dur: 1.0 },
            { at: realAt + 150, ...aim("cfg-integracoes.protestos", 0.3, 4), dur: 0.8 },
            { at: realAt + 190, ...aim("cfg-integracoes.pep", 0.3, 4), dur: 0.8 },
          ]}
          marks={[
            { at: realAt + 30, end: realAt + 100, rect: [296, 352, 400, 24] },
            { at: realAt + 100, rect: [296, 648, 1284, 236], color: PURPLE },
          ]}
        />
      </AbsoluteFill>
      <ImpactMoment at={realAt + 230} lines={["Uma plataforma.", "Múltiplas oportunidades de inteligência."]} />
    </AbsoluteFill>
  );
};
