/** Peças de layout que se adaptam ao formato: 16:9 (horizontal) ou 9:16 (vertical, redes sociais). */
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FadeUp } from "../components";
import { theme } from "../theme";

export function useLayout() {
  const { width, height } = useVideoConfig();
  return { portrait: height > width, width, height };
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fundo: "night" = STRATO Intelligence (marinho com brilhos); "light" = telas do app. */
export function Background({ variant }: { variant: "night" | "light" }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 4;
  if (variant === "night") {
    return (
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at ${18 + drift}% -10%, rgb(96 165 250 / 45%), transparent 45%)`,
            `radial-gradient(circle at ${85 - drift}% 112%, rgb(79 70 229 / 45%), transparent 50%)`,
            "linear-gradient(118deg, #07111f 0%, #102d55 62%, #242478 100%)",
          ].join(", "),
        }}
      >
        <AbsoluteFill
          style={{
            opacity: 0.1,
            backgroundImage: "linear-gradient(90deg, transparent 49%, rgb(255 255 255 / 30%) 50%, transparent 51%)",
            backgroundSize: "72px 72px",
            maskImage: "linear-gradient(180deg, #000, transparent 80%)",
          }}
        />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(circle at ${88 + drift}% -10%, rgb(96 165 250 / 24%), transparent 42%)`,
          `radial-gradient(circle at ${8 - drift}% 110%, rgb(79 70 229 / 12%), transparent 42%)`,
          "#eef0f4",
        ].join(", "),
      }}
    />
  );
}

/** Título da cena (rótulo + manchete). `dark` para fundo marinho. */
export function Headline({
  kicker,
  title,
  dark = false,
  align = "left",
  size,
}: {
  kicker: string;
  title: React.ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  size?: number;
}) {
  const { portrait } = useLayout();
  const fontSize = size ?? (portrait ? 74 : 76);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, textAlign: align, alignItems: align === "center" ? "center" : "flex-start" }}>
      <FadeUp delay={2}>
        <span
          style={{
            fontSize: portrait ? 24 : 20,
            letterSpacing: 4,
            fontWeight: 800,
            color: dark ? theme.kicker : theme.blueDeep,
          }}
        >
          {kicker}
        </span>
      </FadeUp>
      <FadeUp delay={6}>
        <h1
          style={{
            margin: 0,
            fontSize,
            lineHeight: 1.04,
            fontWeight: 800,
            letterSpacing: -2.4,
            color: dark ? "#fff" : theme.slate,
          }}
        >
          {title}
        </h1>
      </FadeUp>
    </div>
  );
}

/**
 * Cena de produto: manchete + interface. Horizontal: manchete à esquerda, tela à direita.
 * Vertical: manchete no topo, tela abaixo. A tela é desenhada com 960 px de largura.
 */
export function ProductStage({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const { portrait } = useLayout();
  if (portrait) {
    return (
      <AbsoluteFill style={{ fontFamily: theme.font, padding: "190px 60px 0", flexDirection: "column", gap: 56 }}>
        <Headline kicker={kicker} title={title} />
        <div style={{ width: 960, display: "flex", justifyContent: "center" }}>{children}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill
      style={{
        fontFamily: theme.font,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "60px 110px 140px 120px",
      }}
    >
      <div style={{ width: 560 }}>
        <Headline kicker={kicker} title={title} />
      </div>
      <div style={{ width: 960, display: "flex", justifyContent: "center", transform: "scale(1.04)", transformOrigin: "center right" }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}

/** Marca STRATO discreta no canto (cenas de produto). */
export function Watermark({ dark = false }: { dark?: boolean }) {
  const { portrait } = useLayout();
  return (
    <Img
      src={staticFile(dark ? "strato-logo-horizontal-negative.png" : "strato-logo-horizontal-color.png")}
      style={{
        position: "absolute",
        top: portrait ? 80 : 48,
        left: portrait ? 60 : 120,
        height: portrait ? 40 : 32,
        opacity: 0.9,
      }}
    />
  );
}

/** Legendas da narração, divididas em blocos curtos e cronometradas pelo tamanho de cada bloco. */
export function Subtitles({ text, from, frames }: { text: string; from: number; frames: number }) {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const maxWords = portrait ? 5 : 9;
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const breakHere = current.length >= maxWords || /[.,:;!?]$/.test(word) && current.length >= 3;
    if (breakHere) {
      chunks.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(" "));
  const totalChars = chunks.reduce((s, c) => s + c.length + 6, 0);
  let t = from;
  const timed = chunks.map(c => {
    const len = ((c.length + 6) / totalChars) * frames;
    const item = { text: c, start: t, end: t + len };
    t += len;
    return item;
  });
  const active = timed.find(c => frame >= c.start && frame < c.end);
  if (!active) return null;
  const local = frame - active.start;
  const pop = interpolate(local, [0, 5], [0.92, 1], clamp);
  const opacity = interpolate(local, [0, 4], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: portrait ? 330 : 56,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          maxWidth: portrait ? 900 : 1500,
          textAlign: "center",
          fontFamily: theme.font,
          fontSize: portrait ? 50 : 40,
          lineHeight: 1.25,
          fontWeight: 700,
          color: "#fff",
          background: "rgb(7 17 31 / 78%)",
          borderRadius: 18,
          padding: portrait ? "14px 26px" : "10px 24px",
          opacity,
          transform: `scale(${pop})`,
          boxShadow: "0 12px 30px rgb(2 8 23 / 25%)",
        }}
      >
        {active.text}
      </span>
    </div>
  );
}
