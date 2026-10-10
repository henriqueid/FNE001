import { type AttentionKind, type AttentionTone } from "@/src/domain/copilot/attention-center";
import { type Permission } from "@/src/domain/access/model";
import { type AppView } from "@/src/features/shell/shell-context";

export type PublishedNotification = {
  id: string;
  sourceEventId: string;
  decisionId: string;
  operationId: string;
  kind: AttentionKind;
  tone: AttentionTone;
  title: string;
  summary: string;
  detail: string;
  impact: string;
  nextAction: string;
  owner: string;
  department: string;
  timing: string;
  view: AppView;
  requiredPermission?: Permission;
  authorityId?: string;
  createdAt: string;
};

export type OutboxHealth = {
  pending: number;
  failed: number;
  published: number;
};
