import { type Operation } from "@/src/domain/core/types";
import { isLive, isoDate, operationDate, type OpFinancial } from "./metrics";
import { type HomePeriod } from "./settings";

const DAY = 86_400_000;
const atNoon = (iso: string) => new Date(`${iso}T12:00:00`);
const addDays = (iso: string, amount: number) => isoDate(new Date(atNoon(iso).getTime() + amount * DAY));
const isBusinessDay = (iso: string) => {
  const day = atNoon(iso).getDay();
  return day !== 0 && day !== 6;
};

function rangeFor(period: HomePeriod, referenceDate: string) {
  const reference = atNoon(referenceDate);
  if (period === "dia") return { from: referenceDate, to: referenceDate };
  if (period === "semana") {
    const weekday = (reference.getDay() + 6) % 7;
    const monday = addDays(referenceDate, -weekday);
    return { from: monday, to: addDays(monday, 4) };
  }
  const from = `${referenceDate.slice(0, 8)}01`;
  const last = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  return { from, to: `${referenceDate.slice(0, 8)}${String(last).padStart(2, "0")}` };
}

export type RevenuePaceDay = {
  date: string;
  label: string;
  target: number;
  revenue: number;
  variance: number;
  status: "met" | "missed" | "future" | "position";
};

export function buildRevenuePace({
  operations,
  financials,
  period,
  referenceDate,
  target,
}: {
  operations: Operation[];
  financials: Record<string, OpFinancial>;
  period: HomePeriod;
  referenceDate: string;
  target: number;
}) {
  const range = rangeFor(period, referenceDate);
  const calendarDates: string[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    calendarDates.push(date);
  }
  const targetDates = calendarDates.filter(date => period === "dia" || isBusinessDay(date));
  const dailyTarget = targetDates.length ? target / targetDates.length : target;
  const revenueByDate = new Map<string, number>();
  operations
    .filter(op => isLive(op))
    .forEach(op => {
      const date = operationDate(op, referenceDate);
      revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + (financials[op.id]?.revenue ?? 0));
    });
  const displayDates = calendarDates.filter(
    date => targetDates.includes(date) || (revenueByDate.get(date) ?? 0) > 0 || date === referenceDate,
  );
  const days: RevenuePaceDay[] = displayDates.map(date => {
    const revenue = revenueByDate.get(date) ?? 0;
    const dayTarget = targetDates.includes(date) ? dailyTarget : 0;
    const status =
      date > referenceDate ? "future" : date === referenceDate ? "position" : revenue >= dayTarget ? "met" : "missed";
    return {
      date,
      label: atNoon(date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", ""),
      target: dayTarget,
      revenue,
      variance: revenue - dayTarget,
      status,
    };
  });
  const completed = days.filter(day => day.date < referenceDate && day.target > 0);
  const elapsedTargetDays = targetDates.filter(date => date <= referenceDate);
  const elapsedTarget = elapsedTargetDays.length * dailyTarget;
  const revenue = operations
    .filter(op => {
      const date = operationDate(op, referenceDate);
      return isLive(op) && date >= range.from && date <= referenceDate;
    })
    .reduce((sum, op) => sum + (financials[op.id]?.revenue ?? 0), 0);
  const metDays = completed.filter(day => day.revenue >= dailyTarget).length;
  const missedDays = completed.length - metDays;
  const remainingDays = targetDates.filter(date => date > referenceDate).length;
  const remaining = Math.max(0, target - revenue);
  const currentDailyAverage = elapsedTargetDays.length ? revenue / elapsedTargetDays.length : 0;
  const requiredDailyPace = remainingDays ? remaining / remainingDays : remaining;
  const projected = currentDailyAverage * targetDates.length;
  const attainment = target ? (revenue / target) * 100 : 0;
  const expectedAttainment = target ? (elapsedTarget / target) * 100 : 0;
  const trend = revenue >= elapsedTarget ? "above" : projected >= target ? "on-track" : "below";
  const ranked = days.filter(day => day.date <= referenceDate && day.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  return {
    ...range,
    days,
    target,
    dailyTarget,
    elapsedTarget,
    revenue,
    remaining,
    remainingDays,
    currentDailyAverage,
    requiredDailyPace,
    projected,
    attainment,
    expectedAttainment,
    metDays,
    missedDays,
    totalCompletedDays: completed.length,
    trend,
    bestDay: ranked[0],
    worstDay: ranked.at(-1),
  };
}
