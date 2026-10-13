import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progresso 0→1 com mola, a partir de `delay` frames. */
export function useEnter(delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

/** Entrada com fade + leve subida (`cpl-message-in`). */
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
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], clamp);
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
      {typing && <span style={{ opacity: 0.55 }}>|</span>}
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
  const t = interpolate(frame, [start, start + duration], [0, 1], clamp);
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

/** Linhas verticais finas do cabeçalho (`.cpl-head::after`). */
function HeadLines({ size = 34, opacity = 0.16 }: { size?: number; opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity,
        backgroundImage: "linear-gradient(90deg, transparent 49%, rgb(255 255 255 / 20%) 50%, transparent 51%)",
        backgroundSize: `${size}px ${size}px`,
        maskImage: "linear-gradient(90deg, #000, transparent 74%)",
      }}
    />
  );
}

/** Fundo da cena: claro (telas do app) ou "STRATO Intelligence" (azul-marinho com brilhos). */
export function Backdrop({ variant = "light" }: { variant?: "light" | "night" }) {
  const frame = useCurrentFrame();
  if (variant === "night") {
    return (
      <AbsoluteFill style={{ background: theme.stageGradient }}>
        <HeadLines size={64} opacity={0.12} />
      </AbsoluteFill>
    );
  }
  const drift = Math.sin(frame / 70) * 3;
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(circle at ${88 + drift}% -10%, rgb(96 165 250 / 22%), transparent 42%)`,
          `radial-gradient(circle at ${8 - drift}% 110%, rgb(79 70 229 / 10%), transparent 40%)`,
          "#eef0f4",
        ].join(", "),
      }}
    />
  );
}

/** Avatar do Copiloto: quadrado arredondado branco→azul-claro com a estrela marinho. */
export function Avatar({ size = 58, busy = false }: { size?: number; busy?: boolean }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: size * 0.34,
        border: "1px solid rgb(255 255 255 / 22%)",
        background: theme.avatarGradient,
        boxShadow: "0 10px 24px rgb(2 8 23 / 30%), inset 0 1px #fff",
        display: "grid",
        placeItems: "center",
      }}
    >
      <SparkIcon size={size * 0.48} color={theme.slate} />
      {busy && (
        <span
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: size * 0.42,
            border: `3px solid ${theme.blueLight}`,
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
            transform: `rotate(${frame * 12}deg)`,
          }}
        />
      )}
    </div>
  );
}

/** Quadradinho em degradê marinho→azul com a estrela (`.cpl-reply-author i`, `.cpl-live-day-icon`). */
export function Tile({ size = 36, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "grid",
        placeItems: "center",
        borderRadius: size * 0.33,
        color: "#fff",
        background: theme.tileGradient,
      }}
    >
      {children ?? <SparkIcon size={size * 0.5} color="#fff" />}
    </span>
  );
}

/** Lançador flutuante (`.cpl-launcher` v3). */
export function Launcher({ size = 64, ring = 0 }: { size?: number; ring?: number }) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size * 0.34,
        border: "1px solid rgb(255 255 255 / 20%)",
        background: theme.launcherGradient,
        boxShadow: "0 18px 38px rgb(15 23 42 / 28%), inset 0 1px rgb(255 255 255 / 19%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: -7,
          borderRadius: size * 0.42,
          border: "2px solid rgb(96 165 250 / 45%)",
          opacity: ring,
          transform: `scale(${0.85 + 0.15 * ring})`,
        }}
      />
      <SparkIcon size={size * 0.42} color="#fff" />
    </div>
  );
}

/** Rótulo em caixa alta. */
export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 16, letterSpacing: 1.6, color: theme.text3, fontWeight: 800, ...style }}>{children}</span>
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
    <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 26 }}>
      <FadeUp delay={4}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontSize: 19,
              color: "#fff",
              background: theme.tileGradient,
              borderRadius: 12,
              padding: "7px 13px",
              fontWeight: 800,
            }}
          >
            {step}
          </span>
          <Label style={{ fontSize: 19, letterSpacing: 3, color: theme.blueDeep }}>{kicker}</Label>
        </div>
      </FadeUp>
      <FadeUp delay={10}>
        <h1
          style={{
            margin: 0,
            fontSize: 76,
            lineHeight: 1.03,
            fontWeight: 800,
            letterSpacing: -2.6,
            color: theme.slate,
          }}
        >
          {title}
        </h1>
      </FadeUp>
      <FadeUp delay={18}>
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.45, color: theme.text2, fontWeight: 500 }}>{body}</p>
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
        padding: "0 120px 40px",
        fontFamily: theme.font,
      }}
    >
      {caption}
      <div style={{ width: 900, display: "flex", justifyContent: "center" }}>{children}</div>
    </AbsoluteFill>
  );
}

export type DotState = "on" | "busy" | "wait";

/** Caixa do Copiloto v3: cabeçalho marinho em degradê, avatar branco→azul e corpo claro. */
export function CopilotPanel({
  status = "Pronto para ajudar",
  state = "on",
  delay = 0,
  width = 820,
  kicker = "STRATO INTELLIGENCE",
  title = "Copiloto operacional",
  children,
}: {
  status?: string;
  state?: DotState;
  delay?: number;
  width?: number;
  kicker?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const p = useEnter(delay, 24);
  const pulse = state === "busy" ? 0.55 + 0.45 * Math.sin(frame / 5) : 1;
  const dot = state === "busy" ? theme.blueLight : state === "wait" ? "#fbbf24" : "#22c55e";
  return (
    <div
      style={{
        width,
        borderRadius: 34,
        background: theme.elev,
        border: `1px solid ${theme.borderStrong}`,
        boxShadow: theme.shadowPanel,
        overflow: "hidden",
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 28}px) scale(${0.97 + 0.03 * p})`,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "24px 28px",
          background: theme.headGradient,
          color: "#fff",
          overflow: "hidden",
        }}
      >
        <HeadLines />
        <Avatar busy={state === "busy"} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 14, letterSpacing: 2.6, color: theme.kicker, fontWeight: 800 }}>{kicker}</span>
          <b style={{ fontSize: 27, letterSpacing: -0.3 }}>{title}</b>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, color: theme.onNavy }}>
            <i
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: dot,
                opacity: pulse,
                boxShadow: `0 0 0 4px ${state === "busy" ? "rgb(96 165 250 / 22%)" : state === "wait" ? "rgb(251 191 36 / 22%)" : "rgb(34 197 94 / 18%)"}`,
                display: "inline-block",
              }}
            />
            {status}
          </span>
        </div>
      </div>
      <div
        style={{
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: `linear-gradient(180deg, ${theme.surface}, ${theme.elev} 160px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "blue" | "ink";
const toneStyle: Record<Tone, { color: string; bg: string; border?: string }> = {
  neutral: { color: theme.text, bg: theme.elev, border: theme.border },
  good: { color: theme.good, bg: theme.goodSoft },
  warn: { color: theme.warning, bg: theme.warningSoft },
  bad: { color: theme.critical, bg: theme.criticalSoft },
  blue: { color: theme.blueDeep, bg: "rgb(37 99 235 / 9%)" },
  ink: { color: "#fff", bg: theme.ink },
};

/** Pílula (chips, filtros e sinais). */
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const t = toneStyle[tone];
  return (
    <span
      style={{
        fontSize: 17,
        fontWeight: 700,
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

/** Cartão branco com sombra suave (`.cpl-card` v3). */
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: theme.elev,
        border: `1px solid ${theme.border}`,
        borderRadius: 22,
        padding: "18px 22px",
        boxShadow: theme.shadowSoft,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Autor da resposta (`.cpl-reply-author`): ícone em degradê + "COPILOTO · fonte". */
export function ReplyAuthor({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Tile size={28} />
      <Label style={{ fontSize: 15, letterSpacing: 2, color: theme.slate }}>COPILOTO</Label>
      <span style={{ fontSize: 16, color: theme.text3 }}>· {children}</span>
    </div>
  );
}

/** Mensagem do usuário. */
export function UserBubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <FadeUp delay={delay} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
      <div
        style={{
          background: theme.ink,
          color: "#fff",
          borderRadius: "24px 24px 6px 24px",
          padding: "16px 22px",
          fontSize: 23,
          fontWeight: 500,
          boxShadow: "0 10px 24px rgb(15 23 42 / 18%)",
        }}
      >
        {children}
      </div>
    </FadeUp>
  );
}

/** Botão com efeito de clique no frame `pressAt`. */
export function Button({
  children,
  pressAt,
  tone = "ink",
}: {
  children: React.ReactNode;
  pressAt?: number;
  tone?: "ink" | "good" | "blue" | "ghost";
}) {
  const frame = useCurrentFrame();
  const scale =
    pressAt === undefined ? 1 : interpolate(frame, [pressAt - 3, pressAt, pressAt + 5], [1, 0.93, 1], clamp);
  const bg =
    tone === "good"
      ? theme.good
      : tone === "blue"
        ? `linear-gradient(145deg, ${theme.ink}, ${theme.blueDeep})`
        : tone === "ghost"
          ? theme.elev
          : theme.ink;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 21,
        fontWeight: 700,
        color: tone === "ghost" ? theme.text : "#fff",
        background: bg,
        border: tone === "ghost" ? `1px solid ${theme.borderStrong}` : "1px solid transparent",
        borderRadius: 16,
        padding: "14px 22px",
        transform: `scale(${scale})`,
        whiteSpace: "nowrap",
        boxShadow: tone === "ghost" ? "none" : "0 8px 20px rgb(15 23 42 / 18%)",
      }}
    >
      {children}
    </span>
  );
}

/** Barra de progresso (`.cpl-progress-bar`): tinta → azul. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height: 10, borderRadius: 99, background: theme.surface3, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: "100%",
          borderRadius: 99,
          background: theme.progressGradient,
        }}
      />
    </div>
  );
}

/**
 * Cursor do mouse que chega ao elemento e clica. Envolve o alvo; o ponteiro termina no centro dele.
 * `clickAt` é o frame do clique; o cursor entra ~24 frames antes vindo de (`fromX`, `fromY`).
 */
export function Clickable({
  children,
  clickAt,
  fromX = 160,
  fromY = 120,
  style,
}: {
  children: React.ReactNode;
  clickAt: number;
  fromX?: number;
  fromY?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const move = interpolate(frame, [clickAt - 26, clickAt - 4], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const visible = interpolate(frame, [clickAt - 30, clickAt - 24, clickAt + 18, clickAt + 26], [0, 1, 1, 0], clamp);
  const ripple = interpolate(frame, [clickAt, clickAt + 14], [0, 1], clamp);
  const press = interpolate(frame, [clickAt - 3, clickAt, clickAt + 4], [1, 0.86, 1], clamp);
  return (
    <div style={{ position: "relative", display: "inline-flex", ...style }}>
      {children}
      {visible > 0 && (
        <div
          style={{
            position: "absolute",
            left: "62%",
            top: "58%",
            pointerEvents: "none",
            opacity: visible,
            transform: `translate(${(1 - move) * fromX}px, ${(1 - move) * fromY}px)`,
            zIndex: 5,
          }}
        >
          {frame >= clickAt && ripple < 1 && (
            <span
              style={{
                position: "absolute",
                left: -26,
                top: -26,
                width: 52,
                height: 52,
                borderRadius: 99,
                border: `3px solid ${theme.blueLight}`,
                opacity: 1 - ripple,
                transform: `scale(${0.4 + ripple})`,
              }}
            />
          )}
          <svg
            width="34"
            height="40"
            viewBox="0 0 17 20"
            style={{
              display: "block",
              transform: `scale(${press})`,
              transformOrigin: "0 0",
              filter: "drop-shadow(0 3px 6px rgb(15 23 42 / 35%))",
            }}
          >
            <path d="M1 1 L1 16 L5 12.5 L8 19 L10.6 17.8 L7.7 11.4 L13 11.4 Z" fill="#0f172a" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

/** Barra de capítulos no rodapé: mostra em que parte do vídeo o espectador está. */
export function ChapterBar({
  chapters,
  current,
  progress,
  dark = false,
}: {
  chapters: string[];
  current: number;
  progress: number;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 120,
        bottom: 46,
        display: "grid",
        gridTemplateColumns: `repeat(${chapters.length}, 1fr)`,
        gap: 12,
        fontFamily: theme.font,
      }}
    >
      {chapters.map((name, i) => {
        const fill = i < current ? 1 : i === current ? progress : 0;
        return (
          <div key={name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                height: 4,
                borderRadius: 99,
                background: dark ? "rgb(255 255 255 / 14%)" : "rgb(15 23 42 / 10%)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${fill * 100}%`,
                  height: "100%",
                  background: dark ? "linear-gradient(90deg, #bfdbfe, #60a5fa)" : theme.progressGradient,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: i === current ? 800 : 600,
                color: dark
                  ? i === current
                    ? "#fff"
                    : "rgb(255 255 255 / 45%)"
                  : i === current
                    ? theme.slate
                    : "rgb(15 23 42 / 40%)",
                letterSpacing: 0.4,
              }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
