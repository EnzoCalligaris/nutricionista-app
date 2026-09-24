import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsentForm } from "@/components/results/consent-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getDashboardResult } from "@/data/results";

export const metadata: Metadata = { title: "Registrar consentimento" };
export const dynamic = "force-dynamic";

/**
 * Registro do consentimento de imagem (prompt Fase 14 §29/§30). Tela própria
 * porque é o passo que autoriza a publicação — não um checkbox escondido num
 * formulário maior.
 */
export default async function ConsentimentoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNutritionist();
  const { id } = await params;
  const result = await getDashboardResult(id);
  if (!result) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/resultados" className="hover:underline">
            Resultados
          </Link>{" "}
          /{" "}
          <Link href={`/dashboard/resultados/${result.id}`} className="hover:underline">
            {result.title}
          </Link>{" "}
          / Consentimento
        </p>
        <h1 className="font-heading text-2xl font-medium">Consentimento de uso de imagem</h1>
        <p className="text-sm text-muted-foreground">
          Sem este registro o resultado não pode ser publicado — nem pela interface, nem por chamada direta ao banco.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Registrar autorização</CardTitle>
          <CardDescription>
            O que for gravado aqui descreve uma autorização que você já obteve do paciente. Este formulário não é a
            autorização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsentForm
            resultId={result.id}
            patient={result.patientId && result.patientName ? { id: result.patientId, name: result.patientName } : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
