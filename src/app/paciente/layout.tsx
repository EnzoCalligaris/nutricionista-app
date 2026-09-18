import { PatientHeader } from "@/components/layout/patient-header";
import { PatientSidebar } from "@/components/layout/patient-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requirePatient } from "@/lib/auth/session";

// Segunda camada de proteção (prompt Fase 3 §7) — mesmo raciocínio de
// src/app/dashboard/layout.tsx.
export default async function PatientLayout({ children }: LayoutProps<"/paciente">) {
  const profile = await requirePatient();

  return (
    <SidebarProvider>
      <PatientSidebar />
      <SidebarInset>
        <PatientHeader fullName={profile.full_name} />
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
