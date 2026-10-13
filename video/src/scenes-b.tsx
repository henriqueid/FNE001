import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  Avatar,
  Button,
  Card,
  Caption,
  Chip,
  Clickable,
  CopilotPanel,
  CountUp,
  FadeUp,
  Label,
  ProgressBar,
  ReplyAuthor,
  SparkIcon,
  Split,
  Tile,
  Typewriter,
  UserBubble,
  brl,
  useEnter,
  type DotState,
} from "./components";
import { theme } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Mostra o conteúdo apenas dentro da janela [from, to), com fade nas bordas. */
function Phase({ from, to, children }: { from: number; to: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const opacity = interpolate(frame, [from, from + 10, to - 8, to], [0, 1, 1, 0], clamp);
  return <div style={{ opacity, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>;
}

const STAGES = [
  "Arquivos recebidos",
  "Validando formatos",
  "Extraindo títulos",
  "Consulta ao birô",
  "Aplicando política e calculando",
];

/* 05 · Mesa Inteligente: lote → tarefa em segundo plano → resultado */
export function DeskScene() {
  const frame = useCurrentFrame();
  const files = [
    ["XML", "lote_nfe_outubro.xml", "NF-e com duplicatas · 4 títulos"],
    ["CNAB", "remessa_cnab400.rem", "CNAB 400 · 3 títulos"],
    ["XLS", "extrato_padrao.xlsx", "Layout padrão de extrato · 2 títulos"],
  ];
  const START = 76;
  const AUTH_AT = 160;
  // Etapas avançam a cada 16 frames; a consulta ao birô espera a autorização.
  const doneAt = [START + 14, START + 30, START + 46, AUTH_AT + 14, AUTH_AT + 30];
  const doneCount = doneAt.filter(t => frame >= t).length;
  const waiting = frame >= START + 54 && frame < AUTH_AT;
  const finished = frame >= AUTH_AT + 30;
  const progress = interpolate(frame, [START, START + 54, AUTH_AT, AUTH_AT + 30], [0, 62, 62, 100], clamp);
  const state: DotState = waiting ? "wait" : frame >= START && !finished ? "busy" : "on";
  const status =
    frame < START
      ? "Pronto para ajudar"
      : waiting
        ? "Aguardando sua autorização"
        : !finished
          ? "Analisando em segundo plano"
          : "Distribuidora Aurora · cenário v1";
  return (
    <Split
      caption={
        <Caption
          step="05"
          kicker="MESA INTELIGENTE"
          title="Envie o lote. Receba a análise."
          body="XML de NF-e, CNAB ou planilha: o Copiloto extrai os títulos, aplica a política e aponta bloqueios e exceções — em segundo plano, enquanto você trabalha."
        />
      }
    >
      <CopilotPanel status={status} state={state}>
        <div style={{ minHeight: 470 }}>
          <Phase from={0} to={START + 4}>
            <FadeUp delay={6}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>NOVA ANÁLISE</Label>
                <Chip tone="blue">Cedente: Distribuidora Aurora</Chip>
              </div>
            </FadeUp>
            {files.map(([fmt, name, detail], i) => {
              const p = interpolate(frame, [12 + i * 10, 26 + i * 10], [0, 1], clamp);
              return (
                <div
                  key={name}
                  style={{
                    opacity: p,
                    transform: `translateY(${(1 - p) * -26}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    background: theme.elev,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadowSoft,
                    borderRadius: 18,
                    padding: "14px 18px",
                  }}
                >
                  <Tile size={52}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt}</span>
                  </Tile>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <b style={{ fontSize: 21, color: theme.slate }}>{name}</b>
                    <span style={{ fontSize: 17, color: theme.text3 }}>{detail}</span>
                  </div>
                  <Chip tone="good">Reconhecido</Chip>
                </div>
              );
            })}
            <FadeUp delay={46} style={{ alignSelf: "flex-end", marginTop: 4 }}>
              <Clickable clickAt={START - 6} fromX={-200} fromY={-150}>
                <Button tone="blue" pressAt={START - 6}>
                  Analisar lote →
                </Button>
              </Clickable>
            </FadeUp>
          </Phase>

          <Phase from={START + 4} to={AUTH_AT + 40}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Label style={{ color: theme.blueDeep }}>ANÁLISE EM ANDAMENTO</Label>
                <b style={{ fontSize: 22, color: theme.slate }}>Lote da Distribuidora Aurora</b>
              </div>
              <b style={{ fontSize: 30, color: theme.slate }}>{Math.round(progress)}%</b>
            </div>
            <ProgressBar value={progress} />
            {STAGES.map((label, i) => {
              const done = i < doneCount;
              const active = i === doneCount;
              const isWait = active && waiting;
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 21,
                    color: done || active ? theme.slate : theme.text3,
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#fff",
                      background: done ? theme.good : "transparent",
                      border: done
                        ? "none"
                        : `2px solid ${isWait ? "#fbbf24" : active ? theme.blueLight : theme.borderStrong}`,
                    }}
                  >
                    {done ? "✓" : ""}
                  </span>
                  {label}
                  {isWait && <Chip tone="warn">Precisa da sua autorização</Chip>}
                </div>
              );
            })}
            {frame >= START + 54 && frame < AUTH_AT + 22 && (
              <FadeUp delay={START + 54}>
                <Card
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    borderColor: "rgb(217 119 6 / 35%)",
                    background: "#fffaf0",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 21, color: theme.slate }}>Novo sacado: Mercantil Boa Vista</b>
                    <div style={{ fontSize: 17, color: theme.text2 }}>Posso consultar o birô? A consulta tem custo.</div>
                  </div>
                  <Clickable clickAt={AUTH_AT} fromX={-180} fromY={110}>
                    <Button tone="ink" pressAt={AUTH_AT}>
                      {frame >= AUTH_AT ? "Autorizado ✓" : "Autorizar"}
                    </Button>
                  </Clickable>
                </Card>
              </FadeUp>
            )}
          </Phase>

          <Phase from={AUTH_AT + 40} to={999}>
            <ReplyAuthor>Análise concluída · política Mesa padrão v3.2</ReplyAuthor>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
              <Card>
                <Label style={{ fontSize: 14 }}>9 TÍTULOS · VALOR BRUTO</Label>
                <div style={{ fontSize: 50, fontWeight: 800, color: theme.slate, letterSpacing: -1.2 }}>
                  <CountUp to={97830} start={AUTH_AT + 44} duration={26} format={brl} />
                </div>
              </Card>
              <Card>
                <Label style={{ fontSize: 14 }}>SCORE DO CEDENTE</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 50, fontWeight: 800, color: theme.slate, letterSpacing: -1.2 }}>
                    <CountUp to={742} start={AUTH_AT + 48} duration={26} />
                  </span>
                  <Chip tone="good">Positivo</Chip>
                </div>
              </Card>
            </div>
            <FadeUp delay={AUTH_AT + 58}>
              <Card style={{ display: "flex", gap: 14, alignItems: "center", borderColor: "rgb(220 38 38 / 28%)" }}>
                <span style={iconBox(theme.critical, theme.criticalSoft)}>!</span>
                <div>
                  <Chip tone="bad">Bloqueio</Chip>
                  <div style={{ fontSize: 21, color: theme.slate, fontWeight: 700, marginTop: 6 }}>
                    NF 1175-3 já foi negociada em outra operação
                  </div>
                </div>
              </Card>
            </FadeUp>
            <FadeUp delay={AUTH_AT + 66}>
              <Card style={{ display: "flex", gap: 14, alignItems: "center", borderColor: "rgb(217 119 6 / 30%)" }}>
                <span style={iconBox(theme.warning, theme.warningSoft)}>%</span>
                <div>
                  <Chip tone="warn">Exceção · concentração</Chip>
                  <div style={{ fontSize: 21, color: theme.slate, fontWeight: 700, marginTop: 6 }}>
                    Rede Mercantil Nacional: 36,8% do lote (limite 30%)
                  </div>
                </div>
              </Card>
            </FadeUp>
          </Phase>
        </div>
      </CopilotPanel>
    </Split>
  );
}

function iconBox(color: string, bg: string): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    flex: "0 0 46px",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 900,
    color,
    background: bg,
  };
}

/* 06 · Simulação de cenários versionados */
export function ScenarioScene() {
  const frame = useCurrentFrame();
  const cols = [
    { v: "v1", label: "Lote original", titles: "9", gross: 97830, rate: "2,9%", conc: "36,8%", ok: false, net: 93353 },
    { v: "v2", label: "Sem duplicado", titles: "8", gross: 91630, rate: "2,9%", conc: "39,3%", ok: false, net: 87430 },
    { v: "v3", label: "Enquadrado", titles: "7", gross: 79130, rate: "2,6%", conc: "29,7%", ok: true, net: 75838 },
  ];
  const rows: { key: string; render: (c: (typeof cols)[number]) => React.ReactNode }[] = [
    { key: "Títulos", render: c => c.titles },
    { key: "Bruto", render: c => brl(c.gross) },
    { key: "Taxa a.m.", render: c => c.rate },
    {
      key: "Maior sacado",
      render: c => (
        <span style={{ color: c.ok ? theme.good : theme.warning, fontWeight: 800 }}>
          {c.conc}
          {c.ok ? " ✓" : ""}
        </span>
      ),
    },
    { key: "Líquido", render: c => <b>{brl(c.net)}</b> },
  ];
  const highlight = interpolate(frame, [118, 134], [0, 1], clamp);
  const colBg = (ok: boolean) => (ok ? `rgb(37 99 235 / ${7 * highlight}%)` : "transparent");
  return (
    <Split
      caption={
        <Caption
          step="06"
          kicker="ANALISTA DE MESA"
          title="Simule, compare, enquadre."
          body="Retire títulos, teste taxas e compare cenários. Cada mudança gera uma versão nova — e todos os valores vêm do motor de preço do STRATO."
        />
      }
    >
      <CopilotPanel status="Distribuidora Aurora · cenário v3">
        <UserBubble delay={6}>
          <Typewriter text="O que eu ajusto para enquadrar?" start={10} speed={1.3} />
        </UserBubble>
        <FadeUp delay={44}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10, borderRadius: "24px 24px 24px 8px" }}>
            <ReplyAuthor>Analista de Mesa · motor de preço</ReplyAuthor>
            <span style={{ fontSize: 21, color: theme.slate, lineHeight: 1.45 }}>
              Retirar a <b>NF 1175-3</b> (duplicada) e a <b>NF 1187-2</b> leva a Rede Mercantil a{" "}
              <b style={{ color: theme.good }}>29,7%</b>, dentro do limite. Apliquei também a taxa de 2,6%.
            </span>
          </Card>
        </FadeUp>
        <FadeUp delay={70}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr 1fr 1fr",
              fontSize: 19,
              color: theme.slate,
              background: theme.elev,
              border: `1px solid ${theme.border}`,
              borderRadius: 20,
              padding: "6px 14px 10px",
            }}
          >
            <span />
            {cols.map(c => (
              <div
                key={c.v}
                style={{
                  padding: "10px 12px",
                  borderRadius: "14px 14px 0 0",
                  background: colBg(c.ok),
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 22, color: c.ok ? theme.blueDeep : theme.slate }}>{c.v}</b>
                  {c.ok && highlight > 0.5 && <Chip tone="good">Enquadrado</Chip>}
                </div>
                <span style={{ fontSize: 15, color: theme.text3 }}>{c.label}</span>
              </div>
            ))}
            {rows.map(r => (
              <React.Fragment key={r.key}>
                <span
                  style={{
                    padding: "10px 0",
                    color: theme.text3,
                    fontWeight: 700,
                    borderTop: `1px solid ${theme.border}`,
                  }}
                >
                  {r.key}
                </span>
                {cols.map(c => (
                  <span
                    key={c.v + r.key}
                    style={{ padding: "10px 12px", borderTop: `1px solid ${theme.border}`, background: colBg(c.ok) }}
                  >
                    {r.render(c)}
                  </span>
                ))}
              </React.Fragment>
            ))}
          </div>
        </FadeUp>
      </CopilotPanel>
    </Split>
  );
}

function PrincipleColumn({
  index,
  title,
  icon,
  lines,
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  lines: string[];
}) {
  const p = useEnter(30 + index * 14);
  return (
    <div
      style={{
        width: 470,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        opacity: p,
        transform: `translateY(${(1 - p) * 26}px)`,
      }}
    >
      <div style={{ zIndex: 1 }}>{icon}</div>
      <b style={{ fontSize: 38, color: "#fff" }}>{title}</b>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "rgb(255 255 255 / 7%)",
          border: "1px solid rgb(255 255 255 / 14%)",
          borderRadius: 24,
          padding: "22px 26px",
        }}
      >
        {lines.map((l, li) => (
          <FadeUp key={l} delay={50 + index * 14 + li * 5} distance={8}>
            <div style={{ fontSize: 25, color: theme.onNavy, display: "flex", gap: 12, alignItems: "center" }}>
              <i style={{ width: 7, height: 7, borderRadius: 99, background: theme.blueLight }} />
              {l}
            </div>
          </FadeUp>
        ))}
      </div>
    </div>
  );
}

/* 07 · IA explica, motor calcula, pessoa decide */
export function PrinciplesScene() {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [40, 100], [0, 1], clamp);
  const tileStyle = (bg: string, color: string): React.CSSProperties => ({
    width: 108,
    height: 108,
    borderRadius: 34,
    display: "grid",
    placeItems: "center",
    background: bg,
    color,
    border: "1px solid rgb(255 255 255 / 22%)",
    boxShadow: "0 12px 30px rgb(2 8 23 / 35%)",
  });
  return (
    <AbsoluteFill
      style={{ fontFamily: theme.font, alignItems: "center", justifyContent: "center", gap: 66, paddingBottom: 40 }}
    >
      <div style={{ textAlign: "center" }}>
        <FadeUp delay={2}>
          <div style={{ fontSize: 21, letterSpacing: 6, color: theme.kicker, fontWeight: 800 }}>07 · GOVERNANÇA</div>
        </FadeUp>
        <FadeUp delay={8}>
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: -3,
              color: "#fff",
              lineHeight: 1.1,
            }}
          >
            A IA explica. O motor calcula.
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #bfdbfe, #60a5fa)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Você decide.
            </span>
          </h1>
        </FadeUp>
      </div>
      <div style={{ display: "flex", gap: 50, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 54,
            left: 235,
            height: 2,
            width: line * 1040,
            background: "linear-gradient(90deg, rgb(191 219 254 / 70%), rgb(96 165 250 / 70%))",
          }}
        />
        <PrincipleColumn
          index={0}
          title="IA"
          icon={
            <div style={tileStyle(theme.avatarGradient, theme.slate)}>
              <SparkIcon size={50} color={theme.slate} />
            </div>
          }
          lines={["Resume o dia", "Explica apontamentos", "Sugere ajustes", "Conversa em português"]}
        />
        <PrincipleColumn
          index={1}
          title="Motor de políticas"
          icon={
            <div style={tileStyle(theme.tileGradient, "#fff")}>
              <span style={{ fontFamily: theme.mono, fontSize: 34, fontWeight: 700 }}>ƒx</span>
            </div>
          }
          lines={["Calcula preço e líquido", "Aplica regras versionadas", "Define a alçada", "Funciona mesmo sem IA"]}
        />
        <PrincipleColumn
          index={2}
          title="Você"
          icon={
            <div style={tileStyle("#fff", theme.good)}>
              <span style={{ fontSize: 46, fontWeight: 900 }}>✓</span>
            </div>
          }
          lines={["Aprova ou reprova", "Justifica a decisão", "Responde pela alçada", "Mantém o controle"]}
        />
      </div>
    </AbsoluteFill>
  );
}

/* 08 · Decisão da alçada e trilha imutável */
export function DecisionScene() {
  const frame = useCurrentFrame();
  const APPROVE_AT = 96;
  const approved = frame >= APPROVE_AT;
  const trail = [
    ["08:42", "Análise v1 gerada pelo motor", "Copiloto"],
    ["08:47", "Cenário v3 · títulos retirados e taxa 2,6%", "Ana Souza · Mesa"],
    ["08:49", "Enviado para alçada: Diretoria de crédito", "Ana Souza · Mesa"],
    ["09:05", "Aprovada com justificativa · política v3.2", "Diretoria de crédito"],
  ];
  return (
    <Split
      caption={
        <Caption
          step="08"
          kicker="DECISÃO E TRILHA"
          title="Decisão humana. Registro permanente."
          body="Exceções sobem para a alçada certa com justificativa obrigatória. Cada evento grava empresa, pessoa, horário e versão — sem edição nem exclusão."
        />
      }
    >
      <CopilotPanel
        status={approved ? "Aprovada · fila de formalização" : "Aguardando Diretoria de crédito"}
        state={approved ? "on" : "wait"}
      >
        <FadeUp delay={8}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 19, color: theme.text2 }}>
              A decisão vale somente para esta operação, esta política e esta janela de validade.
            </span>
            <Label style={{ fontSize: 14 }}>JUSTIFICATIVA OBRIGATÓRIA</Label>
            <div
              style={{
                minHeight: 64,
                background: theme.elev,
                border: `1px solid ${frame > 20 && !approved ? theme.blue : theme.borderStrong}`,
                boxShadow: frame > 20 && !approved ? "0 0 0 4px rgb(37 99 235 / 10%)" : "none",
                borderRadius: 14,
                padding: "12px 16px",
                fontSize: 20,
                color: theme.slate,
                lineHeight: 1.4,
              }}
            >
              <Typewriter
                text="Cedente com 742 de score; lote enquadrado em 29,7%. Aprovado para esta janela."
                start={22}
                speed={1.5}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
              <Button tone="ghost">Reprovar</Button>
              <Clickable clickAt={APPROVE_AT} fromX={-240} fromY={-120}>
                <Button tone="good" pressAt={APPROVE_AT}>
                  {approved ? "Aprovada ✓" : "Aprovar como Diretoria"}
                </Button>
              </Clickable>
            </div>
          </Card>
        </FadeUp>
        <FadeUp delay={106}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>TRILHA DE DECISÃO</Label>
            <Chip tone="blue">Imutável · sem edição ou exclusão</Chip>
          </div>
        </FadeUp>
        {trail.map(([t, what, who], i) => (
          <FadeUp key={what} delay={112 + i * 8} distance={8}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 19 }}>
              <i
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 99,
                  background: i === 3 ? theme.good : theme.blue,
                  boxShadow: `0 0 0 4px ${i === 3 ? theme.goodSoft : "rgb(37 99 235 / 12%)"}`,
                }}
              />
              <span style={{ fontFamily: theme.mono, color: theme.text3, width: 60 }}>{t}</span>
              <span style={{ flex: 1, color: theme.slate, fontWeight: 700 }}>{what}</span>
              <span style={{ color: theme.text3 }}>{who}</span>
            </div>
          </FadeUp>
        ))}
      </CopilotPanel>
    </Split>
  );
}

/* Encerramento */
export function OutroScene() {
  const p = useEnter(0, 18);
  const items = ["Abertura do dia", "Central do Dia", "Consultas", "Mesa Inteligente", "Cenários", "Trilha de decisão"];
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", fontFamily: theme.font, gap: 32, color: "#fff" }}
    >
      <div style={{ opacity: p, transform: `scale(${0.8 + 0.2 * p})` }}>
        <Avatar size={128} />
      </div>
      <FadeUp delay={8}>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, textAlign: "center", lineHeight: 1 }}>
          Copiloto STRATO
        </div>
      </FadeUp>
      <FadeUp delay={16}>
        <div style={{ fontSize: 40, color: theme.onNavy, fontWeight: 500 }}>
          Menos procura. Mais decisão — com controle.
        </div>
      </FadeUp>
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        {items.map((it, i) => (
          <FadeUp key={it} delay={28 + i * 4} distance={8}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                background: "rgb(255 255 255 / 8%)",
                border: "1px solid rgb(255 255 255 / 16%)",
                borderRadius: 999,
                padding: "8px 16px",
              }}
            >
              {it}
            </span>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={56} style={{ marginTop: 40 }}>
        <Img src={staticFile("strato-logo-horizontal-negative.png")} style={{ height: 50, opacity: 0.92 }} />
      </FadeUp>
    </AbsoluteFill>
  );
}
