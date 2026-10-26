import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Particles, usePop } from "../../proscore/components/motion";
import { Dot, SceneLabel } from "../../proscore/components/ui";
import states from "../../proscore/data/states.json";
import { useNarration } from "../components/clock";

const KIND = {
  pronto: { color: "#34D399", label: "Existente" },
  parcial: { color: "#F59E0B", label: "Parcial" },
  falta: { color: "#7AA7FF", label: "A concluir na operação real" },
};
type Mod = { t: string; img?: string; k: keyof typeof KIND; s: number };
// Estado verificado no código e no ambiente de demonstração (docs/proscore/04-relatorio-evidencias.md).
const BUILT: Mod[] = [
  { t: "Cadastros", img: "mod-cadastros", k: "pronto", s: 0 },
  { t: "Operações", img: "mod-operacoes", k: "pronto", s: 0 },
  { t: "Motor de políticas", img: "cfg-politicas", k: "pronto", s: 0 },
  { t: "Carteira", img: "mod-carteira", k: "pronto", s: 0 },
  { t: "Financeiro", img: "mod-financeiro", k: "pronto", s: 0 },
  { t: "Controladoria", img: "mod-auditoria", k: "pronto", s: 0 },
  { t: "Copiloto", img: "cop-answer", k: "pronto", s: 0 },
];
const TODO: Mod[] = [
  { t: "Homologar rotinas com quem opera", k: "falta", s: 2 },
  { t: "Integrações bancárias e de dados", k: "parcial", s: 2 },
  { t: "Encerramento e substituição de títulos", k: "falta", s: 3 },
  { t: "Fluxos ajustados à estrutura real", k: "falta", s: 4 },
];

const W = 228;
const GAP = 18;
const X0 = (1920 - (BUILT.length * W + (BUILT.length - 1) * GAP)) / 2;

const Thumb: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  const m = (states as Record<string, { src: string; height: number }>)[id];
  const travel = Math.max(0, m.height * (W / 1600) - 130);
  const y = ((Math.sin(frame / 80 + id.length) + 1) / 2) * travel;
  return <Img src={staticFile(m.src)} style={{ width: W, translate: `0px ${-y}px` }} />;
};

// Cena 4: o que já está construído e o que só se conclui dentro de uma operação real.
export const F04Status: React.FC = () => {
  const { frame, at } = useNarration("f04");
  const pop = usePop();
  const shift = interpolate(frame, [at(1) - 10, at(1) + 20], [0, -90], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={20} seed="f04" />
      <SceneLabel index={4} title="Onde estamos" />
      <div style={{ position: "absolute", inset: 0, translate: `0px ${shift}px` }}>
        <div style={{ position: "absolute", top: 180, left: X0, color: colors.white, fontSize: 40, fontWeight: 700, ...pop(at(0)) }}>
          A base está construída e funcionando
        </div>
        {BUILT.map((m, i) => (
          <div key={m.t} style={{ position: "absolute", left: X0 + i * (W + GAP), top: 260, width: W, ...pop(at(0) + 20 + i * 12) }}>
            <div style={{ height: 130, borderRadius: 14, overflow: "hidden", border: `2px solid ${KIND[m.k].color}88`, background: colors.surface }}>
              <Thumb id={m.img!} />
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: colors.white, fontSize: 22, fontWeight: 700 }}>
              <Dot color={KIND[m.k].color} /> {m.t}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 520, left: X0, color: colors.white, fontSize: 40, fontWeight: 700, ...pop(at(1)) }}>
        O que <span style={{ color: colors.accent }}>só se resolve dentro de uma operação real</span>
      </div>
      <div style={{ position: "absolute", top: 600, left: X0, right: X0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {TODO.map((m, i) => (
          <div
            key={m.t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "22px 26px",
              borderRadius: 18,
              border: `2px dashed ${KIND[m.k].color}99`,
              background: "rgba(11,29,79,0.7)",
              color: colors.white,
              fontSize: 28,
              fontWeight: 700,
              ...pop(at(m.s) + 10 + (i % 2) * 14),
            }}
          >
            <Dot color={KIND[m.k].color} size={12} />
            <span style={{ flex: 1 }}>{m.t}</span>
            <span style={{ fontSize: 18, color: KIND[m.k].color, fontWeight: 700 }}>{KIND[m.k].label}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: X0, top: 880, display: "flex", gap: 30, color: colors.textSoft, fontSize: 20, opacity: interpolate(frame, [at(0) + 40, at(0) + 56], [0, 1], clamp) }}>
        {Object.values(KIND).map(k => (
          <span key={k.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Dot color={k.color} size={9} /> {k.label}
          </span>
        ))}
        <span style={{ color: colors.textFaint }}>Estado verificado no sistema em 26/10/2026</span>
      </div>
    </AbsoluteFill>
  );
};
