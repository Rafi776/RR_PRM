"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setMemberPhoto } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon } from "lucide-react";

const initial: ActionResult = { error: null };

export function PhotoEditor({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(setMemberPhoto, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the URL field in response to a server action result, not deriving render state
      setUrlValue("");
    }
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="memberId" value={memberId} />
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="mr-1 h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="url">
            <LinkIcon className="mr-1 h-3.5 w-3.5" />
            URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="flex items-center gap-2 pt-2">
          <Input name="file" type="file" accept="image/*" className="max-w-xs" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </TabsContent>
        <TabsContent value="url" className="flex items-center gap-2 pt-2">
          <Input
            name="photoUrl"
            type="url"
            placeholder="https://..."
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={pending || !urlValue}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </TabsContent>
      </Tabs>
    </form>
  );
}
