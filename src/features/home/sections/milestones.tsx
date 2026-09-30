"use client";
/**
 * Linha do tempo "Marcos do dia": cortes e rotinas com estado (feito, atrasado, próximo, pendente).
 */

export type Milestone = { time: string; title: string; detail: string; count: number };

export function Milestones({ items, now }: { items: Milestone[]; now: Date }) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const nextIndex = items.findIndex(m => toMin(m.time) >= minutes && m.count > 0);
  return (
    <ol className="vg-timeline">
      {items.map((m, i) => {
        const passed = toMin(m.time) < minutes;
        const state = m.count === 0 ? "done" : passed ? "late" : i === nextIndex ? "next" : "pending";
        return (
          <li key={m.time + m.title} className={`state-${state}`}>
            <time>{m.time}</time>
            <i />
            <div>
              <strong>{m.title}</strong>
              <small>{m.detail}</small>
            </div>
            <span className="vg-pill">
              {state === "done"
                ? "Sem itens"
                : state === "late"
                  ? "Atrasado"
                  : state === "next"
                    ? "Próximo"
                    : "Pendente"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
