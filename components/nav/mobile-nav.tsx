"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/nav/sidebar-nav";

export function MobileNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon" variant="ghost" className="lg:hidden" />}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
            <Sparkles className="h-5 w-5 text-sidebar-primary" />
            PRM Portal
          </SheetTitle>
        </SheetHeader>
        <SidebarNav isSuperAdmin={isSuperAdmin} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
