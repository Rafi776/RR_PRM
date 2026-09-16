"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type SuperAdminRow = {
  member_id: string;
  full_name: string;
  email: string;
};

export async function listSuperAdmins(): Promise<SuperAdminRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("member_id, prm_members(full_name, email), roles!inner(name)")
    .eq("roles.name", "Super Admin");
  if (error) throw error;

  return (data ?? []).map((row) => {
    const pm = row.prm_members as
      | { full_name: string; email: string }
      | { full_name: string; email: string }[]
      | null;
    const single = Array.isArray(pm) ? pm[0] : pm;
    return {
      member_id: row.member_id,
      full_name: single?.full_name ?? "Unknown",
      email: single?.email ?? "",
    };
  });
}

export function useSuperAdmins() {
  return useQuery({ queryKey: ["super-admins"], queryFn: listSuperAdmins });
}
