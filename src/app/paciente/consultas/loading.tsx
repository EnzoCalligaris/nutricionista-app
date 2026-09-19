import { Skeleton } from "@/components/ui/skeleton";

/** Carregando consultas do paciente (prompt Fase 6 §73). */
export default function ConsultasLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando consultas">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
