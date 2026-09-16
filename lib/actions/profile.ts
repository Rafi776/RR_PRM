import { createClient } from "@/lib/supabase/client";
import { fetchCurrentUser } from "@/lib/hooks/use-current-user";
import { queryClient } from "@/lib/query-client";
import type { ActionResult } from "@/lib/actions/teams";

// Self-service only: a member may update their own phone and photo.
// Every other column on prm_members is locked down for self-updates by
// the `restrict_self_member_update` DB trigger (0005) regardless of
// what this action sends — this check is a fast-path UX guard, not the
// actual security boundary.

export async function uploadProfilePhoto(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Only image files are accepted." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image must be under 5MB." };
  }

  const supabase = createClient();
  const path = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("member-photos")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("member-photos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("prm_members")
    .update({ photo: publicUrl })
    .eq("id", user.id);
  if (updateError) return { error: updateError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Profile photo updated." };
}

// General-purpose photo setter used by the member detail modal: works
// for a member setting their own photo, or a Super Admin / that
// member's Team Coordinator setting it for them — via an uploaded file
// OR a pasted URL. The UI only shows this control to those roles, but
// storage policies (0006) and prm_members RLS are the real boundary:
// an unauthorized memberId will fail at the DB with a clear error
// rather than silently succeeding.
export async function setMemberPhoto(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member." };

  const supabase = createClient();
  const file = formData.get("file");
  const url = String(formData.get("photoUrl") ?? "").trim();

  let photo: string;

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return { error: "Only image files are accepted." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "Image must be under 5MB." };
    }

    const path = `${memberId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("member-photos")
      .upload(path, file, { contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    photo = supabase.storage.from("member-photos").getPublicUrl(path).data.publicUrl;
  } else if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "URL must start with http:// or https://." };
      }
    } catch {
      return { error: "Enter a valid URL." };
    }
    photo = url;
  } else {
    return { error: "Choose a file or enter a URL." };
  }

  const { error: updateError } = await supabase
    .from("prm_members")
    .update({ photo })
    .eq("id", memberId);
  if (updateError) return { error: updateError.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Photo updated." };
}

export async function updateOwnPhone(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await fetchCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = createClient();
  const { error } = await supabase
    .from("prm_members")
    .update({ phone: phone || null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  queryClient.invalidateQueries();
  return { error: null, success: "Phone number updated." };
}
