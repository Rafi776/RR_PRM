"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteTaskButton({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const [pending, setPending] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${taskTitle}"? This removes all submissions and comments too.`)) return;
    setPending(true);
    const result = await deleteTask(taskId);
    setPending(false);
    if (result.error) toast.error(result.error);
    else toast.success(result.success ?? "Deleted.");
  };

  return (
    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onClick}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
