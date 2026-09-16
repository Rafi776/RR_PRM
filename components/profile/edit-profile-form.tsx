"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateOwnProfile } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/teams";
import type { MemberDirectoryRow } from "@/lib/data/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionResult = { error: null };

export function EditProfileForm({ profile }: { profile: MemberDirectoryRow }) {
  const [state, formAction, pending] = useActionState(updateOwnProfile, initial);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={profile.full_name} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage">Stage</Label>
          <Input id="stage" name="stage" defaultValue={profile.stage ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scoutGroup">Scout Group</Label>
          <Input id="scoutGroup" name="scoutGroup" defaultValue={profile.scout_group ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input id="district" name="district" defaultValue={profile.district ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="teamName">Team label</Label>
          <Input id="teamName" name="teamName" defaultValue={profile.team_name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Input id="position" name="position" defaultValue={profile.position ?? ""} />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
