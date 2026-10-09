"use client";
/**
 * Rolagem da carteira (roll rate): % do saldo de cada faixa de atraso que passou para a
 * faixa seguinte no mês. Quanto mais escura a célula, mais a carteira está "rolando".
 */
import { type rollRates } from "@/src/domain/risk/portfolio-dynamics";
import { pct } from "@/src/features/home/widgets";

const transitions = ["A vencer → 1–30", "1–30 → 31–60", "31–60 → 61–90", "61–90 → > 90"];
const monthName = (m: string) => {
  const t = new Date(`${m}-15T12:00:00`)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function RollRate({ rows }: { rows: ReturnType<typeof rollRates> }) {
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  return (
    <div className="lx-roll">
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            {transitions.map(t => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.month}>
              <th scope="row">{monthName(r.month)}</th>
              {r.rates.map((v, k) => (
                <td key={k} style={{ "--heat": Math.min(1, v / 100) } as React.CSSProperties}>
                  {pct(v, 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {last && prev && (
        <p className="lx-note">
          Em {monthName(last.month)}, {pct(last.rates[1], 0)} do que estava entre 1 e 30 dias passou para 31–60 dias (
          {last.rates[1] >= prev.rates[1] ? "acima" : "abaixo"} de {pct(prev.rates[1], 0)} no mês anterior).
        </p>
      )}
    </div>
  );
}
