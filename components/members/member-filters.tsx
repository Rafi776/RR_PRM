"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export function MemberFilters({
  teams,
  stages,
  districts,
}: {
  teams: string[];
  stages: string[];
  districts: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const hasFilters =
    searchParams.get("q") ||
    searchParams.get("team") ||
    searchParams.get("stage") ||
    searchParams.get("district") ||
    searchParams.get("status");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex w-full items-center gap-2 sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, or BS ID..."
          className="w-full sm:w-64"
        />
        <Button type="submit" size="icon" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <Select
        value={searchParams.get("team") ?? "all"}
        items={[{ value: "all", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t }))]}
        onValueChange={(v) => setParam("team", v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All teams</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("stage") ?? "all"}
        items={[{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s, label: s }))]}
        onValueChange={(v) => setParam("stage", v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("district") ?? "all"}
        items={[
          { value: "all", label: "All districts" },
          ...districts.map((d) => ({ value: d, label: d })),
        ]}
        onValueChange={(v) => setParam("district", v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="District" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All districts</SelectItem>
          {districts.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? "all"}
        items={[
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setQ("");
            startTransition(() => router.push(pathname));
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
