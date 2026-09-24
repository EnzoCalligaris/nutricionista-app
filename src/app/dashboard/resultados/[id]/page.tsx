import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { ResultForm } from "@/components/results/result-form";
import { ResultImageField } from "@/components/results/result-images";
import { ResultActions } from "@/components/results/result-actions";
import { ConsentPanel } from "@/components/results/consent-panel";
import { ResultStateBadge } from "@/components/results/result-state-badge";
import { BeforeAfter } from "@/components/marketing/before-after";
import { requireNutritionist } from "@/lib/auth/session";
import { getDashboardResult, resultImageUrl } from "@/data/results";
import { signResultImage } from "@/services/results";
import { resultImageAlt } from "@/domain/results/display";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getDashboardResult(id);
  return { title: result ? result.title : "Resultado" };
}

/**
 * Detalhe do resultado (prompt Fase 14 §28–§38): dados, fotos, consentimento,
 * ações de publicação e PREVIEW de como o site exibe (§38) — o preview usa o
 * mesmo componente do site público.
 */
export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireNutritionist();
  const { id } = await params;
  const result = await getDashboardResult(id);
  if (!result) notFound();

  const [beforeUrl, afterUrl] = await Promise.all([signResultImage(result.beforePath), signResultImage(result.afterPath)]);
  const hasBothImages = Boolean(result.beforePath && result.afterPath);

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/dashboard/resultados" className="hover:underline">
              Resultados
            </Link>{" "}
            / {result.title}
          </p>
          <h1 className="font-heading text-2xl font-medium">{result.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ResultStateBadge state={result.state} />
            {result.state === "PUBLISHED" ? (
              <a
                href="/resultados"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver no site
                <ExternalLinkIcon className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Fotos</CardTitle>
              <CardDescription>
                Guardadas em bucket privado. A pré-visualização usa uma URL assinada de curta duração, gerada no
                servidor e nunca salva.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <ResultImageField resultId={result.id} slot="before" previewUrl={beforeUrl} disabled={Boolean(result.archivedAt)} />
                <ResultImageField resultId={result.id} slot="after" previewUrl={afterUrl} disabled={Boolean(result.archivedAt)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultForm result={result} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Consentimento de uso de imagem</CardTitle>
              <CardDescription>Obrigatório para publicar. Revogar tira o resultado do site na hora.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConsentPanel result={result} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultActions result={result} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Prévia do site</CardTitle>
              <CardDescription>
                Mesmo componente usado na página pública. As imagens só carregam aqui quando o resultado já está
                elegível — é a mesma rota que o visitante usaria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasBothImages ? (
                result.state === "PUBLISHED" ? (
                  <BeforeAfter
                    beforeUrl={resultImageUrl(result.id, "before")}
                    afterUrl={resultImageUrl(result.id, "after")}
                    beforeAlt={resultImageAlt("before", result.imageAlt)}
                    afterAlt={resultImageAlt("after", result.imageAlt)}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Antes", url: beforeUrl },
                      { label: "Depois", url: afterUrl },
                    ].map((frame) => (
                      <figure key={frame.label} className="m-0">
                        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-secondary">
                          {frame.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={frame.url} alt={`Prévia da foto de ${frame.label.toLowerCase()}`} className="size-full object-cover" />
                          ) : null}
                        </div>
                        <figcaption className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {frame.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )
              ) : (
                <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Envie as duas fotos para ver a prévia.
                </p>
              )}
              <div>
                <p className="font-heading text-lg">{result.title}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {[result.period, result.displayName ?? "anônimo"].filter(Boolean).join(" · ")}
                </p>
                {result.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
