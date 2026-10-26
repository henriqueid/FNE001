import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { Beam, Particles, usePop } from "../components/motion";
import { Badge, SceneLabel, Tile } from "../components/ui";

const PURPLE = "#C084FC";
const AXES = [
  { t: "Integração tecnológica", d: "informações, serviços e APIs que complementam os fluxos", s: 1 },
  { t: "Inteligência operacional", d: "casos de uso com ganhos mensuráveis de eficiência e análise", s: 2 },
  { t: "Oportunidades comerciais", d: "proposta de valor conjunta para o mercado de recebíveis", s: 3 },
];

// Cena 13: três eixos de parceria percorridos por luz e o próximo passo concreto.
export const Scene13Partnership: React.FC = () => {
  const { frame, at } = useNarration("s13");
  const pop = usePop();
  const lift = interpolate(frame, [at(6) - 10, at(6) + 24], [0, -120], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={28} seed="s13" />
      <SceneLabel index={13} title="Possibilidades de parceria" />
      <Badge kind="proposal" from={10} />
      <div style={{ position: "absolute", inset: 0, translate: `0px ${lift}px` }}>
        <div style={{ position: "absolute", left: 120, top: 300, width: 340, height: 210, borderRadius: 26, display: "grid", placeItems: "center", background: "rgba(7,18,51,0.95)", border: `2px solid ${colors.accentStrong}`, boxShadow: `0 0 50px ${colors.accentStrong}55`, ...pop(at(0), { dx: -120, dy: 0 }) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 250 }} />
        </div>
        <div style={{ position: "absolute", right: 120, top: 300, width: 340, height: 210, borderRadius: 26, display: "grid", placeItems: "center", background: "rgba(46,16,101,0.65)", border: `2px solid ${PURPLE}`, boxShadow: `0 0 50px ${PURPLE}55`, color: colors.white, fontSize: 60, fontWeight: 700, ...pop(at(0) + 10, { dx: 120, dy: 0 }) }}>
          proScore
        </div>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {AXES.map((a, i) => (
            <Beam key={a.t} x1={462} y1={330 + i * 75} x2={1458} y2={330 + i * 75} at={at(a.s)} color={i === 1 ? PURPLE : colors.accent} period={70 + i * 10} width={2.5} />
          ))}
        </svg>
        {AXES.map((a, i) => (
          <div key={a.t} style={{ position: "absolute", left: 520, width: 880, top: 284 + i * 75, textAlign: "center", ...pop(at(a.s) + 8, { dy: 16 }) }}>
            <span style={{ padding: "4px 18px", borderRadius: 10, background: "rgba(4,10,28,0.9)", fontSize: 30, fontWeight: 700, color: colors.white }}>{a.t}</span>
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontSize: 32, color: colors.textSoft, ...pop(at(4)) }}>
          Não é um modelo fechado. É uma visão compartilhada.
        </div>
      </div>
      <div style={{ position: "absolute", left: 330, right: 330, top: 640, ...pop(at(6) + 10, { dy: 60 }) }}>
        <Tile accent="#34D399" style={{ padding: "28px 36px", boxShadow: `0 0 50px rgba(52,211,153,0.25)` }}>
          <div style={{ fontSize: 20, color: "#6EE7B7", fontWeight: 700, letterSpacing: "0.12em" }}>PRÓXIMO PASSO</div>
          <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>Conversa técnica para mapear serviços e APIs disponíveis</div>
          <div style={{ fontSize: 25, color: colors.textSoft, marginTop: 6 }}>Caso piloto sugerido: consulta de um sacado novo na entrada da operação</div>
        </Tile>
      </div>
    </AbsoluteFill>
  );
};
