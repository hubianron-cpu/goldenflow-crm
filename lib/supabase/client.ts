"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let supabase: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const { url, anonKey } = getSupabaseEnv();

  supabase = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return supabase;
}
