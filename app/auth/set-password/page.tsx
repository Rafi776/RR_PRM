"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { setPassword, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: AuthActionState = { error: null };

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initial);

  return (
    <div className="brand-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center text-primary-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">PRM Portal</h1>
        </div>

      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Choose a password for your account. You can sign in with it from now on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving..." : "Set password and continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
