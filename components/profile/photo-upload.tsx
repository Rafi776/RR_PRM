"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { uploadProfilePhoto } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/teams";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

const initial: ActionResult = { error: null };

export function PhotoUpload({
  currentPhoto,
  fullName,
}: {
  currentPhoto: string | null;
  fullName: string;
}) {
  const [state, formAction, pending] = useActionState(uploadProfilePhoto, initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        {currentPhoto ? <AvatarImage src={currentPhoto} alt={fullName} /> : null}
        <AvatarFallback className="text-lg">{initials || "?"}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/*"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-1 h-4 w-4" />
          {pending ? "Uploading..." : "Change photo"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Up to 5MB.</p>
      </div>
    </form>
  );
}
