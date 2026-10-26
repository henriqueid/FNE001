import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { appear, Badge, Impact, SceneLabel } from "../components/ui";

const SCREENS = [
  "screens/visao-geral.jpg",
  "screens/operacoes.jpg",
  "screens/carteira.jpg",
  "screens/financeiro.jpg",
  "proscore/screens/politicas.jpg",
  "screens/controladoria.jpg",
];
const WORDS = ["Simplicidade", "Automação", "Inteligência"];

// Cena 12: o STRATO em operação (telas reais) e os três conceitos de posicionamento.
export const Scene12Positioning: React.FC = () => {
  const { frame, at } = useNarration("s12");
  const dim = interpolate(frame, [at(2), at(3)], [1, 0.28], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={12} title="Posicionamento" />
      <Badge kind="real" from={10} />
      <div style={{ position: "absolute", left: 150, top: 120, display: "grid", gridTemplateColumns: "repeat(3, 520px)", gap: 30, opacity: dim }}>
        {SCREENS.map((s, i) => (
          <div
            key={s}
            style={{
              width: 520,
              height: 325,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(2,6,23,0.5), 0 0 0 1px rgba(255,255,255,0.14)",
              ...appear(frame, at(0) + i * 10, 16, 30),
            }}
          >
            <Img src={staticFile(s)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center", gap: 70 }}>
        {WORDS.map((w, i) => (
          <div key={w} style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.02em", color: i === 1 ? colors.accent : colors.white, ...appear(frame, at(3) + i * 16, 18, 30) }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", fontSize: 32, color: colors.textSoft, ...appear(frame, at(5)) }}>
        Competir pela capacidade de fazer a operação trabalhar melhor.
      </div>
      <Impact lines={["Tecnologia robusta.", "Operação descomplicada."]} at={at(6) + 60} />
    </AbsoluteFill>
  );
};
