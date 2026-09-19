import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeedbackStatusBadge } from "@/components/feedbacks/feedback-badges";
import { FeedbackActions } from "@/components/feedbacks/feedback-actions";
import { feedbackDisplayTitle, feedbackExcerpt, feedbackStatus } from "@/domain/patient-content/feedbacks";
import type { FeedbackDetail } from "@/data/feedbacks";
import { formatCalendarDate, formatDateTime, formatInstantDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Aba Feedbacks do perfil (prompt Fase 10 §27): histórico completo —
 * data, título, status, disponibilizado em, última atualização, ações —
 * mais recente primeiro. Tabela ≥ lg (com a sidebar aberta, 768 fica estreito), cards abaixo; o texto completo fica
 * na edição/leitura, aqui só a prévia.
 */
export function PatientFeedbacksSection({ patientId, feedbacks, canCreate }: { patientId: string; feedbacks: FeedbackDetail[]; canCreate: boolean }) {
  const drafts = feedbacks.filter((item) => feedbackStatus(item) === "DRAFT").length;
  const published = feedbacks.filter((item) => feedbackStatus(item) === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium">Feedbacks</h2>
          <p className="text-sm text-muted-foreground">
            {feedbacks.length === 0 ? "Nenhum feedback registrado." : `${published} disponível(is) ao paciente${drafts > 0 ? ` · ${drafts} rascunho(s)` : ""}`}
          </p>
        </div>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/dashboard/pacientes/${patientId}/feedbacks/novo`}>
              <Plus data-icon="inline-start" />
              Novo feedback
            </Link>
          </Button>
        ) : null}
      </div>

      {feedbacks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <MessageSquare className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhum feedback ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Escreva um retorno individual para o paciente. Você pode guardar como rascunho e disponibilizar depois.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Data</TableHead>
                  <TableHead scope="col">Título</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Disponibilizado em</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Última atualização</TableHead>
                  <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map((item) => {
                  const title = feedbackDisplayTitle(item, formatInstantDate);
                  return (
                    <TableRow key={item.id} className={cn(item.archivedAt && "text-muted-foreground")}>
                      <TableCell className="pl-4 whitespace-nowrap">
                        <p>{formatInstantDate(item.createdAt)}</p>
                        {item.referenceDate ? <p className="text-xs text-muted-foreground">ref. {formatCalendarDate(item.referenceDate)}</p> : null}
                      </TableCell>
                      <TableCell className="max-w-56 xl:max-w-72">
                        <Link href={`/dashboard/pacientes/${patientId}/feedbacks/${item.id}/editar`} className="font-medium hover:underline">
                          {title}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{feedbackExcerpt(item.content, 90)}</p>
                      </TableCell>
                      <TableCell><FeedbackStatusBadge item={item} /></TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">{item.publishedAt ? formatDateTime(item.publishedAt) : "—"}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">{formatDateTime(item.updatedAt)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <FeedbackActions feedbackId={item.id} patientId={patientId} title={title} item={item} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <ul className="grid gap-2 lg:hidden" aria-label="Feedbacks">
            {feedbacks.map((item) => {
              const title = feedbackDisplayTitle(item, formatInstantDate);
              return (
                <li key={item.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/dashboard/pacientes/${patientId}/feedbacks/${item.id}/editar`} className="font-medium break-words hover:underline">
                        {title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatInstantDate(item.createdAt)}{item.referenceDate ? ` · ref. ${formatCalendarDate(item.referenceDate)}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <FeedbackStatusBadge item={item} />
                      <FeedbackActions feedbackId={item.id} patientId={patientId} title={title} item={item} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground break-words">{feedbackExcerpt(item.content)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.publishedAt ? `Disponibilizado em ${formatDateTime(item.publishedAt)}` : "Ainda não disponibilizado"}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">Feedback é comunicação sua para o paciente — não é chat. Notas internas/clínicas não entram aqui.</p>
    </div>
  );
}
