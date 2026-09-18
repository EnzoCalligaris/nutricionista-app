import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { requireNutritionist } from "@/lib/auth/session";

// Segunda camada de proteção (prompt Fase 3 §7) — o proxy (src/proxy.ts) já
// redireciona antes de chegar aqui, mas este layout revalida
// independentemente: um matcher mal configurado ou um refactor que mova uma
// Server Function não deveria deixar `/dashboard` acessível sem essa
// checagem (ver aviso do próprio Next.js em node_modules/next/dist/docs/
// .../proxy.md, seção "Execution order").
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await requireNutritionist();

  return (
    <SidebarProvider>
      <DashboardSidebar />
      {/* min-w-0: sem isso o <main> (flex item) cresce além do viewport quando
          uma tabela larga aparece, em vez de a tabela rolar dentro do card. */}
      <SidebarInset className="min-w-0">
        <DashboardHeader fullName={profile.full_name} />
        <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">{children}</div>
        <Toaster position="bottom-right" richColors closeButton />
      </SidebarInset>
    </SidebarProvider>
  );
}
