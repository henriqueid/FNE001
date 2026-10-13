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
  Launcher,
  ProgressBar,
  ReplyAuthor,
  Split,
  Tile,
  Typewriter,
  UserBubble,
  brl,
  useEnter,
} from "./components";
import { theme } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Abertura · identidade STRATO Intelligence */
export function IntroScene() {
  const frame = useCurrentFrame();
  const mark = useEnter(0, 18);
  const rings = [0, 1, 2];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: theme.font, color: "#fff" }}>
      <div style={{ position: "relative", marginBottom: 56 }}>
        {rings.map(i => {
          const t = ((frame / 90 + i / 3) % 1 + 1) % 1;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 180 + t * 260,
                height: 180 + t * 260,
                borderRadius: 60 + t * 70,
                border: "1.5px solid rgb(147 197 253 / 50%)",
                opacity: (1 - t) * mark,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
        <div style={{ opacity: mark, transform: `scale(${0.8 + 0.2 * mark})` }}>
          <Avatar size={176} />
        </div>
      </div>
      <FadeUp delay={12}>
        <div style={{ fontSize: 24, letterSpacing: 9, color: theme.kicker, fontWeight: 800, textAlign: "center" }}>
          STRATO INTELLIGENCE
        </div>
      </FadeUp>
      <FadeUp delay={18}>
        <div style={{ fontSize: 156, fontWeight: 800, letterSpacing: -6, lineHeight: 1.08 }}>Copiloto</div>
      </FadeUp>
      <FadeUp delay={28}>
        <div style={{ fontSize: 40, color: theme.onNavy, fontWeight: 500 }}>
          O parceiro operacional de quem decide sobre recebíveis
        </div>
      </FadeUp>
      <FadeUp delay={40} style={{ position: "absolute", bottom: 78 }}>
        <Img src={staticFile("strato-logo-horizontal-negative.png")} style={{ height: 44, opacity: 0.9 }} />
      </FadeUp>
    </AbsoluteFill>
  );
}

/* 01 · Sempre à mão: lançador sobre o sistema; um clique abre o Copiloto */
export function LauncherScene() {
  const frame = useCurrentFrame();
  const CLICK = 96;
  const launcherIn = useEnter(8, 16);
  const nudgeIn = useEnter(30);
  const open = useEnter(CLICK + 2, 18);
  const isOpen = frame >= CLICK;
  const block = (w: number | string, h: number) => (
    <div style={{ width: w, height: h, borderRadius: 16, background: theme.elev }} />
  );
  const modules = ["Visão geral", "Operações", "Carteira", "Comercial", "Financeiro"];
  return (
    <Split
      caption={
        <Caption
          step="01"
          kicker="SEMPRE À MÃO"
          title="Um clique. Em qualquer tela."
          body="O Copiloto fica no canto do STRATO, em todos os módulos. Avisa quando há decisões pendentes e abre sem tirar você do que está fazendo."
        />
      }
    >
      <div
        style={{
          position: "relative",
          width: 900,
          height: 600,
          borderRadius: 26,
          background: theme.canvas,
          border: `1px solid ${theme.borderStrong}`,
          overflow: "hidden",
          boxShadow: theme.shadowPanel,
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 22px",
            background: theme.elev,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <Img src={staticFile("strato-logo-horizontal-color.png")} style={{ height: 22, marginRight: 18 }} />
          {modules.map((m, i) => (
            <span
              key={m}
              style={{
                fontFamily: theme.font,
                fontSize: 14,
                fontWeight: 700,
                color: i === 1 ? "#fff" : theme.text3,
                background: i === 1 ? theme.ink : theme.surface2,
                borderRadius: 10,
                padding: "8px 12px",
              }}
            >
              {m}
            </span>
          ))}
        </div>
        <div
          style={{
            padding: 26,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            filter: `blur(${open * 2}px)`,
            opacity: 1 - open * 0.25,
          }}
        >
          <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 800, color: theme.slate }}>Operações</div>
          <div style={{ display: "flex", gap: 14 }}>
            {block("33%", 100)}
            {block("33%", 100)}
            {block("33%", 100)}
          </div>
          {block("100%", 46)}
          {block("100%", 46)}
          {block("100%", 46)}
          {block("100%", 46)}
        </div>

        {/* Caixa do Copiloto abrindo a partir do lançador */}
        {isOpen && (
          <div
            style={{
              position: "absolute",
              right: 28,
              bottom: 112,
              width: 400,
              borderRadius: 24,
              overflow: "hidden",
              background: theme.elev,
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.shadowPanel,
              transformOrigin: "bottom right",
              transform: `scale(${0.85 + 0.15 * open})`,
              opacity: open,
              fontFamily: theme.font,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 18px",
                background: theme.headGradient,
                color: "#fff",
              }}
            >
              <Avatar size={40} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, letterSpacing: 2, color: theme.kicker, fontWeight: 800 }}>
                  STRATO INTELLIGENCE
                </span>
                <b style={{ fontSize: 17 }}>Copiloto operacional</b>
              </div>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgb(17 24 39 / 18%)",
                  background: "linear-gradient(120deg, rgb(17 24 39 / 4%), #fff)",
                }}
              >
                <Tile size={34} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: theme.text3 }}>
                    SEU DIA · ATUALIZADO AGORA
                  </span>
                  <b style={{ fontSize: 15, color: theme.slate }}>4 tarefas pedem sua atenção</b>
                </div>
                <div style={{ textAlign: "right" }}>
                  <b style={{ fontSize: 17, color: theme.slate }}>72%</b>
                  <div style={{ fontSize: 11, color: theme.text3 }}>da meta</div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.slate, letterSpacing: -0.4 }}>
                Como posso ajudar agora?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Resumo da carteira", "Analisar um lote", "Títulos vencidos", "Regras da política"].map(t => (
                  <span
                    key={t}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: theme.slate,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "12px 12px",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isOpen && (
          <div
            style={{
              position: "absolute",
              right: 112,
              bottom: 44,
              background: "#fdeaea",
              border: "1px solid rgb(239 68 68 / 30%)",
              color: "#991b1b",
              fontFamily: theme.font,
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 999,
              padding: "10px 16px",
              opacity: nudgeIn,
              transform: `translateX(${(1 - nudgeIn) * 16}px)`,
              whiteSpace: "nowrap",
            }}
          >
            2 decisões aguardam você
          </div>
        )}
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: 28,
            opacity: launcherIn,
            transform: `translateY(${(1 - launcherIn) * 12}px)`,
          }}
        >
          <Clickable clickAt={CLICK} fromX={-260} fromY={-170}>
            <Launcher size={64} ring={interpolate(frame, [CLICK - 16, CLICK - 4], [0, 1], clamp)} />
          </Clickable>
          {!isOpen && (
            <i
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 24,
                height: 24,
                borderRadius: 99,
                background: theme.critical,
                color: "#fff",
                fontStyle: "normal",
                fontFamily: theme.font,
                fontSize: 13,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                border: "2px solid #fff",
                transform: `scale(${popIn(frame, 22)})`,
              }}
            >
              4
            </i>
          )}
        </div>
      </div>
    </Split>
  );
}

function popIn(frame: number, delay: number) {
  return interpolate(frame, [delay, delay + 8], [0, 1], clamp);
}

/* 02 · Abertura do dia */
export function BriefingScene() {
  const frame = useCurrentFrame();
  const meta = interpolate(frame, [42, 76], [0, 72], clamp);
  const kpis: { label: string; value: React.ReactNode; color: string; hint: string }[] = [
    { label: "Prioridades", value: <CountUp to={5} start={30} duration={20} />, color: theme.slate, hint: "2 críticas" },
    {
      label: "Carteira em aberto",
      value: (
        <>
          <CountUp to={4.8} start={34} format={v => `R$ ${v.toFixed(1).replace(".", ",")}`} /> mi
        </>
      ),
      color: theme.slate,
      hint: "312 títulos",
    },
    {
      label: "Vencidos",
      value: <CountUp to={186420} start={38} format={brl} />,
      color: theme.critical,
      hint: "12 títulos",
    },
    {
      label: "Meta de receita",
      value: <CountUp to={72} start={42} format={v => `${Math.round(v)}%`} />,
      color: theme.slate,
      hint: "no ritmo",
    },
  ];
  const agenda: [string, string, string, string][] = [
    ["Agora", "Decidir aditivo da Rede Clínica", "Operações", theme.critical],
    ["Até 11h", "Liberar Grupo Alfa Têxtil", "Financeiro", theme.good],
    ["Hoje", "Cobrar 6 títulos com +15 dias", "Carteira", theme.warning],
  ];
  return (
    <Split
      caption={
        <Caption
          step="02"
          kicker="ABERTURA DO DIA"
          title="Seu dia, resumido antes do café."
          body="Ao entrar, o Copiloto mostra prioridades, carteira, vencidos e ritmo da meta — filtrados pelo seu perfil, departamento e vínculos."
        />
      }
    >
      <CopilotPanel kicker="ABERTURA DO DIA" title="Bom dia! Aqui está o seu dia" status="Atualizado às 08:30" delay={6}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {kpis.map((k, i) => (
            <FadeUp key={k.label} delay={22 + i * 4}>
              <Card style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 17, color: theme.text3, fontWeight: 700 }}>{k.label}</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: k.color, marginTop: 2, letterSpacing: -0.8 }}>
                  {k.value}
                </div>
                {k.label === "Meta de receita" ? (
                  <div style={{ marginTop: 8 }}>
                    <ProgressBar value={meta} />
                  </div>
                ) : (
                  <div style={{ fontSize: 16, color: theme.text3, marginTop: 2 }}>{k.hint}</div>
                )}
              </Card>
            </FadeUp>
          ))}
        </div>
        <FadeUp delay={56}>
          <Label style={{ display: "block", marginTop: 2 }}>AGENDA SUGERIDA</Label>
        </FadeUp>
        {agenda.map(([when, what, where, color], i) => (
          <FadeUp key={what} delay={62 + i * 8}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 22,
                color: theme.slate,
                background: theme.elev,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                padding: "12px 16px",
              }}
            >
              <i style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
              <span style={{ width: 84, color: theme.text3, fontWeight: 700 }}>{when}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{what}</span>
              <Chip>{where} →</Chip>
            </div>
          </FadeUp>
        ))}
      </CopilotPanel>
    </Split>
  );
}

/* 03 · Central do Dia */
export function AttentionScene() {
  const frame = useCurrentFrame();
  const CLICK = 104;
  const selected = frame >= CLICK;
  const items = [
    {
      color: theme.critical,
      soft: theme.criticalSoft,
      icon: "!",
      tag: "Decisão",
      title: "Rede Clínica aguarda decisão",
      summary: "2 bloqueios impedem o avanço na etapa Risco",
      impact: "R$ 420 mil",
    },
    {
      color: theme.good,
      soft: theme.goodSoft,
      icon: "✓",
      tag: "Liberação",
      title: "Liberar Grupo Alfa Têxtil",
      summary: "Validações concluídas, pronta para a janela",
      impact: "R$ 318 mil",
    },
    {
      color: theme.warning,
      soft: theme.warningSoft,
      icon: "↘",
      tag: "Ritmo",
      title: "Comercial Sul abaixo do ritmo",
      summary: "Originação 18% atrás da meta do mês",
      impact: "R$ 260 mil",
    },
    {
      color: "#6d5bd0",
      soft: "rgb(109 91 208 / 11%)",
      icon: "$",
      tag: "Cobrança",
      title: "6 títulos com mais de 15 dias",
      summary: "Concentrados em 2 sacados da carteira",
      impact: "R$ 74 mil",
    },
  ];
  const filters: [string, number][] = [
    ["Todas", 4],
    ["Decisões", 1],
    ["Liberações", 1],
    ["Ritmo", 1],
    ["Cobrança", 1],
  ];
  return (
    <Split
      caption={
        <Caption
          step="03"
          kicker="CENTRAL DO DIA"
          title="Uma fila. O que importa primeiro."
          body="Decisões, liberações, desvios de ritmo e cobrança com impacto, responsável e a próxima melhor ação. Um clique abre a tarefa numa aba de trabalho."
        />
      }
    >
      <CopilotPanel kicker="STRATO INTELLIGENCE" title="Central do Dia" status="Ao vivo · 4 tarefas" delay={4}>
        <FadeUp delay={14}>
          <div style={{ display: "flex", gap: 8 }}>
            {filters.map(([name, n], i) => (
              <span
                key={name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "7px 13px",
                  color: i === 0 ? "#fff" : theme.text2,
                  background: i === 0 ? theme.ink : theme.elev,
                  border: `1px solid ${i === 0 ? theme.ink : theme.border}`,
                }}
              >
                {name}
                <b
                  style={{
                    fontSize: 13,
                    borderRadius: 99,
                    padding: "1px 7px",
                    background: i === 0 ? "rgb(255 255 255 / 15%)" : theme.surface2,
                  }}
                >
                  {n}
                </b>
              </span>
            ))}
          </div>
        </FadeUp>
        {items.map((it, i) => {
          const row = (
            <div
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                borderRadius: 18,
                background: theme.elev,
                border: `1px solid ${i === 0 && selected ? theme.blue : theme.border}`,
                boxShadow: i === 0 && selected ? "0 0 0 4px rgb(37 99 235 / 12%)" : theme.shadowSoft,
              }}
            >
              <span
                style={{
                  width: 46,
                  height: 46,
                  flex: "0 0 46px",
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  fontWeight: 900,
                  color: it.color,
                  background: it.soft,
                }}
              >
                {it.icon}
              </span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <b style={{ fontSize: 22, color: theme.slate }}>{it.title}</b>
                <span style={{ fontSize: 17, color: theme.text3 }}>{it.summary}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: it.color,
                    background: it.soft,
                    borderRadius: 99,
                    padding: "3px 10px",
                  }}
                >
                  {it.tag}
                </span>
                <b style={{ fontSize: 19, color: theme.slate }}>{it.impact}</b>
              </div>
            </div>
          );
          return (
            <FadeUp key={it.title} delay={20 + i * 8}>
              {i === 0 ? (
                <Clickable clickAt={CLICK} fromX={220} fromY={240} style={{ width: "100%" }}>
                  {row}
                </Clickable>
              ) : (
                row
              )}
            </FadeUp>
          );
        })}
        {selected && (
          <FadeUp delay={CLICK + 4}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 18,
                background: "rgb(37 99 235 / 6%)",
              }}
            >
              <div style={{ flex: 1 }}>
                <Label style={{ fontSize: 13 }}>PRÓXIMA MELHOR AÇÃO</Label>
                <div style={{ fontSize: 19, fontWeight: 700, color: theme.slate }}>
                  Revisar bloqueios e registrar a decisão · Risco e crédito
                </div>
              </div>
              <Button tone="ink">Abrir em aba →</Button>
            </div>
          </FadeUp>
        )}
      </CopilotPanel>
    </Split>
  );
}

/* 04 · Conversa com dados do sistema */
export function ChatScene() {
  const rows = [
    ["Supermercado Haag Ltda", "3", "R$ 61.200", "22 dias"],
    ["Comercial Oeste Ltda", "4", "R$ 48.950", "17 dias"],
    ["Cooperativa Vale Verde", "5", "R$ 76.270", "9 dias"],
  ];
  const grid = "2.2fr 0.6fr 1fr 0.9fr";
  return (
    <Split
      caption={
        <Caption
          step="04"
          kicker="PERGUNTE"
          title="Pergunte como falaria com um analista."
          body="Carteira, sacados, vencidos e regras de política respondidos com os dados do próprio STRATO — sempre com a fonte indicada."
        />
      }
    >
      <CopilotPanel status="Pronto para ajudar">
        <UserBubble delay={8}>
          <Typewriter text="Quais títulos estão vencidos?" start={14} speed={1.2} />
        </UserBubble>
        <FadeUp delay={52}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 14, borderRadius: "24px 24px 24px 8px" }}>
            <ReplyAuthor>Consulta à carteira</ReplyAuthor>
            <div style={{ fontSize: 27, color: theme.slate, fontWeight: 800, letterSpacing: -0.4 }}>
              12 títulos vencidos somam{" "}
              <span style={{ color: theme.critical }}>
                <CountUp to={186420} start={58} format={brl} />
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: grid, padding: "6px 0" }}>
                <Label style={{ fontSize: 14 }}>SACADO</Label>
                <Label style={{ fontSize: 14 }}>QTD.</Label>
                <Label style={{ fontSize: 14 }}>VALOR</Label>
                <Label style={{ fontSize: 14 }}>MAIOR ATRASO</Label>
              </div>
              {rows.map((r, i) => (
                <FadeUp key={r[0]} delay={66 + i * 6} distance={8}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: grid,
                      fontSize: 20,
                      color: theme.slate,
                      padding: "10px 0",
                      borderTop: `1px solid ${theme.border}`,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{r[0]}</span>
                    <span>{r[1]}</span>
                    <span>{r[2]}</span>
                    <span>{r[3]}</span>
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={92}>
              <div style={{ display: "flex", gap: 8 }}>
                <Chip tone="blue">Fonte: Carteira · títulos em aberto</Chip>
                <Chip>Atualizado às 08:30</Chip>
              </div>
            </FadeUp>
          </Card>
        </FadeUp>
        <FadeUp delay={104}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Resumo da carteira", "Maiores sacados", "Qual a regra de concentração?"].map(c => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </FadeUp>
      </CopilotPanel>
    </Split>
  );
}

