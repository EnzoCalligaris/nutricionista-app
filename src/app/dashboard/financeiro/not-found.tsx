import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Mesma resposta para "não existe" e "não é seu" (lançamento, pagamento ou
// paciente de outro nutricionista): nada é revelado (docs/SECURITY.md, IDOR).
export default function FinanceiroNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h1 className="font-heading text-xl font-medium">Registro financeiro não encontrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">O lançamento, pagamento ou paciente não existe ou não está sob a sua responsabilidade.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/financeiro">Voltar para o financeiro</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
