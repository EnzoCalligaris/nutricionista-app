"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cancelPaymentAction } from "@/actions/finance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PaymentStatusBadge } from "@/components/finance/badges";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/definitions";
import { formatBRL } from "@/lib/money";
import { formatInstantDate } from "@/lib/dates";
import type { PaymentListItem } from "@/data/payments";

function describe(payment: PaymentListItem): string {
  if (payment.installmentNumber != null) return `${payment.planName ?? "Contrato"} · parcela ${payment.installmentNumber}`;
  if (payment.appointmentId) return "Consulta";
  if (payment.planName) return payment.planName;
  return "Pagamento avulso";
}

/** Pagamentos do paciente com reversão (prompt Fase 7 §31): nada é apagado. */
export function PaymentsList({ payments }: { payments: PaymentListItem[] }) {
  const router = useRouter();
  const idPrefix = useId();
  const [pending, setPending] = useState<PaymentListItem | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (payments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="hidden pl-4 sm:table-cell">Data</TableHead>
              <TableHead scope="col" className="pl-4 sm:pl-2">Referência</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Método</TableHead>
              <TableHead scope="col" className="text-right">Valor</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Status</TableHead>
              <TableHead scope="col" className="w-12 pr-3 text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="hidden pl-4 whitespace-nowrap sm:table-cell">{formatInstantDate(payment.paidAt ?? payment.createdAt)}</TableCell>
                <TableCell className="max-w-44 pl-4 sm:max-w-none sm:pl-2">
                  <span className="block truncate">{describe(payment)}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                    {formatInstantDate(payment.paidAt ?? payment.createdAt)}
                    <PaymentStatusBadge status={payment.status} />
                  </span>
                  {payment.cancellationReason ? <span className="block text-xs text-muted-foreground">{payment.cancellationReason}</span> : null}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{PAYMENT_METHOD_LABEL[payment.method]}</TableCell>
                <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{formatBRL(payment.amountCents)}</TableCell>
                <TableCell className="hidden sm:table-cell"><PaymentStatusBadge status={payment.status} /></TableCell>
                <TableCell className="pr-3 text-right">
                  {payment.status === "CONFIRMED" ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Estornar pagamento de ${formatBRL(payment.amountCents)}`} onClick={() => setPending(payment)}>
                      <Undo2 />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar o pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? `${formatBRL(pending.amountCents)} · ${describe(pending)}` : ""}. O pagamento fica no histórico como estornado, o lançamento de
              receita é cancelado e a parcela volta a ficar em aberto. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-reason`}>Motivo (opcional)</Label>
            <Textarea id={`${idPrefix}-reason`} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!pending) return;
                const id = pending.id;
                startTransition(async () => {
                  const result = await cancelPaymentAction(id, reason);
                  if (result.ok) {
                    toast.success("Pagamento estornado.");
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                  setPending(null);
                  setReason("");
                });
              }}
            >
              {isPending ? "Estornando..." : "Estornar pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
