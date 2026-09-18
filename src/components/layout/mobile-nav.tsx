"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(88vw,22rem)]">
          <SheetHeader>
            <SheetTitle className="font-heading text-lg">Método EM</SheetTitle>
            <SheetDescription>Acompanhamento nutricional com Enzo Mangili.</SheetDescription>
          </SheetHeader>

          <nav aria-label="Principal (mobile)" className="px-4">
            <ul className="flex flex-col">
              {[...siteConfig.nav, { href: "/planos", label: "Planos" }, { href: "/contato", label: "Contato" }].map(
                (item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-3 text-base text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="mt-auto flex flex-col gap-2 p-4">
            <Button asChild size="lg">
              <Link href="/agendar" onClick={() => setOpen(false)}>
                Começar acompanhamento
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login" onClick={() => setOpen(false)}>
                Entrar
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
