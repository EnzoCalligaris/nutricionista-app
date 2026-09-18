import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PatientFilters } from "@/components/patients/patient-filters";
import { PatientMetricsCards } from "@/components/patients/patient-metrics-cards";
import { PatientTable } from "@/components/patients/patient-table";
import { Pagination } from "@/components/shared/pagination";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientMetrics, listPatients } from "@/data/patients";
import { patientListQuerySchema } from "@/validators/patients";
import { todayISO } from "@/lib/calendar";

export const metadata: Metadata = {
  title: "Pacientes",
};

// Dados administrativos: sempre dinâmicos, por usuário, sem ISR (prompt
// Fase 5 §59) — o cliente de sessão já força `cookies()`, e as actions
// chamam `revalidatePath` após cada mutação.
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PacientesPage({ searchParams }: PageProps<"/dashboard/pacientes">) {
  const nutritionist = await requireNutritionist();
  const raw = await searchParams;
  const query = patientListQuerySchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    page: firstParam(raw.page),
    pageSize: firstParam(raw.pageSize),
  });

  const [metrics, result] = await Promise.all([
    getPatientMetrics(nutritionist.id),
    listPatients(nutritionist.id, query),
  ]);

  const today = todayISO();
  const hasFilters = Boolean(query.q) || query.status !== "all";

  function hrefForPage(page: number) {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status !== "all") params.set("status", query.status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/dashboard/pacientes?${qs}` : "/dashboard/pacientes";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro, contratos e acompanhamento de cada paciente.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/pacientes/novo">
            <Plus data-icon="inline-start" />
            Novo paciente
          </Link>
        </Button>
      </div>

      <PatientMetricsCards metrics={metrics} />

      <PatientFilters q={query.q} status={query.status} />

      {result.items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Users className="size-5" aria-hidden="true" />
            </div>
            {hasFilters ? (
              <>
                <p className="font-medium">Nenhum paciente encontrado.</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Tente outro termo de busca ou remova os filtros.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/pacientes">Limpar filtros</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">Nenhum paciente cadastrado.</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Cadastre o primeiro paciente para começar a registrar contratos e acompanhar a evolução.
                </p>
                <Button asChild size="sm">
                  <Link href="/dashboard/pacientes/novo">
                    <Plus data-icon="inline-start" />
                    Novo paciente
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <PatientTable items={result.items} today={today} />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            hrefForPage={hrefForPage}
            itemLabel={{ singular: "paciente", plural: "pacientes" }}
          />
        </>
      )}
    </div>
  );
}
