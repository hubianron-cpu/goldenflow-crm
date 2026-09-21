import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

export async function createServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as never);
          });
        } catch (error) {
          // Server Components are read-only; middleware persists refreshed cookies.
          if (
            !(error instanceof Error) ||
            !error.message.startsWith("Cookies can only be modified in a Server Action or Route Handler.")
          ) {
            throw error;
          }
        }
      },
    },
  });
}
