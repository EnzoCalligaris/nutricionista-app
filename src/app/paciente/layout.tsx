import { PatientHeader } from "@/components/layout/patient-header";
import { PatientSidebar } from "@/components/layout/patient-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { requirePatient } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/data/notifications";

// Segunda camada de proteção (prompt Fase 3 §7) — mesmo raciocínio de
// src/app/dashboard/layout.tsx.
export default async function PatientLayout({ children }: LayoutProps<"/paciente">) {
  const profile = await requirePatient();
  // Fase 12: contador do sino (só as próprias, via RLS).
  const unreadCount = await countUnreadNotifications(profile.id);

  return (
    <SidebarProvider>
      <PatientSidebar />
      <SidebarInset className="min-w-0">
        <PatientHeader fullName={profile.full_name} unreadCount={unreadCount} />
        <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">{children}</div>
        <Toaster position="bottom-right" richColors closeButton />
      </SidebarInset>
    </SidebarProvider>
  );
}
