import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
      <SidebarInset>
        <DashboardHeader fullName={profile.full_name} />
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
