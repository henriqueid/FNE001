import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  Card,
  Caption,
  Chip,
  CopilotPanel,
  CountUp,
  FadeUp,
  Label,
  SparkIcon,
  Split,
  ToolTag,
  Typewriter,
  UserBubble,
  brl,
  useEnter,
  type Tone,
} from "./components";
import { theme } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Abertura */
export function IntroScene() {
  const mark = useEnter(0, 20);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: theme.font }}>
      <div
        style={{
          width: 168,
          height: 168,
          borderRadius: 52,
          background: theme.ink,
          display: "grid",
          placeItems: "center",
          opacity: mark,
          transform: `scale(${0.85 + 0.15 * mark})`,
          marginBottom: 52,
        }}
      >
        <SparkIcon size={84} color={theme.inkText} />
      </div>
      <FadeUp delay={12}>
        <Label style={{ fontSize: 24, letterSpacing: 8, display: "block", textAlign: "center" }}>
          STRATO INTELLIGENCE
        </Label>
      </FadeUp>
      <FadeUp delay={18}>
        <div style={{ fontSize: 150, fontWeight: 700, color: theme.text, letterSpacing: -5, lineHeight: 1.08 }}>
          Copiloto
        </div>
      </FadeUp>
      <FadeUp delay={28}>
        <div style={{ fontSize: 40, color: theme.text2, fontWeight: 500 }}>
          O parceiro operacional de quem decide sobre recebíveis
        </div>
      </FadeUp>
      <FadeUp delay={40} style={{ position: "absolute", bottom: 80 }}>
        <Img src={staticFile("strato-logo-horizontal-color.png")} style={{ height: 46 }} />
      </FadeUp>
    </AbsoluteFill>
  );
}

/* 01 · Sempre à mão: o lançador flutuante sobre o sistema */
export function LauncherScene() {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [50, 120], [1, 1.7], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const launcherIn = useEnter(10, 16);
  const dotIn = useEnter(26, 14);
  const nudgeIn = useEnter(40);
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
          title="Um ícone. Todas as telas."
          body="O Copiloto fica no canto do STRATO, em qualquer módulo. Ele avisa quando há decisões pendentes e quando uma análise termina."
        />
      }
    >
      <div
        style={{
          width: 900,
          height: 600,
          borderRadius: 24,
          background: theme.canvas,
          border: `1px solid ${theme.borderStrong}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transform: `scale(${zoom})`,
            transformOrigin: "91% 87%",
          }}
        >
          {/* Barra superior com os módulos (Visual Ledger v10) */}
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
                  fontWeight: 600,
                  color: i === 1 ? theme.inkText : theme.text3,
                  background: i === 1 ? theme.ink : theme.surface2,
                  borderRadius: 10,
                  padding: "8px 12px",
                }}
              >
                {m}
              </span>
            ))}
          </div>
          <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 700, color: theme.text }}>Operações</div>
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
          <div
            style={{
              position: "absolute",
              right: 124,
              bottom: 60,
              background: "#fdeaea",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#991b1b",
              fontFamily: theme.font,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 999,
              padding: "9px 16px",
              opacity: nudgeIn,
              transform: `translateY(${(1 - nudgeIn) * 8}px)`,
              whiteSpace: "nowrap",
            }}
          >
            2 decisões aguardam você
          </div>
          <div
            style={{
              position: "absolute",
              right: 48,
              bottom: 48,
              width: 60,
              height: 60,
              borderRadius: 99,
              background: theme.ink,
              display: "grid",
              placeItems: "center",
              opacity: launcherIn,
              transform: `translateY(${(1 - launcherIn) * 10}px)`,
              boxShadow: theme.shadowLg,
            }}
          >
            <SparkIcon size={26} color={theme.inkText} />
            <i
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: 99,
                background: theme.mint,
                border: `2px solid ${theme.elev}`,
                transform: `scale(${dotIn})`,
              }}
            />
          </div>
        </div>
      </div>
    </Split>
  );
}

/* 02 · Abertura do dia */
export function BriefingScene() {
  const meta = interpolate(useCurrentFrame(), [42, 72], [0, 72], clamp);
  const kpis: { label: string; value: React.ReactNode; color: string }[] = [
    { label: "Prioridades", value: <CountUp to={5} start={30} duration={20} />, color: theme.text },
    {
      label: "Carteira em aberto",
      value: (
        <>
          <CountUp to={4.8} start={34} format={v => `R$ ${v.toFixed(1).replace(".", ",")}`} /> mi
        </>
      ),
      color: theme.text,
    },
    { label: "Vencidos", value: <CountUp to={186420} start={38} format={brl} />, color: theme.danger },
    { label: "Meta de receita", value: <CountUp to={72} start={42} format={v => `${Math.round(v)}%`} />, color: theme.text },
  ];
  const agenda = [
    ["Agora", "Decidir aditivo da Rede Clínica", "Operações"],
    ["Até 11h", "Liberar Grupo Alfa Têxtil", "Financeiro"],
    ["Hoje", "Cobrar 6 títulos com +15 dias", "Carteira"],
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
      <CopilotPanel status="Bom dia · atualizado às 08:30" delay={6}>
        <FadeUp delay={20}>
          <Label>SEU DIA · ATUALIZADO AGORA</Label>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {kpis.map((k, i) => (
            <FadeUp key={k.label} delay={24 + i * 4}>
              <Card>
                <div style={{ fontSize: 18, color: theme.text3, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: k.color, marginTop: 4, letterSpacing: -0.5 }}>
                  {k.value}
                </div>
                {k.label === "Meta de receita" && (
                  <div style={{ height: 8, borderRadius: 99, background: theme.surface3, marginTop: 8 }}>
                    <div style={{ width: `${meta}%`, height: "100%", borderRadius: 99, background: theme.mint }} />
                  </div>
                )}
              </Card>
            </FadeUp>
          ))}
        </div>
        <FadeUp delay={56}>
          <Label style={{ marginTop: 4, display: "block" }}>AGENDA SUGERIDA</Label>
        </FadeUp>
        {agenda.map(([when, what, where], i) => (
          <FadeUp key={what} delay={62 + i * 8}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, color: theme.text }}>
              <span style={{ width: 92, color: i === 0 ? theme.danger : theme.text3, fontWeight: 700 }}>{when}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{what}</span>
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
  const items: { tone: Tone; bar: string; tag: string; title: string; summary: string; impact: string; action: string }[] = [
    {
      tone: "bad",
      bar: theme.danger,
      tag: "Decisão",
      title: "Rede Clínica aguarda decisão",
      summary: "2 bloqueios impedem o avanço na etapa Risco",
      impact: "R$ 420 mil em originação",
      action: "Revisar bloqueios e registrar a decisão",
    },
    {
      tone: "good",
      bar: theme.success,
      tag: "Liberação",
      title: "Liberar Grupo Alfa Têxtil",
      summary: "Validações concluídas, pronta para a janela financeira",
      impact: "R$ 318 mil prontos para pagamento",
      action: "Confirmar liberação",
    },
    {
      tone: "warn",
      bar: theme.warning,
      tag: "Ritmo",
      title: "Comercial Sul abaixo do ritmo",
      summary: "Originação 18% atrás da meta do mês",
      impact: "R$ 260 mil para recuperar",
      action: "Revisar funil com o comercial",
    },
    {
      tone: "neutral",
      bar: theme.text3,
      tag: "Cobrança",
      title: "6 títulos com mais de 15 dias",
      summary: "Concentrados em 2 sacados da carteira",
      impact: "R$ 74 mil vencidos",
      action: "Iniciar régua de cobrança",
    },
  ];
  const focus = interpolate(frame, [90, 108], [0, 1], clamp);
  return (
    <Split
      caption={
        <Caption
          step="03"
          kicker="CENTRAL DO DIA"
          title="Uma fila. O que importa primeiro."
          body="Decisões, liberações, desvios de ritmo e cobrança, com impacto, responsável e a próxima melhor ação. Um clique abre a tarefa sem perder o contexto."
        />
      }
    >
      <CopilotPanel status="4 tarefas pedem sua atenção" state="alert" delay={4}>
        {items.map((it, i) => (
          <FadeUp key={it.title} delay={18 + i * 10}>
            <div
              style={{
                display: "flex",
                gap: 18,
                padding: "16px 20px",
                borderRadius: 20,
                background: theme.surface,
                outline: i === 0 ? `2px solid rgba(13,13,13,${focus})` : "none",
                opacity: i === 0 ? 1 : 1 - focus * 0.45,
              }}
            >
              <div style={{ width: 5, borderRadius: 99, background: it.bar }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontSize: 23, color: theme.text }}>{it.title}</b>
                  <Chip tone={it.tone}>{it.tag}</Chip>
                </div>
                <span style={{ fontSize: 19, color: theme.text2 }}>{it.summary}</span>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, marginTop: 4 }}>
                  <span style={{ color: theme.text, fontWeight: 700 }}>{it.impact}</span>
                  <span
                    style={{ color: theme.text, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4 }}
                  >
                    {it.action} →
                  </span>
                </div>
              </div>
            </div>
          </FadeUp>
        ))}
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              border: `1px solid ${theme.border}`,
              borderRadius: "24px 24px 24px 6px",
              padding: "20px 22px",
            }}
          >
            <ToolTag>Consulta à carteira</ToolTag>
            <div style={{ fontSize: 27, color: theme.text, fontWeight: 700 }}>
              12 títulos vencidos somam{" "}
              <span style={{ color: theme.danger }}>
                <CountUp to={186420} start={58} format={brl} />
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: grid, padding: "6px 0" }}>
                <Label style={{ fontSize: 15 }}>SACADO</Label>
                <Label style={{ fontSize: 15 }}>QTD.</Label>
                <Label style={{ fontSize: 15 }}>VALOR</Label>
                <Label style={{ fontSize: 15 }}>MAIOR ATRASO</Label>
              </div>
              {rows.map((r, i) => (
                <FadeUp key={r[0]} delay={66 + i * 6} distance={8}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: grid,
                      fontSize: 20,
                      color: theme.text,
                      padding: "10px 0",
                      borderTop: `1px solid ${theme.border}`,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{r[0]}</span>
                    <span>{r[1]}</span>
                    <span>{r[2]}</span>
                    <span>{r[3]}</span>
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={92}>
              <span style={{ fontSize: 17, color: theme.text3 }}>
                Fonte: Carteira · títulos em aberto · atualizado às 08:30
              </span>
            </FadeUp>
          </div>
        </FadeUp>
        <FadeUp delay={104}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Resumo da carteira", "Maiores sacados da carteira", "Qual a regra de concentração de sacado?"].map(c => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </FadeUp>
      </CopilotPanel>
    </Split>
  );
}
