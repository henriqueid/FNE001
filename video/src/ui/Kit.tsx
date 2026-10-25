import { colors } from "../brand/tokens";

// Peças de interface no estilo das telas do STRATO, desenhadas em vetor para ficarem nítidas em qualquer resolução.

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: colors.card,
      borderRadius: 16,
      border: `1px solid ${colors.line}`,
      padding: 18,
      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = colors.inkFaint }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color }}>{children}</div>
);

export const Kpi: React.FC<{ label: string; value: string; hint: string; tone?: string }> = ({ label, value, hint, tone }) => (
  <Card style={{ flex: 1, padding: "14px 16px" }}>
    <Label>{label}</Label>
    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: tone ?? colors.ink, letterSpacing: "-0.01em" }}>{value}</div>
    <div style={{ fontSize: 12, color: colors.inkFaint, marginTop: 2 }}>{hint}</div>
  </Card>
);

export const Pill: React.FC<{ children: React.ReactNode; bg: string; fg: string }> = ({ children, bg, fg }) => (
  <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: bg, color: fg, fontSize: 12, fontWeight: 700 }}>
    {children}
  </span>
);

export const Button: React.FC<{ children: React.ReactNode; primary?: boolean; style?: React.CSSProperties }> = ({
  children,
  primary,
  style,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 20px",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 700,
      background: primary ? colors.ink : colors.white,
      color: primary ? colors.white : colors.ink,
      border: primary ? "none" : `1px solid ${colors.line}`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Check: React.FC<{ state: "done" | "running" | "todo" }> = ({ state }) => (
  <div
    style={{
      width: 24,
      height: 24,
      borderRadius: "50%",
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      background: state === "done" ? colors.ink : colors.white,
      border: state === "done" ? "none" : `2px solid ${state === "running" ? colors.warn : colors.line}`,
      color: colors.white,
      fontSize: 14,
      fontWeight: 800,
    }}
  >
    {state === "done" ? "✓" : ""}
  </div>
);
