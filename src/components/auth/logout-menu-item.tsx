"use client";

import { useTransition } from "react";
import { logoutAction } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function LogoutMenuItem() {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenuItem
      disabled={isPending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(() => {
          void logoutAction();
        });
      }}
    >
      {isPending ? "Saindo..." : "Sair"}
    </DropdownMenuItem>
  );
}
