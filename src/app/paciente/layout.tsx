import { PatientHeader } from "@/components/layout/patient-header";
import { PatientSidebar } from "@/components/layout/patient-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Autenticação/autorização (role PATIENT) chega na Fase 3 — ver
// docs/ARCHITECTURE.md e docs/DECISIONS.md. Este layout é só o shell visual.
export default function PatientLayout({ children }: LayoutProps<"/paciente">) {
  return (
    <SidebarProvider>
      <PatientSidebar />
      <SidebarInset>
        <PatientHeader />
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
