import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Mesma resposta para "não existe" e "não é seu": não revela existência de
// paciente de outro nutricionista (docs/SECURITY.md, IDOR).
export default function PacienteNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h1 className="font-heading text-xl font-medium">Paciente não encontrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          O paciente não existe ou não está sob a sua responsabilidade.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/pacientes">Voltar para pacientes</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
