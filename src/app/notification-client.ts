"use client";

import { type OutboxHealth, type PublishedNotification } from "@/src/domain/notifications/model";
import { authenticatedFetch } from "./session-client";

type NotificationResponse = {
  notifications: PublishedNotification[];
  health?: OutboxHealth;
  error?: string;
};

function errorMessage(body: unknown, fallback: string) {
  const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
  if (typeof error !== "string") return fallback;
  const message = error.trim();
  return message && message.length <= 300 && !/^[{[]/.test(message) && !/<[^>]*>/.test(message) ? message : fallback;
}

async function request(url: string, options: RequestInit, tenantId: string) {
  try {
    return await authenticatedFetch(url, options, tenantId);
  } catch {
    throw new Error("Não foi possível conectar à Central de Notificações.");
  }
}

async function responseBody(response: Response) {
  const body = (await response.json().catch(() => null)) as NotificationResponse | null;
  if (!response.ok || !body || !Array.isArray(body.notifications))
    throw new Error(errorMessage(body, "Não foi possível atualizar a Central de Notificações."));
  return body;
}

export async function syncPublishedNotifications(tenantId: string) {
  const processed = await request("/api/outbox/process", { method: "POST" }, tenantId);
  if (!processed.ok) {
    const body: unknown = await processed.json().catch(() => null);
    throw new Error(errorMessage(body, "Não foi possível processar as notificações pendentes."));
  }
  return responseBody(await request("/api/notifications", {}, tenantId));
}

export async function retryFailedNotifications(tenantId: string) {
  const response = await request("/api/outbox/process", { method: "PUT" }, tenantId);
  const body = (await response.json().catch(() => null)) as { health?: OutboxHealth; error?: unknown } | null;
  if (!response.ok || !body?.health)
    throw new Error(errorMessage(body, "Não foi possível reprocessar a fila de falhas."));
  return body.health;
}
