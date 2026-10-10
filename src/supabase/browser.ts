"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/src/supabase/config";
import { type Database } from "@/src/supabase/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export const supabaseBrowser = () => {
  if (!browserClient) {
    const { url, publishableKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
};
