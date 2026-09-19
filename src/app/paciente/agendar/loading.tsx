import { Skeleton } from "@/components/ui/skeleton";

/** Carregando datas/horários (prompt Fase 6 §73). */
export default function AgendarLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando horários">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-16 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
