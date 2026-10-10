"use client";

export const tenantHeaders = (tenantId: string) => ({
  "content-type": "application/json",
  "x-strato-tenant-id": tenantId,
});

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit, tenantId: string) {
  const request = () => fetch(input, { ...init, headers: { ...tenantHeaders(tenantId), ...init.headers } });
  let response = await request();
  if (response.status !== 401) return response;
  const session = await fetch("/api/auth/session", { method: "POST", headers: tenantHeaders(tenantId) });
  if (!session.ok) return response;
  response = await request();
  return response;
}
