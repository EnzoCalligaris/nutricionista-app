import { feedbackDisplayTitle } from "@/domain/patient-content/feedbacks";
import type { FeedbackDetail } from "@/data/feedbacks";
import { formatCalendarDate, formatDateTime, formatInstantDate } from "@/lib/dates";

/**
 * Card de feedback no portal (prompt Fase 10 §29/§73): data, título,
 * mensagem completa em largura de leitura confortável, autoria genérica
 * ("Seu nutricionista" — o portal não expõe identificadores internos).
 * Texto puro (`whitespace-pre-line`), sem HTML.
 */
export function FeedbackCard({ item, as: Tag = "li" }: { item: FeedbackDetail; as?: "li" | "article" }) {
  return (
    <Tag className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <header className="space-y-1">
        <h2 className="font-heading text-lg font-medium break-words">{feedbackDisplayTitle(item, formatInstantDate)}</h2>
        <p className="text-xs text-muted-foreground">
          Seu nutricionista · {formatDateTime(item.publishedAt ?? item.createdAt)}
          {item.referenceDate ? ` · referente a ${formatCalendarDate(item.referenceDate)}` : ""}
        </p>
      </header>
      <p className="mt-3 max-w-prose whitespace-pre-line text-[0.95rem] leading-relaxed break-words">{item.content}</p>
    </Tag>
  );
}
