import { AbsoluteFill, interpolate, random } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen, target } from "../components/LiveScreen";
import { ImpactMoment, Particles } from "../components/motion";
import { appear, Badge, SceneLabel, Tile } from "../components/ui";

const N = 36;
// Destino sintético de cada título na simulação: 0 fluxo autorizado, 1 pendência, 2 exceção.
const lane = (i: number) => (i === 17 ? 2 : [5, 22, 30].includes(i) ? 1 : 0);
const LANES = [
  { title: "Fluxo autorizado", hint: "segue para alçada e formalização", color: "#34D399", y: 250 },
  { title: "Pendências", hint: "dados a completar", color: "#F59E0B", y: 455 },
  { title: "Fila de exceções", hint: "decisão humana com contexto", color: "#F87171", y: 660 },
];
const CHECKS = ["Dados validados", "Políticas aplicadas", "Limites verificados", "Divergências identificadas"];

// Cena 04: simulação de uma remessa passando pelo motor; termina no resultado real do motor.
export const Scene04Automation: React.FC = () => {
  const { frame, at } = useNarration("s04");
  const realAt = at(6);
  const simFade = interpolate(frame, [realAt - 6, realAt + 12], [1, 0], clamp);
  const counts = [0, 0, 0];

  const chips = Array.from({ length: N }, (_, i) => {
    const start = at(3) + i * 4;
    const toGate = interpolate(frame, [start, start + 26], [0, 1], { ...clamp, easing: ease.inOut });
    const l = lane(i);
    const exitAt = l === 2 ? at(5) : at(4) + (i % 12) * 3;
    const toLane = interpolate(frame, [exitAt, exitAt + 26], [0, 1], { ...clamp, easing: ease.inOut });
    if (toLane >= 1) counts[l] += 1;
    const sx = 180 + (i % 6) * 44;
    const sy = 360 + Math.floor(i / 6) * 44;
    const gx = 905 + (random(`gx${i}`) - 0.5) * 60;
    const gy = 470 + (random(`gy${i}`) - 0.5) * 260;
    const lx = 1330 + (counts[l] % 12) * 34 + random(`lx${i}`) * 6;
    const ly = LANES[l].y + 92 + Math.floor(counts[l] / 12) * 30;
    const x = toLane > 0 ? gx + (lx - gx) * toLane : sx + (gx - sx) * toGate;
    const y = toLane > 0 ? gy + (ly - gy) * toLane : sy + (gy - sy) * toGate;
    const c = toLane > 0.5 ? LANES[l].color : toGate > 0.5 ? colors.accent : "rgba(255,255,255,0.75)";
    return { x, y, c, show: interpolate(frame, [at(2) + i, at(2) + i + 8], [0, 1], clamp) };
  });

  return (
    <AbsoluteFill>
      <Background />
      <Particles count={22} seed="s04" />
      <SceneLabel index={4} title="Automação orientada a eventos" />
      <AbsoluteFill style={{ opacity: simFade }}>
        <Badge kind="simulation" from={10} />
        <Tile style={{ position: "absolute", left: 140, top: 230, width: 330, ...appear(frame, at(2)) }}>
          <div style={{ fontSize: 18, color: colors.accent, fontWeight: 700, letterSpacing: "0.12em" }}>REMESSA RECEBIDA</div>
          <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{N} títulos</div>
          <div style={{ fontSize: 18, color: colors.textSoft, marginTop: 4 }}>XML NF-e · CNAB · planilha</div>
        </Tile>
        <Tile style={{ position: "absolute", left: 760, top: 190, width: 300, height: 560, ...appear(frame, at(3) - 10) }} accent={colors.accentStrong}>
          <div style={{ fontSize: 18, color: colors.accent, fontWeight: 700, letterSpacing: "0.12em" }}>MOTOR DE ELEGIBILIDADE</div>
          <div style={{ fontSize: 17, color: colors.textSoft, marginTop: 4 }}>política versionada · regras determinísticas</div>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
            {CHECKS.map((c, i) => {
              const on = frame >= at(3) + 20 + i * 18;
              return (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 21, fontWeight: 600, opacity: on ? 1 : 0.35 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: on ? "#34D399" : "transparent", border: "2px solid #34D399", color: colors.navy950, fontSize: 15, fontWeight: 900 }}>
                    {on ? "✓" : ""}
                  </span>
                  {c}
                </div>
              );
            })}
          </div>
        </Tile>
        {LANES.map((l, i) => (
          <Tile
            key={l.title}
            accent={l.color}
            style={{
              position: "absolute",
              left: 1300,
              top: l.y,
              width: 470,
              height: 170,
              ...appear(frame, at(3) + 10),
              boxShadow: frame >= (i === 2 ? at(5) : at(4)) && frame < realAt ? `0 0 0 3px ${l.color}66, 0 18px 50px rgba(2,6,23,0.45)` : undefined,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 25, fontWeight: 700, color: l.color }}>{l.title}</span>
              <span style={{ fontSize: 34, fontWeight: 800 }}>{counts[i]}</span>
            </div>
            <div style={{ fontSize: 17, color: colors.textSoft }}>{l.hint}</div>
          </Tile>
        ))}
        {chips.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: 28, height: 20, borderRadius: 5, background: c.c, opacity: c.show, boxShadow: `0 0 8px ${c.c}66` }} />
        ))}
        <Tile accent="#F87171" style={{ position: "absolute", left: 1300, top: 850, width: 470, ...appear(frame, at(5) + 30) }}>
          <div style={{ fontSize: 17, color: "#FCA5A5", fontWeight: 700 }}>EXCEÇÃO · CONCENTRAÇÃO</div>
          <div style={{ fontSize: 20, marginTop: 4 }}>Sacado acima do limite da política — aguarda alçada</div>
        </Tile>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - simFade }}>
        <Badge kind="real" from={realAt} />
        <LiveScreen
          enterAt={realAt}
          shots={[
            { at: 0, state: "op" },
            { at: realAt + 52, state: "op-motor" },
          ]}
          camera={[
            { at: 0, rect: [40, 120, 1250, 656] },
            { at: realAt + 20, rect: [40, 600, 1250, 656], dur: 1.0 },
            { at: realAt + 70, rect: [40, 690, 1250, 656], dur: 1.0 },
          ]}
          cursor={[
            { at: realAt + 12, x: 700, y: 900 },
            { at: realAt + 48, ...aim("op.abrir"), click: true, dur: 1.0 },
            { at: realAt + 100, ...aim("op-motor.avaliacoes", 3, 2), dur: 0.9 },
            { at: realAt + 150, ...aim("op-motor.excecao", 0.35, 0.5), dur: 1.0 },
          ]}
          marks={[
            { at: realAt + 80, end: realAt + 140, rect: [target("op-motor.avaliacoes")[0] - 6, target("op-motor.avaliacoes")[1] - 16, 1150, 96] },
            { at: realAt + 150, rect: [target("op-motor.excecao")[0] - 110, target("op-motor.excecao")[1] - 14, 1150, 48], color: "#F87171" },
          ]}
        />
      </AbsoluteFill>
      <ImpactMoment at={realAt + 210} lines={["Menos atividades repetitivas.", "Mais atenção às exceções."]} />
    </AbsoluteFill>
  );
};
