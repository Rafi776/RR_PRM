import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require an authenticated session. Anything under these
// prefixes redirects an unauthenticated visitor to /login.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/members",
  "/profile",
  "/noc",
  "/tasks",
  "/meetings",
  "/leaderboard",
  "/reports",
];

// Routes reserved for Super Admins. Checked via the `user_roles` table
// after establishing there is a valid session.
const ADMIN_ONLY_PREFIXES = ["/admin"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any logic between createServerClient and
  // supabase.auth.getUser() — it refreshes the session token and must
  // execute on every request for SSR auth to stay in sync.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminOnly = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));

  // A block sets prm_members.blocked_at and bans the auth account
  // (lib/actions/admin.ts — the only place blocked_at is ever set), but
  // a session token issued before the ban stays technically valid for
  // the rest of its lifetime — so check on every authenticated request
  // and force sign-out mid-session rather than relying on the ban alone.
  //
  // Deliberately keyed off blocked_at, not status: Team
  // Coordinators/Deputies can independently set a team member's status
  // to 'inactive' via the admin team page for ordinary record-keeping
  // (e.g. someone on leave) — that must NOT lock them out of the site,
  // since blocking is a Super-Admin-only action per the spec.
  if (user && !pathname.startsWith("/login") && !pathname.startsWith("/auth")) {
    const { data: member } = await supabase
      .from("prm_members")
      .select("blocked_at")
      .eq("id", user.id)
      .maybeSingle();

    if (member?.blocked_at) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("blocked", "1");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminOnly && user) {
    const { data: isAdmin } = await supabase.rpc("is_super_admin");
    if (!isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Signed-in users hitting /login or /signup get bounced to the dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANT: always return supabaseResponse as-is (or a NextResponse
  // built from it) so refreshed auth cookies actually reach the browser.
  return supabaseResponse;
}
