/** Cenas narrativas: por que existe a missão (abertura, problema, mercado, missão, fechamento). */
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar, FadeUp } from "../components";
import { theme } from "../theme";
import { Headline, useLayout } from "./layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ------------------------------------------------------------------ */
/* 1 · Abertura: recebíveis movem a economia real                      */
/* ------------------------------------------------------------------ */

const SECTORS = [
  { label: "Indústria", glyph: "▣" },
  { label: "Varejo", glyph: "◧" },
  { label: "Agronegócio", glyph: "✿" },
  { label: "Serviços", glyph: "◎" },
  { label: "Distribuição", glyph: "⇄" },
  { label: "Saúde", glyph: "✚" },
];

export function AberturaScene() {
  const frame = useCurrentFrame();
  const { portrait, width, height } = useLayout();
  // Posições: empresas em arco ao redor do centro.
  const cx = width / 2;
  const cy = portrait ? height * 0.5 : height * 0.6;
  const rx = portrait ? 360 : 640;
  const ry = portrait ? 400 : 215;
  const nodes = SECTORS.map((s, i) => {
    const a = -Math.PI / 2 + (i / SECTORS.length) * Math.PI * 2 + Math.PI / SECTORS.length;
    return { ...s, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
  const core = spring({ frame: frame - 6, fps: 30, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ fontFamily: theme.font }}>
      <div style={{ position: "absolute", top: portrait ? 190 : 110, left: 0, right: 0, padding: "0 60px" }}>
        <Headline kicker="A ECONOMIA REAL" title={<>Recebíveis movem<br />o Brasil.</>} dark align="center" size={portrait ? 84 : 84} />
      </div>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {nodes.map((n, i) => {
          const draw = interpolate(frame, [14 + i * 5, 40 + i * 5], [0, 1], clamp);
          return (
            <line
              key={n.label}
              x1={cx}
              y1={cy}
              x2={cx + (n.x - cx) * draw}
              y2={cy + (n.y - cy) * draw}
              stroke="rgb(147 197 253 / 35%)"
              strokeWidth={2}
              strokeDasharray="6 8"
            />
          );
        })}
      </svg>
      {/* Pulsos: notas fiscais indo ao centro, caixa voltando às empresas */}
      {nodes.map((n, i) =>
        [0, 1, 2].map(k => {
          const period = 54;
          const local = frame - 40 - i * 7 - k * (period / 3);
          if (local < 0) return null;
          const t = (local % period) / period;
          const toCore = Math.floor(local / period) % 2 === 0;
          const p = toCore ? t : 1 - t;
          const x = n.x + (cx - n.x) * p;
          const y = n.y + (cy - n.y) * p;
          return (
            <div
              key={`${n.label}-${k}`}
              style={{
                position: "absolute",
                left: x - (toCore ? 20 : 15),
                top: y - (toCore ? 13 : 15),
                width: toCore ? 40 : 30,
                height: toCore ? 26 : 30,
                borderRadius: toCore ? 6 : 99,
                background: toCore ? "#fff" : theme.mint,
                color: toCore ? theme.slate : theme.mintInk,
                fontSize: 12,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                opacity: Math.sin(Math.PI * t) * 0.95,
                boxShadow: "0 6px 16px rgb(2 8 23 / 35%)",
              }}
            >
              {toCore ? "NF-e" : "R$"}
            </div>
          );
        }),
      )}
      {nodes.map((n, i) => {
        const p = spring({ frame: frame - 10 - i * 5, fps: 30, config: { damping: 14 } });
        return (
          <div
            key={n.label}
            style={{
              position: "absolute",
              left: n.x - 90,
              top: n.y - 52,
              width: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              opacity: p,
              transform: `scale(${0.7 + 0.3 * p})`,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                display: "grid",
                placeItems: "center",
                fontSize: 32,
                color: "#fff",
                background: "rgb(255 255 255 / 10%)",
                border: "1px solid rgb(255 255 255 / 22%)",
              }}
            >
              {n.glyph}
            </div>
            <span style={{ color: theme.onNavy, fontSize: 22, fontWeight: 700 }}>{n.label}</span>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: cx - 150,
          top: cy - 90,
          width: 300,
          height: 180,
          borderRadius: 36,
          background: "linear-gradient(145deg, #0c1b31, #17315c)",
          border: "1px solid rgb(147 197 253 / 40%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transform: `scale(${core})`,
          boxShadow: "0 30px 80px rgb(2 8 23 / 45%), 0 0 0 8px rgb(96 165 250 / 10%)",
        }}
      >
        <span style={{ fontSize: 18, letterSpacing: 3, fontWeight: 800, color: theme.kicker }}>ANTECIPAÇÃO</span>
        <b style={{ fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 1.15 }}>
          Factoring
          <br />
          Securitizadora · FIDC
        </b>
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Problema: planilhas, e-mails, redigitação                        */
/* ------------------------------------------------------------------ */

function Window({
  title,
  tone = "neutral",
  children,
  width = 500,
}: {
  title: string;
  tone?: "neutral" | "bad";
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        border: `1px solid ${tone === "bad" ? "rgb(220 38 38 / 45%)" : theme.borderStrong}`,
        boxShadow: "0 24px 60px rgb(15 23 42 / 25%)",
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: tone === "bad" ? "#fdeaea" : "#f3f4f6",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        {["#f87171", "#fbbf24", "#4ade80"].map(c => (
          <i key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: 8, fontSize: 16, fontWeight: 700, color: tone === "bad" ? "#991b1b" : theme.text2 }}>
          {title}
        </span>
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function SheetBody() {
  const rows = [
    ["NF 1187-1", "15.500,00", "32"],
    ["NF 1187-2", "12.500,00", "62"],
    ["NF 1175-3", "#REF!", "41"],
    ["DM 5531", "11.700,00", "28"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.6fr", fontSize: 16, fontFamily: theme.mono }}>
      {["Título", "Valor", "Dias"].map(h => (
        <span key={h} style={{ padding: "6px 8px", background: "#e8f5e9", fontWeight: 700, border: "1px solid #d7e3d8" }}>
          {h}
        </span>
      ))}
      {rows.flat().map((c, i) => (
        <span
          key={i}
          style={{
            padding: "6px 8px",
            border: "1px solid #e5e7eb",
            color: c === "#REF!" ? theme.critical : theme.text,
            background: c === "#REF!" ? "#fdeaea" : "#fff",
            fontWeight: c === "#REF!" ? 800 : 400,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function MailBody() {
  const mails = [
    ["RE: RE: RE: Borderô corrigido (v3)", "há 2 min"],
    ["Urgente: título em duplicidade?", "há 6 min"],
    ["planilha_FINAL_final_agora_vai.xlsx", "há 9 min"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {mails.map(([s, t]) => (
        <div key={s} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 17 }}>
          <b style={{ color: theme.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</b>
          <span style={{ color: theme.text3, whiteSpace: "nowrap" }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

function ChatBody() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 17 }}>
      <span style={{ alignSelf: "flex-start", background: "#f3f4f6", borderRadius: 14, padding: "8px 12px" }}>
        Alguém conferiu a NF 1175?
      </span>
      <span style={{ alignSelf: "flex-end", background: "#dcfce7", borderRadius: 14, padding: "8px 12px" }}>
        Qual planilha vale, a de ontem?
      </span>
      <span style={{ alignSelf: "flex-start", background: "#f3f4f6", borderRadius: 14, padding: "8px 12px" }}>
        Precisa redigitar no sistema 2 😩
      </span>
    </div>
  );
}

function ErrorBody() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 18 }}>
      <span style={{ fontSize: 30, color: theme.critical, fontWeight: 900 }}>⚠</span>
      <div>
        <b style={{ color: theme.slate }}>Falha ao importar remessa</b>
        <div style={{ color: theme.text3 }}>Arquivo bancário · linha 214 inválida</div>
      </div>
    </div>
  );
}

function RetypeBody() {
  const frame = useCurrentFrame();
  const cnpj = "12.345.678/0001-90";
  const n = Math.max(0, Math.min(cnpj.length, Math.floor(((frame - 40) % 50) * 0.8)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 17 }}>
      <span style={{ color: theme.text3 }}>CNPJ do sacado (digitado pela 3ª vez)</span>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 20,
          border: `2px solid ${theme.blue}`,
          borderRadius: 10,
          padding: "8px 10px",
          color: theme.slate,
        }}
      >
        {cnpj.slice(0, n)}
        <span style={{ opacity: 0.6 }}>|</span>
      </span>
    </div>
  );
}

export function ProblemaScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const { portrait, width, height } = useLayout();
  const windows: { x: number; y: number; px: number; py: number; at: number; el: React.ReactNode; rot: number }[] = [
    { x: 0.06, y: 0.36, px: 0.04, py: 0.25, at: 8, rot: -2, el: <Window title="operacao_outubro_v7.xlsx"><SheetBody /></Window> },
    { x: 0.62, y: 0.3, px: 0.46, py: 0.35, at: 24, rot: 1.5, el: <Window title="Caixa de entrada · 37 não lidas"><MailBody /></Window> },
    { x: 0.36, y: 0.6, px: 0.06, py: 0.45, at: 42, rot: -1, el: <Window title="Grupo · Mesa de operações"><ChatBody /></Window> },
    { x: 0.66, y: 0.62, px: 0.48, py: 0.55, at: 62, rot: 2, el: <Window title="Sistema 2 · Importação" tone="bad"><ErrorBody /></Window> },
    { x: 0.28, y: 0.28, px: 0.12, py: 0.64, at: 84, rot: 1, el: <Window title="Sistema 1 · Cadastro"><RetypeBody /></Window> },
  ];
  const pending = Math.floor(interpolate(frame, [10, duration - 20], [3, 47], clamp));
  const shake = frame > 90 ? Math.sin(frame * 1.7) * interpolate(frame, [90, duration], [0, 3], clamp) : 0;
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, background: "#e9ebef" }}>
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 50%, transparent 40%, rgb(220 38 38 / 10%))", opacity: interpolate(frame, [60, duration], [0, 1], clamp) }}
      />
      <div style={{ position: "absolute", top: portrait ? 190 : 80, left: portrait ? 60 : 120, right: 60 }}>
        <Headline kicker="O PROBLEMA" title={<>A operação ainda<br />roda no improviso.</>} />
      </div>
      <div
        style={{
          position: "absolute",
          top: portrait ? 90 : 64,
          right: portrait ? 60 : 120,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#fff",
          borderRadius: 999,
          padding: "10px 18px",
          boxShadow: theme.shadowSoft,
          border: `1px solid ${theme.border}`,
        }}
      >
        <i style={{ width: 12, height: 12, borderRadius: 99, background: theme.critical }} />
        <b style={{ fontSize: 22, color: theme.slate }}>{pending} pendências</b>
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shake}px)` }}>
        {windows.map((w, i) => {
          const p = spring({ frame: frame - w.at, fps: 30, config: { damping: 13 } });
          if (frame < w.at) return null;
          const x = (portrait ? w.px : w.x) * width;
          const y = (portrait ? w.py : w.y) * height;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `scale(${0.6 + 0.4 * p}) rotate(${w.rot}deg)`,
                opacity: p,
                transformOrigin: "center",
              }}
            >
              {w.el}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Mercado: duplicata escritural e regras dos fundos                */
/* ------------------------------------------------------------------ */

export function MercadoScene() {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const milestones = [
    { when: "Fim de 2026", title: "Duplicata escritural", text: "Emissão, registro e pagamento eletrônicos" },
    { when: "2027 – 2028", title: "Adoção obrigatória", text: "Gradual: grandes, médias e pequenas empresas" },
    { when: "CVM 175", title: "Fundos regulados", text: "Regras com versão, vigência e histórico" },
  ];
  const line = interpolate(frame, [20, 90], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const words = ["Eletrônico", "Rastreável", "Auditável"];
  return (
    <AbsoluteFill
      style={{
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: portrait ? 70 : 64,
        padding: portrait ? "0 60px" : "0 120px 80px",
      }}
    >
      <Headline kicker="O MERCADO ESTÁ MUDANDO" title="O improviso tem prazo." dark align="center" size={portrait ? 84 : 84} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          gap: portrait ? 34 : 40,
          width: portrait ? 900 : 1600,
        }}
      >
        <div
          style={{
            position: "absolute",
            background: "linear-gradient(90deg, #bfdbfe, #60a5fa)",
            ...(portrait
              ? { left: 34, top: 0, width: 3, height: `${line * 100}%` }
              : { left: 0, top: 34, height: 3, width: `${line * 100}%` }),
          }}
        />
        {milestones.map((m, i) => {
          const p = spring({ frame: frame - 26 - i * 16, fps: 30, config: { damping: 16 } });
          return (
            <div
              key={m.title}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: portrait ? "row" : "column",
                gap: 20,
                opacity: p,
                transform: `translateY(${(1 - p) * 30}px)`,
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  flex: "0 0 70px",
                  borderRadius: 22,
                  display: "grid",
                  placeItems: "center",
                  background: theme.avatarGradient,
                  color: theme.slate,
                  fontWeight: 900,
                  fontSize: 26,
                  boxShadow: "0 12px 30px rgb(2 8 23 / 35%)",
                  zIndex: 1,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  flex: 1,
                  background: "rgb(255 255 255 / 8%)",
                  border: "1px solid rgb(255 255 255 / 16%)",
                  borderRadius: 24,
                  padding: "22px 26px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 800, color: theme.blueLight, letterSpacing: 1 }}>{m.when}</span>
                <b style={{ fontSize: 34, color: "#fff" }}>{m.title}</b>
                <span style={{ fontSize: 24, color: theme.onNavy }}>{m.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: portrait ? 18 : 28, flexWrap: "wrap", justifyContent: "center" }}>
        {words.map((w, i) => {
          const p = spring({ frame: frame - 110 - i * 12, fps: 30, config: { damping: 12 } });
          return (
            <span
              key={w}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                fontSize: portrait ? 34 : 38,
                fontWeight: 800,
                color: theme.slate,
                background: "#fff",
                borderRadius: 999,
                padding: "12px 26px",
                opacity: p,
                transform: `scale(${0.6 + 0.4 * p})`,
              }}
            >
              <span style={{ color: theme.good }}>✓</span>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · Missão                                                          */
/* ------------------------------------------------------------------ */

export function MissaoScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, width, height } = useLayout();
  const half = Math.round(duration * 0.32);
  // Fragmentos (as janelas do improviso) convergem para o centro e viram o STRATO.
  const fragments = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: Math.cos(a) * (portrait ? 420 : 760), y: Math.sin(a) * (portrait ? 700 : 380), r: (i * 37) % 30 - 15 };
  });
  const gather = interpolate(frame, [half - 30, half], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const logo = spring({ frame: frame - half, fps, config: { damping: 14 } });
  const strike = interpolate(frame, [26, 44], [0, 1], clamp);
  const lines = ["Do recebível ao caixa,", "com o mínimo de intervenção", "e cada decisão explicável."];
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, color: "#fff" }}>
      {frame < half + 8 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {fragments.map((f, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: width / 2 - 90 + f.x * (1 - gather),
                top: height / 2 - 55 + f.y * (1 - gather),
                width: 180,
                height: 110,
                borderRadius: 14,
                background: "rgb(255 255 255 / 10%)",
                border: "1px solid rgb(255 255 255 / 25%)",
                transform: `rotate(${f.r * (1 - gather)}deg) scale(${1 - gather * 0.8})`,
                opacity: interpolate(frame, [0, 10, half, half + 8], [0, 1, 1, 0], clamp),
              }}
            >
              <div style={{ height: 18, background: "rgb(255 255 255 / 12%)", borderRadius: "14px 14px 0 0" }} />
            </div>
          ))}
          <div style={{ textAlign: "center", opacity: interpolate(frame, [half - 24, half - 6], [1, 0], clamp) }}>
            <FadeUp delay={4}>
              <div style={{ fontSize: portrait ? 26 : 24, letterSpacing: 5, color: theme.kicker, fontWeight: 800 }}>
                NOSSA MISSÃO
              </div>
            </FadeUp>
            <FadeUp delay={10}>
              <div style={{ position: "relative", display: "inline-block", marginTop: 20 }}>
                <span style={{ fontSize: portrait ? 64 : 72, fontWeight: 800, color: "rgb(226 232 240 / 70%)" }}>
                  Mais um sistema cheio de telas
                </span>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "52%",
                    height: 7,
                    width: `${strike * 100}%`,
                    background: "#f87171",
                    borderRadius: 4,
                  }}
                />
              </div>
            </FadeUp>
          </div>
        </AbsoluteFill>
      )}
      {frame >= half - 2 && (
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 44, padding: "0 70px" }}
        >
          <div style={{ position: "relative", transform: `scale(${logo})` }}>
            <span
              style={{
                position: "absolute",
                inset: -40,
                borderRadius: 999,
                background: "radial-gradient(circle, rgb(96 165 250 / 40%), transparent 65%)",
              }}
            />
            <Img src={staticFile("strato-logo-horizontal-negative.png")} style={{ position: "relative", height: portrait ? 120 : 130 }} />
          </div>
          <FadeUp delay={half + 8}>
            <div style={{ fontSize: portrait ? 30 : 30, letterSpacing: 3, fontWeight: 800, color: theme.kicker, textAlign: "center" }}>
              UMA PLATAFORMA QUE TRABALHA JUNTO COM VOCÊ
            </div>
          </FadeUp>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {lines.map((l, i) => (
              <FadeUp key={l} delay={half + 22 + i * 14}>
                <div
                  style={{
                    fontSize: portrait ? 66 : 78,
                    fontWeight: 800,
                    letterSpacing: -2,
                    textAlign: "center",
                    lineHeight: 1.1,
                    color: i === 2 ? "transparent" : "#fff",
                    background: i === 2 ? "linear-gradient(90deg, #bfdbfe, #60a5fa)" : undefined,
                    WebkitBackgroundClip: i === 2 ? "text" : undefined,
                    backgroundClip: i === 2 ? "text" : undefined,
                  }}
                >
                  {l}
                </div>
              </FadeUp>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* 11 · Fechamento                                                     */
/* ------------------------------------------------------------------ */

export function FechamentoScene() {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const p = spring({ frame: frame - 4, fps: 30, config: { damping: 14 } });
  const segments = ["Factoring", "Securitizadora", "FIDC", "ESC"];
  return (
    <AbsoluteFill
      style={{
        fontFamily: theme.font,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        color: "#fff",
        padding: "0 60px 60px",
      }}
    >
      <div style={{ opacity: p, transform: `scale(${0.8 + 0.2 * p})` }}>
        <Avatar size={portrait ? 130 : 120} />
      </div>
      <FadeUp delay={8}>
        <div style={{ fontSize: portrait ? 58 : 64, fontWeight: 800, letterSpacing: -2, textAlign: "center", lineHeight: 1.1 }}>
          Quem move a economia real
          <br />
          merece tecnologia à altura.
        </div>
      </FadeUp>
      <FadeUp delay={70}>
        <Img src={staticFile("strato-logo-horizontal-negative.png")} style={{ height: portrait ? 96 : 100 }} />
      </FadeUp>
      <FadeUp delay={84}>
        <div style={{ fontSize: portrait ? 32 : 34, color: theme.onNavy, fontWeight: 600, textAlign: "center" }}>
          A plataforma operacional de recebíveis
        </div>
      </FadeUp>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {segments.map((s, i) => (
          <FadeUp key={s} delay={100 + i * 6} distance={10}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fff",
                background: "rgb(255 255 255 / 8%)",
                border: "1px solid rgb(255 255 255 / 18%)",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {s}
            </span>
          </FadeUp>
        ))}
      </div>
    </AbsoluteFill>
  );
}
