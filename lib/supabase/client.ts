import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

// Browser-side Supabase client. Use this everywhere now — the app is a
// static export (see next.config.ts), so there is no server runtime and
// RLS is the only authorization boundary. @supabase/ssr's
// createBrowserClient already memoizes a singleton per URL+key under the
// hood, but we keep an explicit module-level singleton too so every
// caller (hooks, auth guard, mutations) shares one auth-state listener.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
