import Link from "next/link";
import { cn } from "@/lib/utils";

export const PATIENT_SECTIONS = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "contratos", label: "Contratos" },
  { id: "consultas", label: "Consultas" },
  { id: "cardapio", label: "Cardápio" },
  { id: "avaliacoes", label: "Avaliações" },
  { id: "comentarios", label: "Comentários" },
  { id: "financeiro", label: "Financeiro" },
  { id: "feedbacks", label: "Feedbacks" },
  { id: "materiais", label: "Materiais" },
] as const;

export type PatientSectionId = (typeof PATIENT_SECTIONS)[number]["id"];

export function parsePatientSection(value: string | undefined): PatientSectionId {
  return PATIENT_SECTIONS.some((section) => section.id === value) ? (value as PatientSectionId) : "visao-geral";
}

/**
 * Seções do perfil como links (`?tab=`): URL compartilhável, sem JS, e cada
 * seção é renderizada no servidor só quando ativa (prompt Fase 5 §22).
 * Rola horizontalmente em telas estreitas em vez de quebrar em várias linhas.
 */
export function PatientSectionNav({ patientId, active }: { patientId: string; active: PatientSectionId }) {
  return (
    <nav aria-label="Seções do paciente" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-border">
        {PATIENT_SECTIONS.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <Link
                href={
                  section.id === "visao-geral"
                    ? `/dashboard/pacientes/${patientId}`
                    : `/dashboard/pacientes/${patientId}?tab=${section.id}`
                }
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-9 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isActive
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
