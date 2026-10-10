"use client";

import { supabaseBrowser } from "@/src/supabase/browser";

export const tenantHeaders = (tenantId: string) => ({
  "content-type": "application/json",
  "x-strato-tenant-id": tenantId,
});

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit, tenantId: string) {
  const {
    data: { session },
  } = await supabaseBrowser().auth.getSession();
  return fetch(input, {
    ...init,
    headers: {
      ...tenantHeaders(tenantId),
      ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });
}
