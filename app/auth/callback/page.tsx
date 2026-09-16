"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Landing point for magic-link / recovery links. The browser Supabase
// client is created with detectSessionInUrl: true (the default), so it
// already parses the code/tokens out of the URL and establishes a
// session as soon as it initializes — this page just waits for that and
// forwards on to wherever the link said to go.
function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  useEffect(() => {
    const supabase = createClient();

    const finish = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace(redirectTo);
      } else {
        setError("This link has expired or was already used.");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") finish();
    });

    // In case the session was already established before this listener
    // attached (e.g. fast connections).
    const timeout = setTimeout(finish, 1500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, redirectTo]);

  return (
    <div className="brand-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="relative flex flex-col items-center gap-3 text-center text-primary-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <Sparkles className="h-6 w-6" />
        </div>
        {error ? (
          <>
            <p className="font-medium">{error}</p>
            <a href="/login" className="text-sm underline">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm text-primary-foreground/80">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
