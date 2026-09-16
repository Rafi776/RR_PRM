"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { syncTeamsFromMemberRecords, type SyncTeamsResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const initial: SyncTeamsResult = { error: null, teamsCreated: [], membersLinked: 0 };

export function SyncTeamsButton() {
  const [state, formAction, pending] = useActionState(syncTeamsFromMemberRecords, initial);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.teamsCreated.length > 0 || state.membersLinked > 0) {
      toast.success(
        `Synced: ${state.teamsCreated.length} team(s) created, ${state.membersLinked} member link(s) applied.`,
      );
    }
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <RefreshCw className="mr-1 h-4 w-4" />
        {pending ? "Syncing..." : "Sync teams from member records"}
      </Button>
    </form>
  );
}
