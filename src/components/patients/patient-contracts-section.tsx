import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContractCard } from "@/components/contracts/contract-card";
import type { PatientContract } from "@/data/contracts";

/** Histórico completo de contratos (prompt Fase 5 §36): todos, nunca sobrescritos. */
export function PatientContractsSection({
  patientId,
  contracts,
  today,
  canCreate,
}: {
  patientId: string;
  contracts: PatientContract[];
  today: string;
  canCreate: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {contracts.length === 0
            ? "Nenhum contrato registrado."
            : `${contracts.length} ${contracts.length === 1 ? "contrato" : "contratos"} — do mais recente ao mais antigo.`}
        </p>
      </div>

      {contracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <FileSignature className="size-5" aria-hidden="true" />
            </div>
            <p className="font-medium">Este paciente ainda não possui contrato.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Registre o plano contratado para acompanhar parcelas, valores recebidos e previsão.
            </p>
            {canCreate ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/pacientes/${patientId}/contratos/novo`}>
                  <Plus data-icon="inline-start" />
                  Novo contrato
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}
