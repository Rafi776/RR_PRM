"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteNoc } from "@/lib/actions/noc";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteNocButton({ nocId }: { nocId: string }) {
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    if (!confirm("Delete this duplicate NOC submission? This can't be undone.")) return;
    setPending(true);
    const result = await deleteNoc(nocId);
    setPending(false);
    if (result.error) toast.error(result.error);
    else toast.success(result.success ?? "Deleted.");
  };

  return (
    <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={onClick}>
      <Trash2 className="mr-1 h-4 w-4" />
      Delete
    </Button>
  );
}
