// Cálculos da Visão geral a partir dos dados do sistema.
// Funções puras: recebem operações, carteira, cadastros e parâmetros e devolvem os agregados.

import { initialCedents } from "@/src/domain/core/demo/cedents";
import { cedentPortfolioTitles, cedentSettlementAdjustments } from "@/src/domain/core/demo/portfolio";
import { stages } from "@/src/domain/core/stages";
import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";
import { type HomePeriod } from "./settings";

export type OpFinancial = { face: number; discount: number; fees: number; revenue: number; rate: number; net: number };

const DAY = 86_400_000;

export function isoDate(date: Date) {
  const y = date.getFullYear(),
    m = String(date.getMonth() + 1).padStart(2, "0"),
    d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fromIso(iso: string) {
  return new Date(`${iso}T12:00:00`);
}
function addDays(iso: string, days: number) {
  return isoDate(new Date(fromIso(iso).getTime() + days * DAY));
}
export function daysBetween(fromIsoDate: string, toIsoDate: string) {
  return Math.round((fromIso(toIsoDate).getTime() - fromIso(fromIsoDate).getTime()) / DAY);
}
export function brDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function operationDate(op: Operation, today: string) {
  const digits = (op.aditivoNumber ?? "").replace(/\D/g, "").slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : today;
}
export function releaseDate(op: Operation) {
  if (op.status !== "Liberada ao financeiro") return null;
  const match = op.releaseReview?.releasedAt?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}
export const isReleased = (op: Operation) => op.status === "Liberada ao financeiro";
export const isActive = (op: Operation) => op.status !== "Cancelada" && !isReleased(op);
export const isLive = (op: Operation) => op.status !== "Cancelada";

export function isSlower(op: Operation) {
  return op.historySample >= 5 && op.clientAverageMinutes > 0 && op.elapsedMinutes / op.clientAverageMinutes > 1.15;
}

export type Bucket = { label: string; future: boolean; match: (op: Operation) => boolean };
export type Window = { from: string; to: string; prevFrom: string; prevTo: string; buckets: Bucket[]; days: number };

function entryHour(op: Operation, now: Date) {
  const match = op.enteredAt?.match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) : now.getHours();
}

export function periodWindow(period: HomePeriod, now: Date): Window {
  const today = isoDate(now);
  if (period === "dia") {
    const prev = addDays(today, -1);
    const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
    return {
      from: today,
      to: today,
      prevFrom: prev,
      prevTo: prev,
      days: 1,
      buckets: hours.map(h => ({
        label: `${h}h`,
        future: h > now.getHours(),
        match: (op: Operation) => {
          const hr = Math.min(17, Math.max(8, entryHour(op, now)));
          return operationDate(op, today) === today && hr === h;
        },
      })),
    };
  }
  if (period === "semana") {
    const weekday = (now.getDay() + 6) % 7; // 0 = segunda
    const monday = addDays(today, -weekday);
    const names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    return {
      from: monday,
      to: today,
      prevFrom: addDays(monday, -7),
      prevTo: addDays(today, -7),
      days: weekday + 1,
      buckets: names.slice(0, 5).map((label, i) => {
        const day = addDays(monday, i);
        return {
          label: `${label} ${brDate(day)}`,
          future: day > today,
          match: (op: Operation) => operationDate(op, today) === day,
        };
      }),
    };
  }
  const first = `${today.slice(0, 8)}01`;
  const dayOfMonth = now.getDate();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevFirst = isoDate(prevMonthDate);
  const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const prevTo = `${prevFirst.slice(0, 8)}${String(Math.min(dayOfMonth, prevLastDay)).padStart(2, "0")}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
    [29, lastDay],
  ].filter(([a]) => a <= lastDay);
  return {
    from: first,
    to: today,
    prevFrom: prevFirst,
    prevTo,
    days: dayOfMonth,
    buckets: ranges.map(([a, b]) => {
      const start = `${today.slice(0, 8)}${String(a).padStart(2, "0")}`,
        end = `${today.slice(0, 8)}${String(b).padStart(2, "0")}`;
      return {
        label: `${String(a).padStart(2, "0")}–${String(b).padStart(2, "0")}`,
        future: start > today,
        match: (op: Operation) => {
          const d = operationDate(op, today);
          return d >= start && d <= end;
        },
      };
    }),
  };
}

export type Origination = {
  count: number;
  volume: number;
  revenue: number;
  discount: number;
  fees: number;
  rate: number;
  cedents: number;
  released: number;
  releasedCount: number;
  automation: number;
};

export function origination(
  ops: Operation[],
  fin: Record<string, OpFinancial>,
  from: string,
  to: string,
  today: string,
): Origination {
  const inRange = ops.filter(op => isLive(op) && operationDate(op, today) >= from && operationDate(op, today) <= to);
  const volume = inRange.reduce((s, op) => s + (fin[op.id]?.face || op.amount), 0);
  const discount = inRange.reduce((s, op) => s + (fin[op.id]?.discount ?? 0), 0);
  const fees = inRange.reduce((s, op) => s + (fin[op.id]?.fees ?? 0), 0);
  const rate = volume
    ? inRange.reduce((s, op) => s + (fin[op.id]?.rate ?? 0) * (fin[op.id]?.face || op.amount), 0) / volume
    : 0;
  const releasedOps = ops.filter(op => {
    const d = releaseDate(op);
    return d !== null && d >= from && d <= to;
  });
  return {
    count: inRange.length,
    volume,
    discount,
    fees,
    revenue: discount + fees,
    rate,
    cedents: new Set(inRange.map(op => op.document || op.cedent)).size,
    released: releasedOps.reduce((s, op) => s + (fin[op.id]?.net || op.netAmount || op.amount), 0),
    releasedCount: releasedOps.length,
    automation: inRange.length ? inRange.reduce((s, op) => s + (op.automation ?? 0), 0) / inRange.length : 0,
  };
}

export type PortfolioTitle = {
  id: string;
  ownerDocument: string;
  ownerName: string;
  debtorName: string;
  debtorDocument: string;
  dueDate: string;
  amount: number;
  source: "Carteira" | "Operação liberada";
  reference: string;
  vehicle?: string;
};

const cedentName = (doc: string, fallback: string) => initialCedents.find(c => c.document === doc)?.name ?? fallback;

export function portfolioTitles(ops: Operation[]): PortfolioTitle[] {
  const base: PortfolioTitle[] = cedentPortfolioTitles.map(t => {
    const owner = t.groupOwnerDocument ?? t.cedentDocument;
    // Carteira anterior: fica no veículo em que o cedente opera (até a Carteira ter o veículo por título).
    const vehicle = ops.find(op => op.document === t.cedentDocument || op.document === owner)?.vehicle;
    return {
      vehicle,
      id: t.id,
      ownerDocument: owner,
      ownerName: cedentName(owner, t.portfolioOwnerName ?? t.cedentDocument),
      debtorName: t.debtorName,
      debtorDocument: t.debtorDocument,
      dueDate: t.dueDate,
      amount: t.faceAmount,
      source: "Carteira",
      reference: t.documentNumber,
    };
  });
  const fromOps: PortfolioTitle[] = ops.filter(isReleased).flatMap(op => {
    const decisions = op.riskReview?.titleDecisions ?? {};
    const hasDecisions = Object.keys(decisions).length > 0;
    return (op.manualEntry?.entries ?? [])
      .filter(e => !hasDecisions || decisions[e.id] === "Aprovado")
      .map(e => ({
        vehicle: op.vehicle,
        id: `${op.id}-${e.id}`,
        ownerDocument: op.document,
        ownerName: op.cedent,
        debtorName: e.debtorName,
        debtorDocument: e.debtorDocument,
        dueDate: e.dueDate,
        amount: e.amount,
        source: "Operação liberada" as const,
        reference: `Aditivo ${op.aditivoNumber}`,
      }));
  });
  return [...base, ...fromOps];
}

export type AgingBucket = {
  label: string;
  min: number;
  max: number;
  tone: "ok" | "watch" | "serious" | "critical";
  amount: number;
  count: number;
};

export function aging(titles: PortfolioTitle[], today: string): AgingBucket[] {
  const defs: Omit<AgingBucket, "amount" | "count">[] = [
    { label: "A vencer", min: -Infinity, max: 0, tone: "ok" },
    { label: "1–5 dias", min: 1, max: 5, tone: "watch" },
    { label: "6–15 dias", min: 6, max: 15, tone: "watch" },
    { label: "16–30 dias", min: 16, max: 30, tone: "serious" },
    { label: "31–60 dias", min: 31, max: 60, tone: "serious" },
    { label: "61–90 dias", min: 61, max: 90, tone: "critical" },
    { label: "> 90 dias", min: 91, max: Infinity, tone: "critical" },
  ];
  return defs.map(d => {
    const list = titles.filter(t => {
      const late = daysBetween(t.dueDate, today);
      return late >= d.min && late <= d.max;
    });
    return { ...d, amount: list.reduce((s, t) => s + t.amount, 0), count: list.length };
  });
}

export function businessDays(from: string, count: number) {
  const out: string[] = [];
  let cursor = from;
  while (out.length < count) {
    const wd = fromIso(cursor).getDay();
    if (wd !== 0 && wd !== 6) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function maturityAgenda(titles: PortfolioTitle[], today: string, count = 10) {
  const days = businessDays(today, count);
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return days.map((day, i) => {
    // vencimentos em fim de semana caem no próximo dia útil
    const prev = i === 0 ? day : addDays(days[i - 1], 1);
    const list = titles.filter(t => t.dueDate >= prev && t.dueDate <= day);
    return {
      date: day,
      label: i === 0 ? "Hoje" : names[fromIso(day).getDay()],
      short: brDate(day),
      amount: list.reduce((s, t) => s + t.amount, 0),
      count: list.length,
      titles: list,
    };
  });
}

export function cedentExposure(
  titles: PortfolioTitle[],
  ops: Operation[],
  cedents: Cedent[],
  total: number,
  today: string,
) {
  const groups = new Map<string, { name: string; exposure: number; overdue: number; count: number }>();
  titles.forEach(t => {
    const g = groups.get(t.ownerDocument) ?? { name: t.ownerName, exposure: 0, overdue: 0, count: 0 };
    g.exposure += t.amount;
    g.count += 1;
    if (t.dueDate < today) g.overdue += t.amount;
    groups.set(t.ownerDocument, g);
  });
  return [...groups.entries()]
    .map(([doc, g]) => {
      const cedent = cedents.find(c => c.document === doc);
      const pipeline = ops.filter(op => isActive(op) && op.document === doc).reduce((s, op) => s + op.amount, 0);
      const used = cedent ? ((cedent.usedLimit + pipeline) / cedent.creditLimit) * 100 : NaN;
      return {
        document: doc,
        name: g.name,
        exposure: g.exposure,
        overdue: g.overdue,
        count: g.count,
        share: total ? (g.exposure / total) * 100 : 0,
        pipeline,
        used,
        score: cedent?.score,
        limit: cedent?.creditLimit ?? 0,
        usedLimit: cedent?.usedLimit ?? 0,
        incidents: cedent?.incidents ?? 0,
      };
    })
    .sort((a, b) => b.exposure - a.exposure);
}

export function debtorExposure(titles: PortfolioTitle[], debtors: Debtor[], total: number, today: string) {
  const groups = new Map<string, { name: string; exposure: number; overdue: number; count: number }>();
  titles.forEach(t => {
    const key = t.debtorDocument.replace(/\D/g, "");
    const g = groups.get(key) ?? { name: t.debtorName, exposure: 0, overdue: 0, count: 0 };
    g.exposure += t.amount;
    g.count += 1;
    if (t.dueDate < today) g.overdue += t.amount;
    groups.set(key, g);
  });
  return [...groups.entries()]
    .map(([key, g]) => {
      const debtor = debtors.find(d => d.document.replace(/\D/g, "") === key);
      return {
        document: key,
        name: g.name,
        exposure: g.exposure,
        overdue: g.overdue,
        count: g.count,
        share: total ? (g.exposure / total) * 100 : 0,
        score: debtor?.score,
      };
    })
    .sort((a, b) => b.exposure - a.exposure);
}

export function vehicleExposure(ops: Operation[], fin: Record<string, OpFinancial>) {
  const groups = new Map<
    string,
    { institution: string; active: number; released: number; count: number; blocked: number }
  >();
  ops.filter(isLive).forEach(op => {
    const g = groups.get(op.vehicle) ?? { institution: op.institution, active: 0, released: 0, count: 0, blocked: 0 };
    const value = fin[op.id]?.face || op.amount;
    if (isReleased(op)) g.released += value;
    else g.active += value;
    g.count += 1;
    if (op.blockers > 0) g.blocked += 1;
    groups.set(op.vehicle, g);
  });
  return [...groups.entries()]
    .map(([name, g]) => ({ name, ...g, total: g.active + g.released }))
    .sort((a, b) => b.total - a.total);
}

export function settlementPending() {
  const pend = cedentSettlementAdjustments.filter(a => a.kind === "Pendência");
  const cred = cedentSettlementAdjustments.filter(a => a.kind === "Crédito");
  return {
    pendingCount: pend.length,
    pendingAmount: pend.reduce((s, a) => s + a.amount, 0),
    creditCount: cred.length,
    creditAmount: cred.reduce((s, a) => s + a.amount, 0),
  };
}

export function teamRows(ops: Operation[], fin: Record<string, OpFinancial>, from: string, to: string, today: string) {
  const people = new Map<
    string,
    {
      name: string;
      initials: string;
      ops: number;
      volume: number;
      revenue: number;
      open: number;
      blocked: number;
      elapsed: number;
      standard: number;
      paced: number;
    }
  >();
  const get = (op: Operation) => {
    const key = op.owner || "Sem responsável";
    const p = people.get(key) ?? {
      name: key,
      initials: op.ownerInitials || key.slice(0, 2).toUpperCase(),
      ops: 0,
      volume: 0,
      revenue: 0,
      open: 0,
      blocked: 0,
      elapsed: 0,
      standard: 0,
      paced: 0,
    };
    people.set(key, p);
    return p;
  };
  ops.filter(isLive).forEach(op => {
    const d = operationDate(op, today);
    if (d >= from && d <= to) {
      const p = get(op);
      p.ops += 1;
      p.volume += fin[op.id]?.face || op.amount;
      p.revenue += fin[op.id]?.revenue ?? 0;
    }
    if (isActive(op)) {
      const p = get(op);
      p.open += 1;
      if (op.blockers > 0) p.blocked += 1;
      if (op.historySample >= 5 && op.clientAverageMinutes > 0) {
        p.elapsed += op.elapsedMinutes;
        p.standard += op.clientAverageMinutes;
        p.paced += 1;
      }
    }
  });
  return [...people.values()].sort((a, b) => b.volume - a.volume || b.open - a.open);
}

export const stageName = (id: number) => stages[id - 1]?.short ?? `Etapa ${id}`;
