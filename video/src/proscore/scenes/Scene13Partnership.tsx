import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { appear, Badge, SceneLabel, Tile } from "../components/ui";

const PURPLE = "#C084FC";
const AXES = [
  { t: "Integração tecnológica", d: "informações, serviços e APIs que complementam os fluxos", s: 1 },
  { t: "Inteligência operacional", d: "casos de uso com ganhos mensuráveis de eficiência e análise", s: 2 },
  { t: "Oportunidades comerciais", d: "proposta de valor conjunta para o mercado de recebíveis", s: 3 },
];

// Cena 13: três eixos de parceria e o próximo passo concreto.
export const Scene13Partnership: React.FC = () => {
  const { frame, at } = useNarration("s13");
  const shift = interpolate(frame, [at(6) - 10, at(6) + 20], [0, -110], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={13} title="Possibilidades de parceria" />
      <Badge kind="proposal" from={10} />
      <div style={{ position: "absolute", inset: 0, translate: `0px ${shift}px` }}>
        <div style={{ position: "absolute", left: 150, top: 300, width: 330, height: 200, borderRadius: 24, display: "grid", placeItems: "center", background: "rgba(7,18,51,0.95)", border: `2px solid ${colors.accentStrong}`, ...appear(frame, at(0)) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 240 }} />
        </div>
        <div style={{ position: "absolute", right: 150, top: 300, width: 330, height: 200, borderRadius: 24, display: "grid", placeItems: "center", background: "rgba(46,16,101,0.6)", border: `2px solid ${PURPLE}`, color: colors.white, fontSize: 58, fontWeight: 800, ...appear(frame, at(0) + 10) }}>
          proScore
        </div>
        {AXES.map((a, i) => (
          <div key={a.t} style={{ position: "absolute", left: 520, width: 880, top: 260 + i * 105, ...appear(frame, at(a.s), 16, 0) }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${colors.accent}, ${PURPLE})`, width: `${interpolate(frame, [at(a.s), at(a.s) + 24], [0, 100], clamp)}%` }} />
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 30, fontWeight: 700, color: colors.white }}>{a.t}</div>
            <div style={{ textAlign: "center", fontSize: 19, color: colors.textSoft }}>{a.d}</div>
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontSize: 30, color: colors.textSoft, ...appear(frame, at(4)) }}>
          Não é um modelo fechado. É uma visão compartilhada.
        </div>
      </div>
      <Tile accent="#34D399" style={{ position: "absolute", left: 360, right: 360, top: 690, padding: "26px 34px", ...appear(frame, at(6) + 10) }}>
        <div style={{ fontSize: 19, color: "#6EE7B7", fontWeight: 700, letterSpacing: "0.12em" }}>PRÓXIMO PASSO</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>Conversa técnica para mapear serviços e APIs disponíveis</div>
        <div style={{ fontSize: 24, color: colors.textSoft, marginTop: 6 }}>Caso piloto sugerido: consulta de um sacado novo na entrada da operação</div>
      </Tile>
    </AbsoluteFill>
  );
};
