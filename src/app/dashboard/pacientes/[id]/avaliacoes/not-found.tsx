import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Mesma resposta para "não existe" e "não é seu" (avaliação de paciente de
// outro nutricionista): nada é revelado (docs/SECURITY.md, IDOR).
export default function AvaliacaoNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h1 className="font-heading text-xl font-medium">Avaliação não encontrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">A avaliação não existe ou não pertence a um paciente sob a sua responsabilidade.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/avaliacoes">Voltar para avaliações</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
