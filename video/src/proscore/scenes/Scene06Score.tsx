import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen } from "../components/LiveScreen";
import { Particles, usePop } from "../components/motion";
import { appear, Badge, SceneLabel, Tile } from "../components/ui";

// Componentes e pesos da política de qualidade de demonstração (src/domain/risk/quality-policy.ts).
const COMPONENTS: { label: string; weight: number; external?: boolean }[] = [
  { label: "Liquidez no prazo", weight: 22 },
  { label: "Atraso médio", weight: 16 },
  { label: "Recompras", weight: 14 },
  { label: "Vencido há mais de 30 dias", weight: 14 },
  { label: "Prorrogações", weight: 8 },
  { label: "Concentração no maior sacado", weight: 8 },
  { label: "Uso do limite", weight: 5 },
  { label: "Protestos e apontamentos", weight: 8, external: true },
  { label: "Score de bureau (externo)", weight: 5, external: true },
];
const PURPLE = "#C084FC";

// Cena 06: score interno real (radar) e seus componentes; termina na convergência interno × externo.
export const Scene06Score: React.FC = () => {
  const { frame, at } = useNarration("s06");
  const merge = interpolate(frame, [at(7), at(7) + 24], [0, 1], { ...clamp, easing: ease.inOut });
  const ext = frame >= at(6);
  const pop = usePop();
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <Particles count={20} seed="s06" />
      <SceneLabel index={6} title="Score interno da carteira" />
      <AbsoluteFill style={{ opacity: 1 - merge * 0.85 }}>
        <Badge kind="real" from={10} />
        <LiveScreen
          view={{ x: 60, y: 100, w: 820, h: 830 }}
          shots={[
            { at: 0, state: "home" },
            { at: at(0) + 90, state: "home-score" },
          ]}
          camera={[
            { at: 0, rect: [1000, 90, 600, 607] },
            { at: at(0) + 110, rect: [1100, 120, 500, 506], dur: 1.0 },
            { at: at(4), rect: [1150, 480, 450, 455], dur: 1.6 },
            { at: at(5) + 20, rect: [1150, 900, 450, 455], dur: 4.5 },
          ]}
          cursor={[
            { at: at(0) + 30, x: 1300, y: 420 },
            { at: at(0) + 80, ...aim("home.tabScore"), click: true, dur: 1.0 },
            { at: at(0) + 150, x: 1420, y: 400, dur: 1.0 },
            { at: at(4) + 30, ...aim("home-score.rede", 0.5, 0.5), dur: 1.2 },
            { at: at(5) + 60, x: 1400, y: 1060, dur: 3.5 },
          ]}
          marks={[
            { at: at(0) + 130, end: at(4) - 4, rect: [1236, 334, 304, 120] },
            { at: at(4) + 40, end: at(5) + 20, rect: [1236, 532, 304, 320] },
          ]}
        />
        <div style={{ position: "absolute", left: 950, top: 120, width: 880 }}>
          <div style={{ color: colors.accent, fontSize: 19, fontWeight: 700, letterSpacing: "0.14em", ...appear(frame, at(3) - 10) }}>
            COMPONENTES DO ÍNDICE · 0 A 1000
          </div>
          <div style={{ color: colors.textSoft, fontSize: 19, marginTop: 4, ...appear(frame, at(3) - 10) }}>
            Classificação por regras e pesos da política — não é um modelo preditivo
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            {COMPONENTS.map((c, i) => {
              const s = at(3) + i * 9;
              const w = interpolate(frame, [s, s + 24], [0, c.weight / 22], { ...clamp, easing: ease.out });
              const hl = c.external && ext;
              return (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 16, ...pop(s, { dx: 60, dy: 0 }) }}>
                  <div style={{ width: 340, fontSize: 21, fontWeight: 600, color: hl ? "#E9D5FF" : colors.white }}>{c.label}</div>
                  <div style={{ flex: 1, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.1)" }}>
                    <div
                      style={{
                        width: `${w * 100}%`,
                        height: "100%",
                        borderRadius: 7,
                        background: c.external ? (hl ? PURPLE : "rgba(192,132,252,0.5)") : `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`,
                        boxShadow: hl ? `0 0 14px ${PURPLE}` : undefined,
                      }}
                    />
                  </div>
                  <div style={{ width: 52, textAlign: "right", fontSize: 20, color: colors.textSoft }}>{c.weight}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 26, ...pop(at(6) + 10) }}>
            <Tile accent={PURPLE} style={{ boxShadow: `0 0 40px ${PURPLE}44` }}>
              <div style={{ fontSize: 18, color: "#E9D5FF", fontWeight: 700, letterSpacing: "0.1em" }}>COMPONENTES EXTERNOS JÁ PREVISTOS</div>
              <div style={{ fontSize: 24, marginTop: 4 }}>Score de bureau e protestos aguardam um provedor de dados.</div>
            </Tile>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: merge }}>
        <Badge kind="proposal" from={at(7)} />
        {[
          { t: "Inteligência interna", s: "STRATO", x: 260, c: colors.accent },
          { t: "Inteligência externa", s: "proScore", x: 1180, c: PURPLE },
        ].map((b, i) => (
          <Tile
            key={b.s}
            accent={b.c}
            style={{
              position: "absolute",
              top: 330,
              left: b.x + (i === 0 ? 1 : -1) * interpolate(frame, [at(7) + 20, at(7) + 60], [0, 160], { ...clamp, easing: ease.inOut }),
              width: 480,
              textAlign: "center",
              padding: "34px 28px",
            }}
          >
            <div style={{ fontSize: 22, color: b.c, fontWeight: 700, letterSpacing: "0.1em" }}>{b.t.toUpperCase()}</div>
            <div style={{ fontSize: 52, fontWeight: 800, marginTop: 6 }}>{b.s}</div>
          </Tile>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", ...appear(frame, at(7) + 60) }}>
          <span style={{ padding: "16px 34px", borderRadius: 999, background: "rgba(52,211,153,0.15)", border: "1px solid #34D39988", color: "#A7F3D0", fontSize: 30, fontWeight: 700 }}>
            Uma estrutura comum de decisão
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
