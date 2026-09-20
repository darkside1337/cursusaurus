import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

let client: SupabaseClient | null = null;

export function getStorageClient(): SupabaseClient {
  if (!client) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Supabase Storage credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not set in environment."
      );
    }
    const normalizedUrl = env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
    client = createClient(normalizedUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
