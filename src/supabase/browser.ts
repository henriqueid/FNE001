"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/src/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const supabaseBrowser = () => {
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
};
