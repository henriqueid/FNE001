import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import "../brand/fonts";
import { clamp, ease, fontFamily } from "../brand/tokens";
import { box, Card, Check, CopilotBubble, Cursor, ds, Kicker, Mark, Screen, Swap, usePop } from "./ui";

// Vídeo demonstrativo 4:5 (1080×1350, 36 s) para LinkedIn: uma operação fictícia percorrendo o STRATO real
// em modo demonstração local. Telas capturadas por video/scripts/demo/capture-operation.cjs.

export const DEMO_FRAMES = 1080;
const SX = 40; // quadro da tela
const SY = 214;
const SW = 1000;
const SH = 900;

const SCENES = [
  { from: 0, label: "Entrada" },
  { from: 180, label: "Análise" },
  { from: 420, label: "Aprovação" },
  { from: 690, label: "Pagamento" },
  { from: 900, label: "Carteira" },
];
const CAPTIONS = [
  { from: 8, to: 172, text: "Da entrada dos títulos à análise da operação." },
  { from: 188, to: 412, text: "IA para apoiar a análise. Política para orientar a decisão." },
  { from: 428, to: 552, text: "O copiloto recomenda. O responsável aprova." },
  { from: 560, to: 682, text: "Aprovação registrada e formalização concluída." },
  { from: 698, to: 788, text: "Valor líquido conferido antes da liberação." },
  { from: 796, to: 892, text: "O responsável confirma. Pagamento simulado." },
  { from: 908, to: 1000, text: "Carteira atualizada, com o histórico de cada etapa." },
];

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const active = SCENES.filter(s => frame >= s.from).length - 1;
  return (
    <>
      <div style={{ position: "absolute", left: SX, right: SX, top: 46, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile("strato-logo.png")} style={{ height: 46 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderRadius: 999, background: "#FFFBEB", border: "2px solid #F59E0B", color: "#78350F", fontSize: 25, fontWeight: 800 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" }} />
          Simulação com dados fictícios
        </div>
      </div>
      <div style={{ position: "absolute", left: SX, right: SX, top: 132, display: "flex", gap: 10 }}>
        {SCENES.map((s, i) => {
          const done = i < active;
          const on = i === active;
          return (
            <div key={s.label} style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 3, background: done || on ? ds.blue : "rgba(255,255,255,0.16)", opacity: on ? 1 : done ? 0.75 : 1 }} />
              <div style={{ marginTop: 10, fontSize: 21, fontWeight: 700, color: on ? "#fff" : done ? "rgba(226,232,255,0.75)" : "rgba(226,232,255,0.4)" }}>
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
  const o = interpolate(frame, [c.from, c.from + 8, c.to - 6, c.to], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: SX, right: SX, top: SY + SH + 34, height: 170, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: o, translate: `0px ${(1 - o) * 10}px` }}>
      <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.2, color: "#fff", letterSpacing: "-0.01em", maxWidth: 960 }}>{c.text}</div>
    </div>
  );
};

/** Posiciona a área da tela e o que fica por cima dela. */
const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: "absolute", left: SX, top: SY, width: SW, height: SH }}>{children}</div>;

// ── Cena 1 · Entrada pelo Copiloto (0–6 s) ─────────────────────────────────────────────
const PROMPT = "Analise esta operação e verifique o enquadramento na política.";
const SceneEntry: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const PW = 560;
  const cam = [{ at: 0, v: [0, 0, 476] }];
  const typed = PROMPT.slice(0, Math.floor(interpolate(frame, [52, 92], [0, PROMPT.length], clamp)));
  const rows: [string, string][] = [
    ["Cedente", "Empresa Exemplo Ltda"],
    ["Quantidade", "12 títulos"],
    ["Valor de face", "R$ 120.000,00"],
    ["Prazo médio", "35 dias"],
  ];
  return (
    <Stage>
      <Swap at={108}>
        {[
          <Screen key="a" shot="c2-pedido" w={PW} h={SH} cam={cam}>
            {(to, s) => (
              <>
                <Mark rect={box("c2-pedido", "file", 6)} toScreen={to} scale={s} at={10} end={48} />
                {frame < 50 ? null : (
                  <div style={{ position: "absolute", left: to(63, 559)[0], top: to(63, 559)[1], width: 340 * s, height: 46 * s, background: "#fff", fontSize: 13.5 * s, lineHeight: 1.35, color: ds.navy, padding: `${2 * s}px ${4 * s}px` }}>
                    {typed}
                    <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: ds.blue }}>|</span>
                  </div>
                )}
                {frame < 50 ? <div style={{ position: "absolute", left: to(63, 559)[0], top: to(63, 559)[1], width: 340 * s, height: 46 * s, background: "#fff", fontSize: 13.5 * s, color: "#94A3B8", padding: `${2 * s}px ${4 * s}px` }}>Pergunte, investigue ou simule um cenário…</div> : null}
                <Cursor path={[{ at: 70, v: [430, 820] }, { at: 100, v: [to(238, 482)[0], to(238, 482)[1]], dur: 22 }]} click={102} />
              </>
            )}
          </Screen>,
          <Screen key="b" shot="c3-analise" w={PW} h={SH} cam={[{ at: 0, v: [0, 0, 476] }]}>
            {(to, s) => <Mark rect={box("c3-analise", "extract", 6)} toScreen={to} scale={s} at={124} />}
          </Screen>,
        ]}
      </Swap>
      <div style={{ position: "absolute", left: PW + 24, right: 0, top: 40, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...pop(6), color: "#fff" }}>
          <Kicker color="rgba(226,232,255,0.7)">Copiloto STRATO</Kicker>
          <div style={{ marginTop: 8, fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>Arquivo anexado:</div>
          <div style={{ marginTop: 4, fontSize: 24, color: "rgba(226,232,255,0.8)" }}>12 títulos em CSV</div>
        </div>
        <div style={pop(116)}>
          <Card style={{ padding: "22px 24px" }}>
            <Kicker color={ds.blue}>Operação organizada</Kicker>
            {rows.map(([k, v], i) => (
              <div key={k} style={{ marginTop: 16, ...pop(124 + i * 9, 14) }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: ds.slate }}>{k}</div>
                <div style={{ fontSize: i === 0 ? 27 : 34, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{v}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Stage>
  );
};

// ── Cena 2 · Análise e pontuação (6–14 s) ──────────────────────────────────────────────
const SceneAnalysis: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const checks = ["Cadastro conferido", "Documentação conferida", "Concentração por sacado verificada", "Enquadramento na política concluído"];
  const dim = interpolate(frame, [176, 186], [0, 1], clamp);
  return (
    <Stage>
      <Swap at={92}>
        {[
          <Screen key="a" shot="o2-motor" w={SW} h={SH} cam={[{ at: 0, v: [10, 110, 740] }, { at: 70, v: [30, 120, 700], dur: 60 }]}>
            {(to, s) => (
              <>
                <Mark rect={box("o2-motor", "motor", 8)} toScreen={to} scale={s} at={8} end={60} />
              </>
            )}
          </Screen>,
          <Screen key="b" shot="a1-contexto" w={SW} h={SH} cam={[{ at: 92, v: [60, 100, 1090] }, { at: 140, v: [240, 330, 900], dur: 34 }]}>
            {(to, s) => (
              <>
                <Mark rect={[255, 455, 330, 60]} toScreen={to} scale={s} at={124} color={ds.blue} />
                <Mark rect={[610, 360, 510, 250]} toScreen={to} scale={s} at={136} color={ds.blue} />
              </>
            )}
          </Screen>,
        ]}
      </Swap>
      {/* Verificações sequenciais. */}
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 36, opacity: interpolate(frame, [86, 96], [1, 0], clamp) }}>
        <Card style={{ ...pop(10), padding: "26px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Kicker color={ds.blue}>Verificações da política</Kicker>
          {checks.map((c, i) => (
            <Check key={c} on={frame >= 18 + i * 15}>
              {c}
            </Check>
          ))}
        </Card>
      </div>
      {/* Pontuação interna (valor real do sistema; ilustrativa). */}
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 36, opacity: frame < 150 ? 0 : 1 }}>
        <Card style={{ ...pop(150), padding: "26px 30px" }}>
          <Kicker color={ds.blue}>Pontuação interna ilustrativa</Kicker>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: ds.navy }}>886</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: ds.slate }}>/ 1000</span>
            <span style={{ marginLeft: 12, padding: "6px 14px", borderRadius: 999, background: ds.successSoft, color: ds.success, fontSize: 22, fontWeight: 800 }}>Faixa positiva</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {["Cadastro", "Histórico", "Concentração"].map(f => (
              <span key={f} style={{ padding: "8px 16px", borderRadius: 999, background: ds.blueSoft, color: ds.blue, fontSize: 22, fontWeight: 700 }}>
                {f}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 21, color: ds.slate, lineHeight: 1.35 }}>Índice interno de apoio à análise. Não é probabilidade de pagamento nem garantia.</div>
        </Card>
      </div>
      <div style={{ position: "absolute", inset: 0, background: `rgba(11,18,32,${dim * 0.55})`, borderRadius: 20 }} />
      <div style={{ position: "absolute", left: 40, right: 40, top: 300, opacity: dim }}>
        <CopilotBubble at={180} text="Operação enquadrada nos critérios simulados. Aprovação sujeita à alçada responsável." />
      </div>
    </Stage>
  );
};

// ── Cena 3 · Aprovação e formalização (14–23 s) ────────────────────────────────────────
const Tag: React.FC<{ at: number; color: string; title: string; text: string; style?: React.CSSProperties }> = ({ at, color, title, text, style }) => {
  const pop = usePop();
  return (
    <div style={{ position: "absolute", ...pop(at), ...style }}>
      <div style={{ padding: "14px 20px", borderRadius: 16, background: "#fff", border: `2px solid ${color}`, boxShadow: "0 18px 40px rgba(2,6,23,0.25)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.12em", color }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 25, fontWeight: 700, color: ds.navy }}>{text}</div>
      </div>
    </div>
  );
};

const Flow: React.FC<{ at: number; step: number }> = ({ at, step }) => {
  const pop = usePop();
  const items = ["Análise", "Aprovação", "Formalização"];
  return (
    <div style={pop(at)}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 26px" }}>
        {items.map((it, i) => (
          <div key={it} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: i < step ? ds.success : i === step ? ds.blue : ds.border, color: "#fff", fontSize: 22, fontWeight: 900 }}>{i < step ? "✓" : i + 1}</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: i <= step ? ds.navy : "#94A3B8" }}>{it}</span>
            {i < items.length - 1 ? <span style={{ marginLeft: 10, color: "#94A3B8", fontSize: 28 }}>→</span> : null}
          </div>
        ))}
      </Card>
    </div>
  );
};

const SceneApproval: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const camA = [{ at: 0, v: [520, 200, 680] }];
  const step = frame < 84 ? 1 : frame < 196 ? 2 : 3;
  return (
    <Stage>
      {frame < 100 ? (
        <Swap at={80}>
          {[
            <Screen key="a" shot="a2-decisao" w={SW} h={SH} cam={camA}>
              {(to, s) => (
                <>
                  <Mark rect={box("a2-decisao", "approve", 6)} toScreen={to} scale={s} at={44} end={76} color={ds.success} />
                  <Cursor path={[{ at: 40, v: [300, 760] }, { at: 72, v: [to(1040, 336)[0], to(1040, 336)[1]], dur: 28 }]} click={76} />
                </>
              )}
            </Screen>,
            <Screen key="b" shot="a3-aprovada" w={SW} h={SH} cam={camA}>
              {(to, s) => <Mark rect={[530, 300, 260, 70]} toScreen={to} scale={s} at={84} color={ds.success} />}
            </Screen>,
          ]}
        </Swap>
      ) : frame < 190 ? (
        <Screen shot="a4-formalizacao" w={SW} h={SH} cam={[{ at: 100, v: [40, 90, 1120] }, { at: 150, v: [560, 120, 640], dur: 40 }]}>
          {(to, s) => <Mark rect={[600, 140, 560, 420]} toScreen={to} scale={s} at={156} color={ds.blue} />}
        </Screen>
      ) : (
        <Screen shot="l1-pronta" w={SW} h={SH} cam={[{ at: 190, v: [20, 90, 1160] }]}>
          {(to, s) => <Mark rect={box("l1-pronta", "status", 8)} toScreen={to} scale={s} at={200} color={ds.success} />}
        </Screen>
      )}
      {frame < 100 ? (
        <>
          <Tag at={8} color={ds.blue} title="RECOMENDAÇÃO DO COPILOTO" text="Enquadrada nos critérios simulados" style={{ left: 30, top: 470 }} />
          <Tag at={30} color={ds.navy} title="DECISÃO HUMANA" text="Responsável com alçada aprova" style={{ left: 30, top: 590 }} />
        </>
      ) : null}
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 36 }}>
        <Flow at={frame < 100 ? 86 : 0} step={step} />
      </div>
      {frame >= 200 ? (
        <div style={{ position: "absolute", left: 40, right: 40, top: 430, ...pop(204) }}>
          <Card style={{ display: "flex", alignItems: "center", gap: 18, border: `2px solid ${ds.success}`, background: ds.successSoft }}>
            <span style={{ width: 54, height: 54, borderRadius: "50%", background: ds.success, color: "#fff", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 900, flex: "none" }}>✓</span>
            <div>
              <div style={{ fontSize: 34, fontWeight: 800 }}>Formalização concluída — simulação</div>
              <div style={{ fontSize: 22, color: ds.slate, marginTop: 4 }}>Alçadas 3/3 · documentos 6/6 · assinaturas registradas</div>
            </div>
          </Card>
        </div>
      ) : null}
    </Stage>
  );
};

// ── Cena 4 · Pagamento (23–30 s) ───────────────────────────────────────────────────────
const SceneRelease: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const money: [string, string, string?][] = [
    ["Valor de face", "R$ 120.000,00"],
    ["Deságio e custos simulados", "R$ 3.600,06", "deságio R$ 3.456,06 + tarifas R$ 144,00"],
    ["Valor líquido", "R$ 116.399,94"],
  ];
  return (
    <Stage>
      {frame < 100 ? (
        <Screen shot="l2-liberacao" w={SW} h={SH} cam={[{ at: 0, v: [610, 80, 600] }]}>
          {(to, s) => <Mark rect={[848, 395, 320, 480]} toScreen={to} scale={s} at={10} color={ds.blue} />}
        </Screen>
      ) : (
        <Swap at={168}>
          {[
            <Screen key="a" shot="f1-liberacoes" w={SW} h={SH} cam={[{ at: 100, v: [40, 270, 1120] }]}>
              {(to, s) => (
                <>
                  <Mark rect={box("f1-liberacoes", "pay", 6)} toScreen={to} scale={s} at={140} end={166} />
                  <Cursor path={[{ at: 122, v: [500, 420] }, { at: 160, v: [to(1102, 439)[0], to(1102, 439)[1]], dur: 30 }]} click={163} />
                </>
              )}
            </Screen>,
            <Screen key="b" shot="f2-pago" w={SW} h={SH} cam={[{ at: 100, v: [40, 325, 1120] }]}>
              {(to, s) => <Mark rect={box("f2-pago", "row", 4)} toScreen={to} scale={s} at={172} color={ds.success} />}
            </Screen>,
          ]}
        </Swap>
      )}
      {frame < 100 ? (
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 36 }}>
          <Card style={{ ...pop(20), padding: "26px 30px" }}>
            <Kicker color={ds.blue}>Resumo financeiro</Kicker>
            {money.map(([k, v, note], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginTop: 16, paddingTop: i ? 14 : 0, borderTop: i ? `1px solid ${ds.border}` : "none", ...pop(28 + i * 12, 12) }}>
                <div>
                  <div style={{ fontSize: 25, fontWeight: 600, color: ds.slate }}>{k}</div>
                  {note ? <div style={{ fontSize: 18, color: "#94A3B8", marginTop: 2 }}>{note}</div> : null}
                </div>
                <div style={{ fontSize: i === 2 ? 52 : 38, fontWeight: 800, letterSpacing: "-0.02em", color: i === 2 ? ds.success : i === 1 ? "#B91C1C" : ds.navy, whiteSpace: "nowrap" }}>
                  {i === 1 ? "− " : ""}
                  {v}
                </div>
              </div>
            ))}
          </Card>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, right: 0, top: 192, bottom: 0, background: "linear-gradient(180deg, rgba(11,18,32,0.9) 0px, rgba(11,18,32,0.97) 14px)", borderRadius: "0 0 20px 20px" }}>
          <div style={{ position: "absolute", left: 40, right: 40, top: 150 }}>
            {frame < 170 ? (
              <div style={{ ...pop(104), color: "#fff" }}>
                <Kicker color="rgba(226,232,255,0.7)">Financeiro · liberação da operação</Kicker>
                <div style={{ marginTop: 10, fontSize: 40, fontWeight: 700 }}>Favorecido: Empresa Exemplo Ltda</div>
                <div style={{ marginTop: 6, fontSize: 58, fontWeight: 800, letterSpacing: "-0.02em" }}>R$ 116.399,94</div>
                <div style={{ marginTop: 10, fontSize: 24, color: "rgba(226,232,255,0.7)" }}>Conta fictícia · nenhuma transmissão bancária</div>
              </div>
            ) : (
              <div style={pop(174)}>
                <Card style={{ display: "flex", alignItems: "center", gap: 18, border: `2px solid ${ds.success}`, background: ds.successSoft }}>
                  <span style={{ width: 58, height: 58, borderRadius: "50%", background: ds.success, color: "#fff", display: "grid", placeItems: "center", fontSize: 34, fontWeight: 900, flex: "none" }}>✓</span>
                  <div>
                    <div style={{ fontSize: 38, fontWeight: 800 }}>Pagamento simulado concluído.</div>
                    <div style={{ fontSize: 22, color: ds.slate, marginTop: 4 }}>R$ 116.399,94 · registro no livro local da demonstração</div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </Stage>
  );
};

// ── Cena 5 · Carteira e encerramento (30–36 s) ─────────────────────────────────────────
const ScenePortfolio: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  return (
    <Stage>
      {frame < 58 ? (
        <Screen shot="k1-cedentes" w={SW} h={SH} cam={[{ at: 0, v: [40, 780, 1130] }]}>
          {(to, s) => <Mark rect={[55, 1022, 1105, 52]} toScreen={to} scale={s} at={6} color={ds.blue} />}
        </Screen>
      ) : (
        <Screen shot="a4-formalizacao" w={SW} h={SH} cam={[{ at: 58, v: [40, 1050, 620] }]}>
          {() => null}
        </Screen>
      )}
      {frame < 58 ? (
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 36 }}>
          <Card style={{ ...pop(10), display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>12</div>
              <div style={{ fontSize: 22, color: ds.slate, marginTop: 6 }}>títulos na carteira</div>
            </div>
            <div>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>R$ 120,0 mil</div>
              <div style={{ fontSize: 22, color: ds.slate, marginTop: 6 }}>em aberto · Empresa Exemplo</div>
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 40, right: 40, bottom: 36 }}>
          <CopilotBubble at={64} text="Operação concluída. Títulos disponíveis para acompanhamento." />
        </div>
      )}
    </Stage>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop();
  const o = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ background: ds.navyDeep, opacity: o, alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 80px" }}>
      <Img src={staticFile("strato-logo.png")} style={{ height: 92, ...pop(4) }} />
      <div style={{ marginTop: 70, fontSize: 60, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: "#fff", ...pop(12) }}>Crédito e recebíveis com mais clareza operacional.</div>
      <div style={{ marginTop: 44, display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.25)", color: "rgba(226,232,255,0.92)", fontSize: 32, fontWeight: 600, ...pop(24) }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B" }} />
        Em homologação. Novidades em breve.
      </div>
      <div style={{ position: "absolute", bottom: 60, fontSize: 22, color: "rgba(226,232,255,0.5)" }}>Simulação com dados fictícios · telas do STRATO em ambiente de demonstração local</div>
    </AbsoluteFill>
  );
};

export const OperacaoDemo: React.FC = () => (
  <AbsoluteFill style={{ fontFamily, background: ds.navyDeep }}>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,99,235,0.28), transparent 70%)" }} />
    <Sequence durationInFrames={180} name="1 · entrada">
      <SceneEntry />
    </Sequence>
    <Sequence from={180} durationInFrames={240} name="2 · análise">
      <SceneAnalysis />
    </Sequence>
    <Sequence from={420} durationInFrames={270} name="3 · aprovação">
      <SceneApproval />
    </Sequence>
    <Sequence from={690} durationInFrames={210} name="4 · pagamento">
      <SceneRelease />
    </Sequence>
    <Sequence from={900} durationInFrames={110} name="5 · carteira">
      <ScenePortfolio />
    </Sequence>
    <Header />
    <Caption />
    <Sequence from={1005} name="encerramento">
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
