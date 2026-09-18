import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL } from "@/lib/money";
import { formatInstantDate } from "@/lib/dates";
import type { PatientModuleCounts, PatientPaymentRow } from "@/data/patients";
import type { PatientSectionId } from "@/components/patients/patient-section-nav";

const PAYMENT_METHOD_LABEL: Record<PatientPaymentRow["method"], string> = {
  PIX: "Pix",
  CARD: "Cartão",
  CASH: "Dinheiro",
  BANK_TRANSFER: "Transferência",
  OTHER: "Outro",
};

const PAYMENT_STATUS_LABEL: Record<PatientPaymentRow["status"], string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  FAILED: "Falhou",
  REFUNDED: "Estornado",
};

function summaryFor(section: PatientSectionId, counts: PatientModuleCounts): { count: number; noun: [string, string]; phase: string } | null {
  switch (section) {
    case "consultas":
      return { count: counts.appointments, noun: ["consulta registrada", "consultas registradas"], phase: "Fase 6" };
    case "cardapio":
      return { count: counts.mealPlans, noun: ["cardápio", "cardápios"], phase: "Fase 8" };
    case "avaliacoes":
      return { count: counts.assessments, noun: ["avaliação", "avaliações"], phase: "Fase 9" };
    case "comentarios":
      return { count: counts.appointmentNotes, noun: ["comentário", "comentários"], phase: "Fase 6" };
    case "feedbacks":
      return { count: counts.feedbacks, noun: ["feedback", "feedbacks"], phase: "Fase 10" };
    case "materiais":
      return { count: counts.materials, noun: ["material atribuído", "materiais atribuídos"], phase: "Fase 10" };
    default:
      return null;
  }
}

/**
 * Seções que pertencem a fases futuras (prompt Fase 5 §22): mostram um
 * resumo REAL simples (contagem do banco) quando existe dado, e o estado
 * "Disponível em uma próxima etapa." — sem implementar o módulo.
 */
export function PatientPlaceholderSection({ section, counts }: { section: PatientSectionId; counts: PatientModuleCounts }) {
  const summary = summaryFor(section, counts);
  if (!summary) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-1 py-8 text-center">
        <p className="font-medium">
          {summary.count === 0
            ? `Nenhum registro ainda.`
            : `${summary.count} ${summary.count === 1 ? summary.noun[0] : summary.noun[1]}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          Disponível em uma próxima etapa ({summary.phase}).
        </p>
      </CardContent>
    </Card>
  );
}

/** Financeiro do paciente nesta fase: só leitura dos pagamentos existentes (§40). */
export function PatientPaymentsSection({ payments, planNameByContract }: { payments: PatientPaymentRow[]; planNameByContract: Map<string, string> }) {
  if (payments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-1 py-8 text-center">
          <p className="font-medium">Nenhum pagamento registrado.</p>
          <p className="text-sm text-muted-foreground">
            O registro manual de pagamentos e o financeiro completo chegam na Fase 7.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pagamentos já registrados. O lançamento manual de novos pagamentos chega na Fase 7.
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="pl-4">
                Data
              </TableHead>
              <TableHead scope="col">Contrato</TableHead>
              <TableHead scope="col">Método</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="pr-4 text-right">
                Valor
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="pl-4">{formatInstantDate(payment.paid_at ?? payment.created_at)}</TableCell>
                <TableCell>
                  {payment.contract_id ? (planNameByContract.get(payment.contract_id) ?? "—") : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{PAYMENT_METHOD_LABEL[payment.method]}</TableCell>
                <TableCell>{PAYMENT_STATUS_LABEL[payment.status]}</TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{formatBRL(payment.amount_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
