import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrganogramData } from "@/lib/data/teams";
import { User } from "lucide-react";

function RoleCard({
  label,
  name,
  variant = "default",
}: {
  label: string;
  name: string | null;
  variant?: "default" | "secondary";
}) {
  return (
    <Card className="w-48 shrink-0">
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <Badge variant={variant} className="text-[10px]">
          {label}
        </Badge>
        <p className="text-sm font-medium leading-tight">
          {name ?? <span className="text-muted-foreground">Vacant</span>}
        </p>
      </CardContent>
    </Card>
  );
}

export function Organogram({ data }: { data: OrganogramData }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max flex-col items-center">
        {/* Tier 1: fixed Core Team roles */}
        <div className="flex flex-wrap justify-center gap-4">
          {data.fixedRoles.map((r) => (
            <RoleCard key={r.role} label={r.role} name={r.member?.full_name ?? null} />
          ))}
        </div>

        {/* Connector */}
        <div className="h-6 w-px bg-border" />
        <div
          className="h-px bg-border"
          style={{ width: `${Math.max(data.teams.length, 1) * 13}rem` }}
        />

        {/* Tier 2: operational team leadership */}
        <div className="flex flex-wrap justify-center gap-4 pt-6">
          {data.teams.map((t) => (
            <div key={t.id} className="relative flex flex-col items-center">
              <div className="absolute -top-6 h-6 w-px bg-border" />
              <Card className="w-48 shrink-0">
                <CardContent className="space-y-2 p-3">
                  <p className="text-center text-sm font-semibold">{t.name}</p>
                  <div className="space-y-1 text-center text-xs">
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        Coordinator
                      </Badge>
                      <p className="mt-0.5 font-medium">
                        {t.coordinator?.full_name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        Deputy
                      </Badge>
                      <p className="mt-0.5 font-medium">
                        {t.deputy_coordinator?.full_name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
          {data.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No operational teams yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
