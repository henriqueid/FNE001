import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Beam, ImpactMoment, Particles, usePop } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const PURPLE = "#C084FC";
const TEAL = "#2DD4BF";
// Nomes em texto simples: sem logotipos ou identidade visual de terceiros.
const NODES = [
  { area: "Dados e crédito", name: "proScore", d: "cadastro · crédito · risco · compliance", x: 470, y: 300, s: 2, c: PURPLE },
  { area: "Formalização", name: "Flixsign", d: "assinatura e formalização de operações", x: 1450, y: 300, s: 3, c: TEAL },
  { area: "Infraestrutura", name: "Bancos · registradoras · custodiantes", d: "outros players do mercado", x: 1450, y: 720, s: 4, c: colors.warn },
  { area: "Operação", name: "FIDCs e securitizadoras", d: "homologação · piloto · referência", x: 470, y: 720, s: 5, c: colors.decide },
];

// Cena 5: o STRATO no centro de um ecossistema de parceiros, cada um em uma etapa da operação.
export const F05Ecosystem: React.FC = () => {
  const { frame, at, fps } = useNarration("f05");
  const pop = usePop();
  const hub = spring({ frame: frame - at(0), fps, config: { damping: 13 } });
  const orbit = frame / 120;
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={30} seed="f05" />
      <SceneLabel index={5} title="Ecossistema de parceiros" />
      <Badge kind="partners" from={at(1)} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map(r => (
          <ellipse key={r} cx={960} cy={510} rx={260 + r * 170} ry={150 + r * 100} fill="none" stroke={colors.accent} strokeOpacity={0.12 * hub} strokeDasharray="4 12" strokeDashoffset={frame * (r % 2 ? 0.5 : -0.5)} />
        ))}
        {NODES.map((n, i) => (
          <Beam key={n.name} x1={960} y1={510} x2={n.x} y2={n.y} at={at(n.s)} color={n.c} period={60 + i * 8} width={3} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 960, top: 510, transform: "translate(-50%, -50%)" }}>
        <div style={{ padding: "26px 36px", borderRadius: 28, background: "rgba(4,10,28,0.92)", border: `2px solid ${colors.accentStrong}`, boxShadow: `0 0 ${50 + 20 * Math.sin(frame / 12)}px ${colors.accentStrong}88`, opacity: hub, scale: String(0.6 + hub * 0.4) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 300, display: "block" }} />
        </div>
      </div>
      {NODES.map((n, i) => {
        const float = Math.sin(orbit * 3 + i * 1.6) * 8;
        return (
          <div key={n.name} style={{ position: "absolute", left: n.x, top: n.y + float, transform: "translate(-50%, -50%)" }}>
            <div
              style={{
                width: 470,
                padding: "22px 26px",
                borderRadius: 22,
                background: "rgba(7,18,51,0.94)",
                border: `2px solid ${n.c}`,
                boxShadow: `0 0 40px ${n.c}44`,
                textAlign: "center",
                ...pop(at(n.s) + 10, { from: 0.6 }),
              }}
            >
              <div style={{ color: n.c, fontSize: 19, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>{n.area}</div>
              <div style={{ color: colors.white, fontSize: n.name.length > 20 ? 30 : 44, fontWeight: 800, marginTop: 6, lineHeight: 1.1 }}>{n.name}</div>
              <div style={{ color: colors.textSoft, fontSize: 21, marginTop: 8 }}>{n.d}</div>
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", color: colors.white, fontSize: 40, fontWeight: 700, opacity: interpolate(frame, [at(0), at(0) + 14], [0, 1], clamp) * interpolate(frame, [at(6) - 6, at(6)], [1, 0], clamp) }}>
        Crescer em <span style={{ color: colors.accent }}>ecossistema</span>
      </div>
      <ImpactMoment at={at(6) + 30} lines={["Plataforma número 1", "do mercado de recebíveis."]} />
    </AbsoluteFill>
  );
};
