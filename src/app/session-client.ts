export const tenantHeaders = (tenantId: string) => ({
  "content-type": "application/json",
  "x-strato-tenant-id": tenantId,
});

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit, tenantId: string) {
  return fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...tenantHeaders(tenantId),
      ...init.headers,
    },
  });
}
