import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

// Browser-side Supabase client. Use this inside Client Components only.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
