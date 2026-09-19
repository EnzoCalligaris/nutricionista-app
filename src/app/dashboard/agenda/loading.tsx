import { Skeleton } from "@/components/ui/skeleton";

/** Estado de carregamento da agenda (prompt Fase 6 §73). */
export default function AgendaLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando agenda">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[520px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
