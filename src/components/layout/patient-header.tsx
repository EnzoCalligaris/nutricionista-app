"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogoutMenuItem } from "@/components/auth/logout-menu-item";
import { initials } from "@/lib/utils";

export function PatientHeader({ fullName, unreadCount = 0 }: { fullName: string; unreadCount?: number }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <span className="text-sm text-muted-foreground">Portal do paciente</span>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link
            href="/paciente/notificacoes"
            aria-label={unreadCount > 0 ? `Notificações: ${unreadCount} não lida(s)` : "Notificações"}
            data-testid="notifications-bell"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unreadCount > 0 ? (
              <span
                data-testid="notifications-unread-count"
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums"
                aria-hidden="true"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback>{initials(fullName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{fullName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <LogoutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
