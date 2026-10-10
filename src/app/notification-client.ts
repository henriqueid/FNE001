"use client";

import { type OutboxHealth, type PublishedNotification } from "@/src/domain/notifications/model";
import { authenticatedFetch } from "./session-client";

type NotificationResponse = {
  notifications: PublishedNotification[];
  health?: OutboxHealth;
  error?: string;
};

async function responseBody(response: Response) {
  const body = (await response.json()) as NotificationResponse;
  if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar a Central de Notificações.");
  return body;
}

export async function syncPublishedNotifications(tenantId: string) {
  const processed = await authenticatedFetch("/api/outbox/process", { method: "POST" }, tenantId);
  if (!processed.ok) {
    const body = (await processed.json()) as { error?: string };
    throw new Error(body.error ?? "Não foi possível processar as notificações pendentes.");
  }
  return responseBody(await authenticatedFetch("/api/notifications", {}, tenantId));
}

export async function retryFailedNotifications(tenantId: string) {
  const response = await authenticatedFetch("/api/outbox/process", { method: "PUT" }, tenantId);
  const body = (await response.json()) as { health?: OutboxHealth; error?: string };
  if (!response.ok || !body.health) throw new Error(body.error ?? "Não foi possível reprocessar a fila de falhas.");
  return body.health;
}
