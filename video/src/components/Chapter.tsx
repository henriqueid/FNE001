import { colors } from "../brand/tokens";
import { useLayout } from "../brand/layout";

// Indicador de progresso fixo no topo: situa o espectador na jornada da operação.
export const Chapter: React.FC<{ index: number; total: number; label: string }> = ({
  index,
  total,
  label,
}) => {
  const { u, vertical } = useLayout();
  return (
    <div
      style={{
        position: "absolute",
        top: vertical ? u(120) : u(34),
        left: vertical ? u(64) : u(110),
        display: "flex",
        alignItems: "center",
        gap: u(20),
        color: colors.textSoft,
        fontSize: vertical ? u(28) : u(22),
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      <div style={{ display: "flex", gap: u(8) }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? u(36) : u(12),
              height: u(6),
              borderRadius: u(3),
              background: i <= index ? colors.accent : "rgba(255,255,255,0.22)",
            }}
          />
        ))}
      </div>
      {String(index + 1).padStart(2, "0")} · {label}
    </div>
  );
};
