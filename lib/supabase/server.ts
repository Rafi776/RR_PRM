import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

// Server-side Supabase client for use in Server Components, Route
// Handlers, and Server Actions. Reads/writes auth cookies via Next's
// `cookies()` API.
//
// NOTE: `setAll` is wrapped in a try/catch because Server Components
// cannot set cookies — that responsibility is delegated to middleware
// (see middleware.ts), which refreshes the session on every request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware handles session refresh on the request path.
          }
        },
      },
    },
  );
}

// Service-role client for privileged server-only operations (bulk CSV
// import, admin actions that must bypass RLS). NEVER import this into
// any file that can be bundled for the client.
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Service-role client is not tied to a user session.
        },
      },
    },
  );
}
