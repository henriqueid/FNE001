/** Contrato de leitura do radar; eventos internos e publicações externas mantêm sua origem. */
import type { AccessView } from "@/src/domain/access/model";

export type RadarEvent = {
  id: string;
  title: string;
  summary: string;
  at: string;
  source: string;
  view: AccessView;
  operationId?: string;
  priority?: "attention" | "info";
  action?: string;
};
export type MarketNews = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: "BCB" | "CVM" | "Agência Brasil";
  publishedAt: string;
  topic: string;
  relevance: string;
};
export type RadarMarket =
  | { available: false; reason: string }
  | { available: true; name: string; unit: string; date: string; value: number; url: string };
export type RadarSnapshot = {
  events: RadarEvent[];
  market: RadarMarket[];
  news?: { items: MarketNews[]; unavailable: string[]; checkedAt: string };
  checkedAt: string;
};
