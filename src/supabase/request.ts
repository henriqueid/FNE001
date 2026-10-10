import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/src/supabase/config";
import { type Database } from "@/src/supabase/database.types";

export function bearerToken(headers: Headers) {
  const authorization = headers.get("authorization")?.trim();
  if (!authorization) return undefined;
  const [scheme, token, ...rest] = authorization.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length) return undefined;
  return token;
}

export function supabaseForRequest(headers: Headers) {
  const token = bearerToken(headers);
  if (!token) return undefined;
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function authenticatedSupabase(headers: Headers) {
  const token = bearerToken(headers);
  const client = supabaseForRequest(headers);
  if (!token || !client) return undefined;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return undefined;
  return { client, user: data.user };
}
