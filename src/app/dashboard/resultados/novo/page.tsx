import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultForm } from "@/components/results/result-form";
import { requireNutritionist } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo resultado" };
export const dynamic = "force-dynamic";

/**
 * Criação do resultado (prompt Fase 14 §28/§35). O fluxo é deliberadamente
 * separado da avaliação clínica da Fase 9: uma avaliação NUNCA vira resultado
 * público automaticamente — aqui o nutricionista cria, envia as fotos,
 * registra o consentimento e publica, em passos explícitos.
 */
export default async function NovoResultadoPage() {
  await requireNutritionist();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/resultados" className="hover:underline">
            Resultados
          </Link>{" "}
          / Novo
        </p>
        <h1 className="font-heading text-2xl font-medium">Novo resultado</h1>
        <p className="text-sm text-muted-foreground">
          Passo 1 de 3: os dados. Depois vêm as fotos e o consentimento — só então é possível publicar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados do resultado</CardTitle>
          <CardDescription>
            Nada aqui é publicado ainda. Uma avaliação física da Fase 9 não se transforma em resultado público — os
            fluxos são separados de propósito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResultForm result={null} />
        </CardContent>
      </Card>
    </div>
  );
}
