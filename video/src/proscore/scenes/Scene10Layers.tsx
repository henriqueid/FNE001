import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { Particles, usePop } from "../components/motion";
import { Badge, Dot, SceneLabel, Tile } from "../components/ui";

const STATE = {
  existente: { c: "#34D399", l: "Existente" },
  parcial: { c: "#F59E0B", l: "Parcial · em evolução" },
  proposta: { c: "#C084FC", l: "Integração proposta" },
};
// De baixo para cima; cada camada entra com a frase que a descreve.
const LAYERS: { title: string; sub: string; state: keyof typeof STATE; sentence: number }[] = [
  { title: "Dados operacionais", sub: "clientes, sacados, títulos, pagamentos, atrasos e negociações", state: "existente", sentence: 1 },
  { title: "Inteligência histórica da carteira", sub: "memória factual e indicadores comportamentais", state: "existente", sentence: 2 },
  { title: "Dados e sinais externos", sub: "informações cadastrais, creditícias e sinais de risco", state: "proposta", sentence: 3 },
  { title: "Políticas e motores determinísticos", sub: "regras e critérios objetivos", state: "existente", sentence: 4 },
  { title: "Interpretação contextual com IA", sub: "Copiloto existente; agentes especializados em evolução", state: "parcial", sentence: 5 },
  { title: "Ações supervisionadas e auditoria", sub: "fluxos autorizados, origem e responsabilidade", state: "existente", sentence: 6 },
];

// Cena 10: arquitetura em camadas, com dados subindo até a ação auditada.
export const Scene10Layers: React.FC = () => {
  const { frame, at } = useNarration("s10");
  const pop = usePop();
  const H = 104;
  const G = 14;
  const bottom = 880;
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={10} title="As camadas de inteligência" />
      <Particles count={26} seed="s10" />
      <Badge kind="vision" from={10} />
      {LAYERS.map((l, i) => {
        const y = bottom - (i + 1) * H - i * G;
        const on = at(l.sentence);
        const s = STATE[l.state];
        return (
          <div key={l.title} style={{ position: "absolute", left: 300, top: y, width: 1320, height: H, ...pop(on, { dy: -70, from: 0.92 }) }}>
            <Tile
              accent={s.c}
              style={{
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderStyle: l.state === "proposta" ? "dashed" : "solid",
                boxShadow: frame >= on && frame < on + 50 ? `0 0 0 3px ${s.c}66` : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: colors.accent, width: 40 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{l.title}</div>
                  <div style={{ fontSize: 20, color: colors.textSoft }}>{l.sub}</div>
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, color: s.c, fontWeight: 700 }}>
                <Dot color={s.c} size={9} />
                {s.l}
              </span>
            </Tile>
          </div>
        );
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const p = (frame / 90 + i / 10) % 1;
        const top = bottom - p * (6 * (H + G));
        const reached = LAYERS.filter((l, k) => frame >= at(l.sentence) && bottom - (k + 1) * (H + G) <= top + H).length;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 260,
              top,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: colors.accent,
              boxShadow: `0 0 12px ${colors.accent}`,
              opacity: reached > 0 ? 0.9 : 0,
            }}
          />
        );
      })}
      <Tile
        accent="#34D399"
        style={{ position: "absolute", right: 70, top: 110, width: 470, ...pop(at(7), { dx: 80, dy: 0 }) }}
      >
        <div style={{ fontSize: 17, color: "#6EE7B7", fontWeight: 700, letterSpacing: "0.1em" }}>IA COMO CAMADA OPCIONAL</div>
        <div style={{ fontSize: 22, marginTop: 4 }}>A plataforma funciona sem ela; com ela, decide melhor.</div>
      </Tile>
      <div style={{ position: "absolute", left: 300, top: 110, color: colors.textSoft, fontSize: 22, opacity: interpolate(frame, [at(0), at(0) + 14], [0, 1], clamp) }}>
        Arquitetura de inteligência do STRATO
      </div>
    </AbsoluteFill>
  );
};
