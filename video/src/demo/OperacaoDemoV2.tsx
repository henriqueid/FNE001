import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../brand/fonts";
import { clamp, ease, fontFamily } from "../brand/tokens";
import { box, Check, CopilotBubble, Cursor, ds, Mark, Screen, Swap, usePop } from "./ui";

// Versão 2 (30 s, 4:5): gancho de abertura, aproximações nos números das telas reais do STRATO,
// sobreposições enxutas, pausas nos momentos de aprovação e pagamento e trilha discreta.

export const DEMO2_FRAMES = 900;
const SX = 24;
const SY = 196;
const SW = 1032;
const SH = 930;

const SCENES = [
  { from: 75, label: "Entrada" },
  { from: 210, label: "Análise" },
  { from: 360, label: "Aprovação" },
  { from: 540, label: "Pagamento" },
  { from: 720, label: "Carteira" },
];
const CAPTIONS = [
  { from: 82, to: 204, text: "Da entrada dos títulos à análise da operação." },
  { from: 216, to: 354, text: "IA para apoiar a análise. Política para orientar a decisão." },
  { from: 366, to: 452, text: "O copiloto recomenda. O responsável aprova." },
  { from: 460, to: 534, text: "Formalização concluída na própria plataforma." },
  { from: 546, to: 622, text: "Valor líquido conferido antes da liberação." },
  { from: 630, to: 714, text: "O responsável confirma o pagamento." },
  { from: 726, to: 806, text: "Carteira atualizada, com o histórico de cada etapa." },
];

const Badge: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderRadius: 999, background: "#FFFBEB", border: "2px solid #F59E0B", color: "#78350F", fontSize: 24, fontWeight: 800 }}>
    <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" }} />
    Simulação com dados fictícios
  </div>
);

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const active = SCENES.filter(s => frame >= s.from).length - 1;
  const show = interpolate(frame, [70, 82], [0, 1], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: SX + 16, right: SX + 16, top: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile("strato-logo.png")} style={{ height: 44 }} />
        <Badge />
      </div>
      <div style={{ position: "absolute", left: SX + 16, right: SX + 16, top: 122, display: "flex", gap: 10, opacity: show }}>
        {SCENES.map((s, i) => {
          const done = i < active;
          const on = i === active;
          return (
            <div key={s.label} style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 3, background: done || on ? ds.blue : "rgba(255,255,255,0.16)" }} />
              <div style={{ marginTop: 9, fontSize: 21, fontWeight: 700, color: on ? "#fff" : done ? "rgba(226,232,255,0.72)" : "rgba(226,232,255,0.38)" }}>
                {done ? "✓ " : ""}
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const c = CAPTIONS.find(x => frame >= x.from && frame <= x.to);
  if (!c) return null;
  const o = interpolate(frame, [c.from, c.from + 7, c.to - 6, c.to], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: SX, right: SX, top: SY + SH + 16, height: 190, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: o, translate: `0px ${(1 - o) * 10}px` }}>
      <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.18, color: "#fff", maxWidth: 980 }}>{c.text}</div>
    </div>
  );
};

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: "absolute", left: SX, top: SY, width: SW, height: SH }}>{children}</div>;

/** Etiqueta curta sobre a tela (contexto sem esconder o produto). */
const Chip: React.FC<{ at: number; children: React.ReactNode; tone?: "blue" | "green" | "navy"; style?: React.CSSProperties; size?: number }> = ({ at, children, tone = "blue", style, size = 26 }) => {
  const pop = usePop();
  const c = tone === "green" ? ds.success : tone === "navy" ? ds.navy : ds.blue;
  const bg = tone === "green" ? ds.successSoft : "#fff";
  return (
    <div style={{ position: "absolute", ...pop(at, 16), ...style }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 14, background: bg, border: `2px solid ${c}`, boxShadow: "0 16px 40px rgba(2,6,23,0.28)", color: ds.navy, fontSize: size, fontWeight: 700 }}>
        {children}
      </div>
    </div>
  );
};
const Dot: React.FC<{ c: string; check?: boolean }> = ({ c, check }) => (
  <span style={{ width: 30, height: 30, borderRadius: "50%", background: c, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 900, flex: "none" }}>{check ? "✓" : ""}</span>
);

// ── Gancho (0–2,5 s) ──────────────────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [64, 75], [1, 0], clamp);
  const line = (at: number) => {
    const p = at === 0 ? 1 : spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 150 } });
    return { opacity: p, translate: `0px ${(1 - p) * 30}px` };
  };
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: SX, top: SY, width: SW, height: SH, borderRadius: 22, overflow: "hidden", opacity: 0.32, filter: "blur(2px)" }}>
        <Screen shot="l2-liberacao" w={SW} h={SH} cam={[{ at: 0, v: [600, 40, 620] }, { at: 75, v: [640, 60, 560], dur: 75 }]} />
      </div>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,18,32,0.35), rgba(11,18,32,0.9) 70%)" }} />
      <div style={{ position: "absolute", left: 70, right: 70, top: 430, color: "#fff" }}>
        <div style={{ ...line(0), fontSize: 30, fontWeight: 800, letterSpacing: "0.14em", color: "#93C5FD" }}>UMA OPERAÇÃO DE PONTA A PONTA</div>
        <div style={{ ...line(0), marginTop: 22, fontSize: 104, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>R$ 120 mil</div>
        <div style={{ ...line(0), fontSize: 56, fontWeight: 700, lineHeight: 1.15, marginTop: 14 }}>em 12 títulos.</div>
        <div style={{ ...line(12), fontSize: 56, fontWeight: 700, lineHeight: 1.15, marginTop: 34, color: "#BFDBFE" }}>Do arquivo ao pagamento,</div>
        <div style={{ ...line(24), fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>em uma só plataforma.</div>
      </div>
    </AbsoluteFill>
  );
};

// ── Entrada pelo Copiloto (2,5–7 s) ───────────────────────────────────────────────────
const PROMPT = "Analise esta operação e verifique o enquadramento na política.";
const Entry: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const PW = 600;
  const typed = PROMPT.slice(0, Math.floor(interpolate(frame, [6, 34], [0, PROMPT.length], clamp)));
  const facts: [string, string][] = [
    ["Cedente", "Empresa Exemplo Ltda"],
    ["Quantidade", "12 títulos"],
    ["Valor de face", "R$ 120.000,00"],
    ["Prazo médio", "35 dias"],
  ];
  return (
    <Stage>
      <Swap at={44}>
        {[
          <Screen key="a" shot="c2-pedido" w={PW} h={SH} cam={[{ at: 0, v: [0, 0, 476] }, { at: 44, v: [10, 300, 440], dur: 40 }]}>
            {(to, s) => (
              <>
                <Mark rect={box("c2-pedido", "file", 6)} toScreen={to} scale={s} at={0} end={30} />
                <div style={{ position: "absolute", left: to(63, 559)[0], top: to(63, 559)[1], width: 340 * s, height: 46 * s, background: "#fff", fontSize: 13.5 * s, lineHeight: 1.35, color: ds.navy, padding: `${2 * s}px ${4 * s}px` }}>
                  {typed}
                  <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: ds.blue }}>|</span>
                </div>
                <Cursor path={[{ at: 24, v: [460, 860] }, { at: 40, v: [to(238, 482)[0], to(238, 482)[1]], dur: 14 }]} click={41} />
              </>
            )}
          </Screen>,
          <Screen key="b" shot="c3-analise" w={PW} h={SH} cam={[{ at: 44, v: [0, 120, 476] }, { at: 100, v: [30, 360, 400], dur: 46 }]}>
            {(to, s) => <Mark rect={box("c3-analise", "extract", 6)} toScreen={to} scale={s} at={66} />}
          </Screen>,
        ]}
      </Swap>
      <div style={{ position: "absolute", left: PW + 30, right: 0, top: 70, color: "#fff" }}>
        <div style={{ ...pop(4), fontSize: 20, fontWeight: 800, letterSpacing: "0.12em", color: "#93C5FD" }}>COPILOTO STRATO</div>
        <div style={{ ...pop(6), marginTop: 10, fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>Arquivo CSV anexado</div>
        {facts.map(([k, v], i) => (
          <div key={k} style={{ marginTop: 34, ...pop(62 + i * 10) }}>
            <div style={{ fontSize: 21, fontWeight: 600, color: "rgba(226,232,255,0.66)" }}>{k}</div>
            <div style={{ fontSize: i === 0 ? 30 : 44, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </Stage>
  );
};

// ── Análise (7–12 s) ──────────────────────────────────────────────────────────────────
const Analysis: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const checks = ["Cadastro conferido", "Documentação conferida", "Concentração por sacado verificada", "Enquadramento na política concluído"];
  const dim = interpolate(frame, [110, 120], [0, 1], clamp);
  return (
    <Stage>
      <Swap at={66}>
        {[
          <Screen key="a" shot="o2-motor" w={SW} h={SH} cam={[{ at: 0, v: [20, 120, 720] }, { at: 66, v: [60, 130, 640], dur: 66 }]}>
            {(to, s) => <Mark rect={box("o2-motor", "motor", 8)} toScreen={to} scale={s} at={4} end={60} />}
          </Screen>,
          <Screen key="b" shot="a1-contexto" w={SW} h={SH} cam={[{ at: 66, v: [80, 330, 1060] }, { at: 108, v: [250, 420, 560], dur: 34 }]}>
            {(to, s) => <Mark rect={[258, 460, 300, 46]} toScreen={to} scale={s} at={96} />}
          </Screen>,
        ]}
      </Swap>
      <div style={{ position: "absolute", left: 26, right: 26, bottom: 26, opacity: interpolate(frame, [60, 68], [1, 0], clamp) }}>
        <div style={{ ...pop(6), background: "rgba(255,255,255,0.97)", borderRadius: 18, padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", boxShadow: "0 20px 50px rgba(2,6,23,0.3)" }}>
          {checks.map((c, i) => (
            <Check key={c} on={frame >= 12 + i * 11} size={24}>
              {c}
            </Check>
          ))}
        </div>
      </div>
      <Chip at={98} style={{ left: 26, bottom: 26, right: 26 }} size={24}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.12em", color: ds.blue }}>PONTUAÇÃO INTERNA ILUSTRATIVA · 886 / 1000</div>
          <div style={{ marginTop: 4, fontWeight: 600 }}>Cadastro, histórico e concentração. Não é probabilidade de pagamento.</div>
        </div>
      </Chip>
      <div style={{ position: "absolute", inset: 0, background: `rgba(11,18,32,${dim * 0.5})`, borderRadius: 20 }} />
      <div style={{ position: "absolute", left: 26, right: 26, top: 330, opacity: dim }}>
        <CopilotBubble at={112} text="Operação enquadrada nos critérios simulados. Aprovação sujeita à alçada responsável." />
      </div>
    </Stage>
  );
};

// ── Aprovação e formalização (12–18 s) ────────────────────────────────────────────────
const Approval: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const glow = interpolate(frame, [64, 72, 100], [0, 1, 0.35], clamp);
  const steps = ["Análise", "Aprovação", "Formalização"];
  const done = frame < 64 ? 1 : frame < 104 ? 2 : 3;
  return (
    <Stage>
      {frame < 96 ? (
        <Swap at={64}>
          {[
            <Screen key="a" shot="a2-decisao" w={SW} h={SH} cam={[{ at: 0, v: [520, 180, 680] }, { at: 56, v: [700, 230, 480], dur: 40 }]}>
              {(to, s) => (
                <>
                  <Mark rect={box("a2-decisao", "approve", 6)} toScreen={to} scale={s} at={30} end={62} color={ds.success} />
                  <Cursor path={[{ at: 26, v: [380, 760] }, { at: 58, v: [to(1040, 336)[0], to(1040, 336)[1]], dur: 26 }]} click={60} />
                </>
              )}
            </Screen>,
            <Screen key="b" shot="a3-aprovada" w={SW} h={SH} cam={[{ at: 64, v: [700, 230, 480] }, { at: 96, v: [560, 260, 560], dur: 30 }]}>
              {(to, s) => <Mark rect={[530, 296, 260, 64]} toScreen={to} scale={s} at={68} color={ds.success} />}
            </Screen>,
          ]}
        </Swap>
      ) : (
        <Screen shot="l1-pronta" w={SW} h={SH} cam={[{ at: 96, v: [20, 100, 1160] }]}>
          {(to, s) => <Mark rect={box("l1-pronta", "status", 8)} toScreen={to} scale={s} at={104} color={ds.success} />}
        </Screen>
      )}
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, boxShadow: `inset 0 0 0 ${6 * glow}px ${ds.success}`, pointerEvents: "none" }} />
      {frame < 96 ? (
        <>
          <Chip at={6} style={{ left: 26, top: 26 }} size={24}>
            <Dot c={ds.blue} /> Copiloto: enquadrada nos critérios simulados
          </Chip>
          <Chip at={18} tone="navy" style={{ left: 26, top: 100 }} size={24}>
            <Dot c={ds.navy} /> Decisão: responsável com alçada
          </Chip>
        </>
      ) : null}
      {frame >= 66 && frame < 96 ? (
        <Chip at={68} tone="green" style={{ left: 26, bottom: 26 }} size={34}>
          <Dot c={ds.success} check /> Operação aprovada pelo responsável
        </Chip>
      ) : null}
      {frame >= 96 ? (
        <>
          <div style={{ position: "absolute", left: 26, right: 26, top: 26, ...pop(98) }}>
            <div style={{ display: "flex", justifyContent: "space-between", background: "#fff", borderRadius: 16, padding: "14px 22px", boxShadow: "0 16px 40px rgba(2,6,23,0.25)" }}>
              {steps.map((st, i) => (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 26, fontWeight: 700, color: ds.navy }}>
                  <Dot c={i < done ? ds.success : ds.blue} check={i < done} />
                  {st}
                  {i < 2 ? <span style={{ color: "#94A3B8", marginLeft: 8 }}>→</span> : null}
                </div>
              ))}
            </div>
          </div>
          <Chip at={108} tone="green" style={{ left: 26, bottom: 26 }} size={34}>
            <Dot c={ds.success} check />
            <div>
              Formalização concluída — simulação
              <div style={{ fontSize: 20, fontWeight: 600, color: ds.slate, marginTop: 2 }}>Alçadas 3/3 · documentos 6/6 · assinaturas registradas</div>
            </div>
          </Chip>
        </>
      ) : null}
    </Stage>
  );
};

// ── Pagamento (18–24 s) ───────────────────────────────────────────────────────────────
const Payment: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const RH = 300; // altura da faixa da tela no Financeiro (recorta a linha de botões abaixo da tabela)
  return (
    <Stage>
      {frame < 80 ? (
        <>
          <Screen shot="l2-liberacao" w={SW} h={SH} cam={[{ at: 0, v: [790, 60, 470] }, { at: 70, v: [840, 70, 380], dur: 60 }]}>
            {(to, s) => (
              <>
                <Mark rect={[848, 80, 316, 140]} toScreen={to} scale={s} at={6} color={ds.success} />
                <Mark rect={[848, 395, 316, 470]} toScreen={to} scale={s} at={30} />
              </>
            )}
          </Screen>
          <Chip at={36} style={{ left: 26, bottom: 26, right: 26 }} size={26}>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 16 }}>
              <span>Face R$ 120.000,00</span>
              <span style={{ color: "#B91C1C" }}>Deságio e custos − R$ 3.600,06</span>
            </div>
          </Chip>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: RH, borderRadius: 20, overflow: "hidden" }}>
            <Swap at={112}>
              {[
                <Screen key="a" shot="f1-liberacoes" w={SW} h={RH} cam={[{ at: 80, v: [560, 300, 620] }]}>
                  {(to, s) => (
                    <>
                      <Mark rect={box("f1-liberacoes", "pay", 6)} toScreen={to} scale={s} at={90} end={110} />
                      <Cursor path={[{ at: 86, v: [500, 330] }, { at: 106, v: [to(1102, 439)[0], to(1102, 439)[1]], dur: 18 }]} click={108} />
                    </>
                  )}
                </Screen>,
                <Screen key="b" shot="f2-pago" w={SW} h={RH} cam={[{ at: 112, v: [40, 330, 700] }]}>
                  {(to, s) => (
                    <>
                      <Mark rect={box("f2-pago", "paid", 8)} toScreen={to} scale={s} at={118} color={ds.success} />
                    </>
                  )}
                </Screen>,
              ]}
            </Swap>
          </div>
          <div style={{ position: "absolute", left: 30, right: 30, top: RH + 60, color: "#fff" }}>
            {frame < 112 ? (
              <div style={pop(84)}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.12em", color: "#93C5FD" }}>FINANCEIRO · LIBERAÇÃO</div>
                <div style={{ marginTop: 14, fontSize: 30, fontWeight: 600, color: "rgba(226,232,255,0.8)" }}>Favorecido: Empresa Exemplo Ltda</div>
                <div style={{ marginTop: 8, fontSize: 92, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>R$ 116.399,94</div>
                <div style={{ marginTop: 16, fontSize: 24, color: "rgba(226,232,255,0.6)" }}>Conta fictícia · nenhuma transmissão bancária</div>
              </div>
            ) : (
              <div style={pop(116)}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ width: 76, height: 76, borderRadius: "50%", background: ds.success, color: "#fff", display: "grid", placeItems: "center", fontSize: 44, fontWeight: 900 }}>✓</span>
                  <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.1 }}>Pagamento simulado concluído.</div>
                </div>
                <div style={{ marginTop: 22, fontSize: 30, color: "rgba(226,232,255,0.8)" }}>R$ 116.399,94 pagos · registro local da demonstração</div>
              </div>
            )}
          </div>
        </>
      )}
    </Stage>
  );
};

// ── Carteira (24–27 s) ────────────────────────────────────────────────────────────────
const Portfolio: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      {frame < 46 ? (
        <Screen shot="k1-cedentes" w={SW} h={SH} cam={[{ at: 0, v: [40, 900, 1130] }, { at: 40, v: [50, 960, 1110], dur: 40 }]}>
          {(to, s) => <Mark rect={box("k1-cedentes", "row", 4)} toScreen={to} scale={s} at={4} />}
        </Screen>
      ) : (
        <Screen shot="a4-formalizacao" w={SW} h={SH} cam={[{ at: 46, v: [40, 1060, 640] }, { at: 90, v: [40, 1100, 600], dur: 44 }]}>
          {() => null}
        </Screen>
      )}
      {frame < 46 ? (
        <Chip at={8} style={{ left: 26, top: 26 }} size={30}>
          <Dot c={ds.blue} check /> 12 títulos · R$ 120,0 mil em carteira
        </Chip>
      ) : (
        <div style={{ position: "absolute", left: 26, right: 26, bottom: 26 }}>
          <CopilotBubble at={50} text="Operação concluída. Títulos disponíveis para acompanhamento." />
        </div>
      )}
    </Stage>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const o = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ background: ds.navyDeep, opacity: o, alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 80px" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 45% at 50% 40%, rgba(37,99,235,0.3), transparent 70%)" }} />
      <Img src={staticFile("strato-logo.png")} style={{ height: 96, ...pop(2) }} />
      <div style={{ marginTop: 70, fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", color: "#fff", ...pop(8) }}>Crédito e recebíveis com mais clareza operacional.</div>
      <div style={{ marginTop: 46, display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.25)", color: "rgba(226,232,255,0.92)", fontSize: 32, fontWeight: 600, ...pop(18) }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" }} />
        Em homologação. Novidades em breve.
      </div>
      <div style={{ position: "absolute", bottom: 64 }}>
        <Badge />
      </div>
    </AbsoluteFill>
  );
};

export const OperacaoDemoV2: React.FC<{ music: boolean }> = ({ music }) => (
  <AbsoluteFill style={{ fontFamily, background: ds.navyDeep }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(37,99,235,0.26), transparent 70%)" }} />
    <Sequence durationInFrames={76} name="gancho">
      <Hook />
    </Sequence>
    <Sequence from={75} durationInFrames={135} name="1 · entrada">
      <Entry />
    </Sequence>
    <Sequence from={210} durationInFrames={150} name="2 · análise">
      <Analysis />
    </Sequence>
    <Sequence from={360} durationInFrames={180} name="3 · aprovação">
      <Approval />
    </Sequence>
    <Sequence from={540} durationInFrames={180} name="4 · pagamento">
      <Payment />
    </Sequence>
    <Sequence from={720} durationInFrames={92} name="5 · carteira">
      <Portfolio />
    </Sequence>
    <Header />
    <Caption />
    <Sequence from={810} name="encerramento">
      <EndCard />
    </Sequence>
    {music ? <Audio src={staticFile("demo/music.mp3")} volume={f => 0.55 * interpolate(f, [0, 20, DEMO2_FRAMES - 45, DEMO2_FRAMES - 2], [0, 1, 1, 0], clamp)} /> : null}
  </AbsoluteFill>
);
