import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Estado de carregamento do financeiro (prompt Fase 7 §71). */
export default function FinanceiroLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando financeiro">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>
      {Array.from({ length: 2 }).map((_, row) => (
        <div key={row} className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} size="sm">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
      <Skeleton className="h-8 w-full max-w-lg" />
      <Card className="py-0">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
