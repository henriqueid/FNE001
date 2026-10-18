/** Snapshot único compartilhado pelo resumo e pela análise detalhada do Copiloto. */
import type { Permission } from "@/src/domain/access/model";
import type { BehaviorEvent, Learning } from "./behavior";

export type CopilotReport = {
  id: string;
  question: string;
  createdAt: string;
  referenceDate: string;
  positionDate?: string;
  source?:
    "portfolio" | "behavior" | "policy" | "operation" | "registry" | "system" | "finance" | "commercial" | "task";
  title: string;
  paragraphs: string[];
  criterion: string;
  companies: string[];
  requiredPermissions: Permission[];
  entityRefs: string[];
  warnings: string[];
  table?: { head: string[]; rows: string[][] };
  metrics: { label: string; value: string }[];
  behavior: BehaviorEvent[];
  learnings: Learning[];
  queryKey?: string;
  queryEntityDocument?: string;
  resolvedQuestion?: string;
  filters?: { company?: string; document?: string };
  availableCompanies?: string[];
  entities?: { id: string; company: string; label: string }[];
  marketSource?: { name: string; url: string; date: string; unit: string };
  suggestedQuestions?: string[];
};
export type ReportLink = Pick<CopilotReport, "id" | "title" | "referenceDate" | "criterion" | "metrics" | "queryKey">;
