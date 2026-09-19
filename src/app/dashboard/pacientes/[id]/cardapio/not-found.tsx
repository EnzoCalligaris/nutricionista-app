import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Mesma resposta para "não existe" e "não é seu" (plano/versão de outro
// nutricionista): nada é revelado (docs/SECURITY.md, IDOR).
export default function CardapioNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h1 className="font-heading text-xl font-medium">Plano alimentar não encontrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">O plano ou a versão não existe ou não pertence a um paciente sob a sua responsabilidade.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/cardapios">Voltar para cardápios</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
