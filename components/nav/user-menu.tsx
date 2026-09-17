"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { switchActiveOrganization } from "@/lib/actions/organizations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, UserCircle, Building2, Check } from "lucide-react";

export function UserMenu({
  fullName,
  email,
  avatarUrl,
  roles,
  organizationId,
  organizationName,
  availableOrganizations,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
  organizationId: string;
  organizationName: string;
  availableOrganizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSwitch = async (orgId: string) => {
    if (orgId === organizationId) return;
    setSwitchingId(orgId);
    const result = await switchActiveOrganization(orgId);
    setSwitchingId(null);
    if (result.error) toast.error(result.error);
  };
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
        <Avatar className="h-8 w-8">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{fullName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col px-1.5 py-1">
          <span className="text-sm font-medium">{fullName}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-wrap gap-1 px-2 py-1.5">
          {roles.length === 0 ? (
            <Badge variant="secondary">Member</Badge>
          ) : (
            roles.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        {availableOrganizations.length > 1 ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              Organization
            </DropdownMenuLabel>
            {availableOrganizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                disabled={switchingId !== null}
                onClick={() => handleSwitch(org.id)}
              >
                {org.id === organizationId ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="w-4" />
                )}
                {switchingId === org.id ? "Switching..." : org.name}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {organizationName}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserCircle className="h-4 w-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            queryClient.clear();
            router.push("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
