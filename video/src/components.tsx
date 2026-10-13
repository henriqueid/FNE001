import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/** Progresso 0→1 com mola, a partir de `delay` frames. */
export function useEnter(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

/** Entrada com fade + leve subida (equivalente ao `cpl-in` do app). */
export function FadeUp({
  delay = 0,
  distance = 16,
  children,
  style,
}: {
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const p = useEnter(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * distance}px)`, ...style }}>{children}</div>;
}

/** Fade de entrada e saída de cada cena. */
export function SceneFade({ duration, children }: { duration: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/** Texto digitado caractere a caractere. */
export function Typewriter({ text, start = 0, speed = 1.4 }: { text: string; start?: number; speed?: number }) {
  const frame = useCurrentFrame();
  const count = Math.max(0, Math.min(text.length, Math.floor((frame - start) * speed)));
  const typing = count < text.length && frame >= start;
  return (
    <span>
      {text.slice(0, count)}
      {typing && <span style={{ opacity: 0.5 }}>|</span>}
    </span>
  );
}

/** Número que conta até o valor final. */
export function CountUp({
  to,
  start = 0,
  duration = 30,
  format = (v: number) => Math.round(v).toLocaleString("pt-BR"),
}: {
  to: number;
  start?: number;
  duration?: number;
  format?: (v: number) => string;
}) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <>{format(to * (1 - Math.pow(1 - t, 3)))}</>;
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function SparkIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5l1.9 5.6a3 3 0 0 0 1.9 1.9l5.6 1.9-5.6 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.8a3 3 0 0 0-1.9-1.9L2.6 12l5.6-1.9a3 3 0 0 0 1.9-1.9L12 2.5z"
        fill={color}
      />
    </svg>
  );
}

/** Arco girando ao redor de um elemento ocupado (`[data-busy]::after` do app). */
export function BusyRing({ inset = -6, radius = "50%" }: { inset?: number; radius?: string | number }) {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        position: "absolute",
        inset,
        borderRadius: radius,
        border: `3px solid ${theme.ink}`,
        borderRightColor: "transparent",
        borderBottomColor: "transparent",
        transform: `rotate(${frame * 12}deg)`,
      }}
    />
  );
}

/** Fundo do app: cinza liso, sem grade nem brilho. */
export function Backdrop() {
  return <AbsoluteFill style={{ background: theme.canvas }} />;
}

/** Rótulo em caixa alta, cinza (cabeçalhos de tabela e seções do Ledger). */
export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 17, letterSpacing: 1.5, color: theme.text3, fontWeight: 700, ...style }}>{children}</span>
  );
}

/** Coluna de legenda à esquerda: etapa, título grande e explicação. */
export function Caption({
  step,
  kicker,
  title,
  body,
}: {
  step: string;
  kicker: string;
  title: React.ReactNode;
  body: React.ReactNode;
}) {
  return (
    <div style={{ width: 660, display: "flex", flexDirection: "column", gap: 28 }}>
      <FadeUp delay={4}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontSize: 20,
              color: theme.inkText,
              background: theme.ink,
              borderRadius: 999,
              padding: "6px 14px",
              fontWeight: 700,
            }}
          >
            {step}
          </span>
          <Label style={{ fontSize: 20, letterSpacing: 3 }}>{kicker}</Label>
        </div>
      </FadeUp>
      <FadeUp delay={10}>
        <h1 style={{ margin: 0, fontSize: 78, lineHeight: 1.02, fontWeight: 700, letterSpacing: -2, color: theme.text }}>
          {title}
        </h1>
      </FadeUp>
      <FadeUp delay={18}>
        <p style={{ margin: 0, fontSize: 31, lineHeight: 1.42, color: theme.text2, fontWeight: 500 }}>{body}</p>
      </FadeUp>
    </div>
  );
}

/** Layout padrão: legenda à esquerda, tela do Copiloto à direita. */
export function Split({ caption, children }: { caption: React.ReactNode; children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 120px",
        fontFamily: theme.font,
      }}
    >
      {caption}
      <div style={{ width: 900, display: "flex", justifyContent: "center" }}>{children}</div>
    </AbsoluteFill>
  );
}

export type DotState = "on" | "busy" | "wait" | "alert";
const dotColor: Record<DotState, string> = {
  on: theme.success,
  busy: theme.text3,
  wait: theme.warning,
  alert: theme.danger,
};

/** Caixa de diálogo do Copiloto (`.cpl-dialog` / `.cpl-head` em app/styles/ledger.css). */
export function CopilotPanel({
  status = "Pronto para ajudar",
  state = "on",
  delay = 0,
  width = 820,
  children,
}: {
  status?: string;
  state?: DotState;
  delay?: number;
  width?: number;
  children: React.ReactNode;
}) {
  const p = useEnter(delay, 22);
  return (
    <div
      style={{
        width,
        borderRadius: 32,
        background: theme.elev,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadowLg,
        overflow: "hidden",
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 24}px) scale(${0.98 + 0.02 * p})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "24px 28px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 58,
            height: 58,
            borderRadius: 18,
            background: theme.ink,
            display: "grid",
            placeItems: "center",
          }}
        >
          <SparkIcon size={28} color={theme.inkText} />
          {state === "busy" && <BusyRing inset={-6} radius={22} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Label style={{ fontSize: 14, letterSpacing: 2.5 }}>STRATO INTELLIGENCE</Label>
          <b style={{ fontSize: 25, color: theme.text, letterSpacing: -0.2 }}>Copiloto operacional</b>
          <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 19, color: theme.text3 }}>
            <i
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: dotColor[state],
                display: "inline-block",
              }}
            />
            {status}
          </span>
        </div>
      </div>
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
    </div>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "mint" | "ink";
const toneStyle: Record<Tone, { color: string; bg: string; border?: string }> = {
  neutral: { color: theme.text, bg: theme.surface, border: theme.border },
  good: { color: theme.success, bg: theme.successSoft },
  warn: { color: theme.warning, bg: theme.warningSoft },
  bad: { color: theme.danger, bg: theme.dangerSoft },
  mint: { color: theme.mintInk, bg: theme.mint },
  ink: { color: theme.inkText, bg: theme.ink },
};

/** Pílula (`.cpl-chips button`, sinais de estado). */
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const t = toneStyle[tone];
  return (
    <span
      style={{
        fontSize: 18,
        fontWeight: 600,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border ?? "transparent"}`,
        borderRadius: 999,
        padding: "6px 14px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Cartão sem borda sobre superfície cinza (padrão Ledger). */
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: theme.surface, borderRadius: 20, padding: "18px 22px", ...style }}>{children}</div>
  );
}

/** Rótulo da resposta do Copiloto (`.cpl-tool`). */
export function ToolTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        padding: "4px 12px",
        borderRadius: 999,
        color: theme.text3,
        background: theme.surface3,
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      <SparkIcon size={14} color={theme.text3} />
      {children}
    </span>
  );
}

/** Mensagem do usuário (`.cpl-bubble.is-me`): tinta preta. */
export function UserBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <FadeUp delay={delay} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
      <div
        style={{
          background: theme.ink,
          color: theme.inkText,
          borderRadius: "24px 24px 6px 24px",
          padding: "16px 22px",
          fontSize: 23,
          fontWeight: 500,
        }}
      >
        {children}
      </div>
    </FadeUp>
  );
}

/** Botão primário preto (`.cpl-primary`) com efeito de clique no frame `pressAt`. */
export function PrimaryButton({
  children,
  pressAt,
  tone = "ink",
}: {
  children: React.ReactNode;
  pressAt?: number;
  tone?: "ink" | "mint";
}) {
  const frame = useCurrentFrame();
  const scale =
    pressAt === undefined
      ? 1
      : interpolate(frame, [pressAt - 4, pressAt, pressAt + 4], [1, 0.93, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 21,
        fontWeight: 600,
        color: tone === "mint" ? theme.mintInk : theme.inkText,
        background: tone === "mint" ? theme.mint : theme.ink,
        borderRadius: 16,
        padding: "14px 22px",
        transform: `scale(${scale})`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Botão secundário (`.cpl-ghost`). */
export function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 21,
        fontWeight: 600,
        color: theme.text,
        background: theme.elev,
        border: `1px solid ${theme.borderStrong}`,
        borderRadius: 14,
        padding: "13px 22px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
