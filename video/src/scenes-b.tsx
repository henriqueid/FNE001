import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  BusyRing,
  Card,
  Caption,
  Chip,
  CopilotPanel,
  CountUp,
  FadeUp,
  GhostButton,
  Label,
  PrimaryButton,
  SparkIcon,
  Split,
  ToolTag,
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
  return <div style={{ opacity, display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>;
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
    ["XML", "lote_nfe_outubro.xml", "NF-e com duplicatas"],
    ["CNAB", "remessa_cnab400.rem", "CNAB 400"],
    ["XLS", "extrato_padrao.xlsx", "Layout padrão de extrato"],
  ];
  // As etapas avançam a cada 16 frames; a consulta ao birô espera a autorização.
  const AUTH_AT = 150;
  const stageDone = (i: number) => {
    if (i < 3) return frame >= 90 + i * 16;
    if (i === 3) return frame >= AUTH_AT + 14;
    return frame >= AUTH_AT + 30;
  };
  const waiting = frame >= 138 && frame < AUTH_AT;
  const busy = frame >= 80 && frame < 196 && !waiting;
  const state: DotState = waiting ? "wait" : busy ? "busy" : "on";
  const status =
    frame < 80
      ? "Pronto para ajudar"
      : waiting
        ? "Aguardando sua autorização"
        : frame < 196
          ? "Analisando em segundo plano"
          : "Distribuidora Aurora, cenário v1";
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
        <div style={{ minHeight: 440 }}>
          <Phase from={0} to={84}>
            <FadeUp delay={8}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>NOVA ANÁLISE</Label>
                <Chip>Cedente: Distribuidora Aurora</Chip>
              </div>
            </FadeUp>
            {files.map(([fmt, name, detail], i) => {
              const p = interpolate(frame, [16 + i * 12, 30 + i * 12], [0, 1], clamp);
              return (
                <div
                  key={name}
                  style={{
                    opacity: p,
                    transform: `translateY(${(1 - p) * -24}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    background: theme.surface,
                    borderRadius: 20,
                    padding: "16px 20px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: theme.text,
                      background: theme.elev,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "8px 0",
                      width: 78,
                      textAlign: "center",
                    }}
                  >
                    {fmt}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <b style={{ fontSize: 22, color: theme.text }}>{name}</b>
                    <span style={{ fontSize: 18, color: theme.text3 }}>{detail}</span>
                  </div>
                </div>
              );
            })}
            <FadeUp delay={58} style={{ alignSelf: "flex-end" }}>
              <PrimaryButton pressAt={74}>Analisar lote →</PrimaryButton>
            </FadeUp>
          </Phase>

          <Phase from={84} to={200}>
            <Label>TAREFA EM SEGUNDO PLANO</Label>
            {STAGES.map((label, i) => {
              const done = stageDone(i);
              const active = !done && (i === 0 || stageDone(i - 1));
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontSize: 23,
                    color: done || active ? theme.text : theme.text3,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      width: 30,
                      height: 30,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 17,
                      fontWeight: 800,
                      background: done ? theme.ink : "transparent",
                      color: theme.inkText,
                      border: done ? "none" : `2px solid ${active && waiting ? theme.warning : theme.borderStrong}`,
                    }}
                  >
                    {done ? "✓" : ""}
                    {active && !waiting && <BusyRing inset={-2} />}
                  </span>
                  {label}
                </div>
              );
            })}
            {frame >= 132 && frame < AUTH_AT + 24 && (
              <FadeUp delay={132}>
                <Card style={{ display: "flex", alignItems: "center", gap: 18, background: theme.warningSoft }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 22, color: theme.text }}>Novo sacado: Mercantil Boa Vista</b>
                    <div style={{ fontSize: 18, color: theme.text2 }}>
                      Posso consultar o birô de crédito? A consulta tem custo.
                    </div>
                  </div>
                  <PrimaryButton pressAt={AUTH_AT}>{frame >= AUTH_AT ? "Autorizado ✓" : "Autorizar"}</PrimaryButton>
                </Card>
              </FadeUp>
            )}
          </Phase>

          <Phase from={200} to={400}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <Label>9 TÍTULOS · VALOR BRUTO</Label>
                <div style={{ fontSize: 54, fontWeight: 700, color: theme.text, letterSpacing: -1 }}>
                  <CountUp to={97830} start={204} duration={26} format={brl} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Label>SCORE DO CEDENTE</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 54, fontWeight: 700, color: theme.text, letterSpacing: -1 }}>
                    <CountUp to={742} start={210} duration={26} />
                  </span>
                  <Chip tone="mint">Positivo</Chip>
                </div>
              </div>
            </div>
            <FadeUp delay={222}>
              <Card style={{ background: theme.dangerSoft }}>
                <Chip tone="bad">Bloqueio</Chip>
                <div style={{ fontSize: 22, color: theme.text, fontWeight: 700, marginTop: 10 }}>
                  NF 1175-3 já foi negociada em outra operação
                </div>
              </Card>
            </FadeUp>
            <FadeUp delay={232}>
              <Card style={{ background: theme.warningSoft }}>
                <Chip tone="warn">Exceção · Política Mesa padrão v3.2</Chip>
                <div style={{ fontSize: 22, color: theme.text, fontWeight: 700, marginTop: 10 }}>
                  Rede Mercantil Nacional concentra 36,8% do lote (limite 30%)
                </div>
              </Card>
            </FadeUp>
          </Phase>
        </div>
      </CopilotPanel>
    </Split>
  );
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
      render: c => <span style={{ color: c.ok ? theme.success : theme.warning, fontWeight: 700 }}>{c.conc}</span>,
    },
    { key: "Líquido", render: c => <b>{brl(c.net)}</b> },
  ];
  const highlight = interpolate(frame, [120, 136], [0, 1], clamp);
  const colBg = (ok: boolean) => (ok ? `rgba(117, 248, 144, ${0.28 * highlight})` : "transparent");
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
      <CopilotPanel status="Distribuidora Aurora, cenário v3">
        <UserBubble delay={6}>
          <Typewriter text="O que eu ajusto para enquadrar?" start={10} speed={1.3} />
        </UserBubble>
        <FadeUp delay={44}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              border: `1px solid ${theme.border}`,
              borderRadius: "24px 24px 24px 6px",
              padding: "18px 22px",
              fontSize: 21,
              color: theme.text,
              lineHeight: 1.45,
            }}
          >
            <ToolTag>Analista de Mesa · motor de preço</ToolTag>
            <span>
              Retirar a <b>NF 1175-3</b> (duplicada) e a <b>NF 1187-2</b> leva a Rede Mercantil a <b>29,7%</b>, dentro
              do limite. Apliquei também a taxa de 2,6%.
            </span>
          </div>
        </FadeUp>
        <FadeUp delay={70}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr", fontSize: 19, color: theme.text }}>
            <span />
            {cols.map(c => (
              <div key={c.v} style={{ padding: "10px 12px", borderRadius: "14px 14px 0 0", background: colBg(c.ok) }}>
                <b style={{ fontSize: 22 }}>{c.v}</b>
                <div style={{ fontSize: 15, color: theme.text3 }}>{c.label}</div>
              </div>
            ))}
            {rows.map((r, ri) => (
              <React.Fragment key={r.key}>
                <span style={{ padding: "10px 0", color: theme.text3, fontWeight: 600, borderTop: `1px solid ${theme.border}` }}>
                  {r.key}
                </span>
                {cols.map(c => (
                  <span
                    key={c.v + r.key}
                    style={{
                      padding: "10px 12px",
                      borderTop: `1px solid ${theme.border}`,
                      background: colBg(c.ok),
                      borderRadius: ri === rows.length - 1 && c.ok ? "0 0 14px 14px" : 0,
                    }}
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
  inverted,
  lines,
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  inverted: boolean;
  lines: string[];
}) {
  const p = useEnter(30 + index * 14);
  return (
    <div
      style={{
        width: 460,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: 32,
          background: inverted ? theme.ink : theme.elev,
          border: inverted ? "none" : `1px solid ${theme.borderStrong}`,
          display: "grid",
          placeItems: "center",
          color: inverted ? theme.inkText : theme.text,
          zIndex: 1,
        }}
      >
        {icon}
      </div>
      <b style={{ fontSize: 38, color: theme.text }}>{title}</b>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: theme.elev,
          borderRadius: 24,
          padding: "22px 26px",
        }}
      >
        {lines.map((l, li) => (
          <FadeUp key={l} delay={50 + index * 14 + li * 5} distance={8}>
            <div style={{ fontSize: 25, color: theme.text2, display: "flex", gap: 12 }}>
              <span style={{ color: theme.text3 }}>—</span>
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
  const mark = interpolate(frame, [24, 44], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, alignItems: "center", justifyContent: "center", gap: 70 }}>
      <div style={{ textAlign: "center" }}>
        <FadeUp delay={2}>
          <Label style={{ fontSize: 22, letterSpacing: 5 }}>07 · GOVERNANÇA</Label>
        </FadeUp>
        <FadeUp delay={8}>
          <h1 style={{ margin: "16px 0 0", fontSize: 86, fontWeight: 700, letterSpacing: -3, color: theme.text, lineHeight: 1.12 }}>
            A IA explica. O motor calcula.
            <br />
            <span
              style={{
                padding: "0 14px",
                borderRadius: 14,
                background: `linear-gradient(${theme.mint}, ${theme.mint}) no-repeat left / ${mark * 100}% 100%`,
              }}
            >
              Você decide.
            </span>
          </h1>
        </FadeUp>
      </div>
      <div style={{ display: "flex", gap: 56, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 230,
            height: 2,
            width: line * 1032,
            background: theme.borderStrong,
          }}
        />
        <PrincipleColumn
          index={0}
          title="IA"
          inverted
          icon={<SparkIcon size={44} color={theme.inkText} />}
          lines={["Resume o dia", "Explica apontamentos", "Sugere ajustes", "Conversa em português"]}
        />
        <PrincipleColumn
          index={1}
          title="Motor de políticas"
          inverted={false}
          icon={<span style={{ fontFamily: theme.mono, fontSize: 32, fontWeight: 700 }}>ƒx</span>}
          lines={["Calcula preço e líquido", "Aplica regras versionadas", "Define a alçada", "Funciona mesmo sem IA"]}
        />
        <PrincipleColumn
          index={2}
          title="Você"
          inverted
          icon={<span style={{ fontSize: 40, fontWeight: 800 }}>✓</span>}
          lines={["Aprova ou reprova", "Justifica a decisão", "Responde pela alçada", "Mantém o controle"]}
        />
      </div>
    </AbsoluteFill>
  );
}

/* 08 · Decisão da alçada e trilha imutável */
export function DecisionScene() {
  const frame = useCurrentFrame();
  const APPROVE_AT = 92;
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
            <Label style={{ fontSize: 15 }}>JUSTIFICATIVA OBRIGATÓRIA</Label>
            <div
              style={{
                minHeight: 64,
                background: theme.elev,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: 14,
                padding: "12px 16px",
                fontSize: 20,
                color: theme.text,
                lineHeight: 1.4,
              }}
            >
              <Typewriter
                text="Cedente com 742 de score; lote enquadrado em 29,7%. Aprovado para esta janela."
                start={22}
                speed={1.4}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center" }}>
              <GhostButton>Reprovar</GhostButton>
              <PrimaryButton pressAt={APPROVE_AT} tone={approved ? "mint" : "ink"}>
                {approved ? "Aprovada ✓" : "Aprovar como Diretoria"}
              </PrimaryButton>
            </div>
          </Card>
        </FadeUp>
        <FadeUp delay={100}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>TRILHA DE DECISÃO</Label>
            <Chip>Imutável · sem edição ou exclusão</Chip>
          </div>
        </FadeUp>
        {trail.map(([t, what, who], i) => (
          <FadeUp key={what} delay={106 + i * 8} distance={8}>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                fontSize: 19,
                borderLeft: `3px solid ${i === 3 ? theme.ink : theme.borderStrong}`,
                paddingLeft: 16,
              }}
            >
              <span style={{ fontFamily: theme.mono, color: theme.text3, width: 64 }}>{t}</span>
              <span style={{ flex: 1, color: theme.text, fontWeight: 600 }}>{what}</span>
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
  const p = useEnter(0, 20);
  const items = ["Abertura do dia", "Central do Dia", "Consultas", "Mesa Inteligente", "Cenários", "Trilha de decisão"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: theme.font, gap: 34 }}>
      <div
        style={{
          width: 124,
          height: 124,
          borderRadius: 38,
          background: theme.ink,
          display: "grid",
          placeItems: "center",
          opacity: p,
          transform: `scale(${0.85 + 0.15 * p})`,
        }}
      >
        <SparkIcon size={64} color={theme.inkText} />
      </div>
      <FadeUp delay={8}>
        <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -4, color: theme.text, textAlign: "center", lineHeight: 1 }}>
          Copiloto STRATO
        </div>
      </FadeUp>
      <FadeUp delay={16}>
        <div style={{ fontSize: 40, color: theme.text2, fontWeight: 500 }}>Menos procura. Mais decisão — com controle.</div>
      </FadeUp>
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        {items.map((it, i) => (
          <FadeUp key={it} delay={28 + i * 4} distance={8}>
            <Chip>{it}</Chip>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={56} style={{ marginTop: 40 }}>
        <Img src={staticFile("strato-logo-horizontal-color.png")} style={{ height: 50 }} />
      </FadeUp>
    </AbsoluteFill>
  );
}
