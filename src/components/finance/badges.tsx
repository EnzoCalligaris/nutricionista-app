import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FINANCIAL_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  TRANSACTION_ORIGIN_LABEL,
  TRANSACTION_STATUS_LABEL,
  type FinancialType,
  type PaymentStatus,
  type TransactionOrigin,
  type TransactionUiStatus,
} from "@/domain/finance/definitions";
import { INSTALLMENT_UI_STATUS_LABEL, type InstallmentUiStatus } from "@/domain/finance/installments";

// Sempre badge + texto: cor nunca é o único sinal (prompt Fase 7 §55/§77).

const TX_STATUS_CLASS: Record<TransactionUiStatus, string> = {
  PAID: "bg-success/10 text-success",
  PENDING: "bg-warning/15 text-warning-foreground",
  OVERDUE: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function TransactionStatusBadge({ status }: { status: TransactionUiStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", TX_STATUS_CLASS[status])}>
      {TRANSACTION_STATUS_LABEL[status]}
    </Badge>
  );
}

export function FinancialTypeBadge({ type }: { type: FinancialType }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", type === "INCOME" ? "bg-success/10 text-success" : "bg-muted text-foreground")}>
      {FINANCIAL_TYPE_LABEL[type]}
    </Badge>
  );
}

export function OriginText({ origin }: { origin: TransactionOrigin }) {
  return <span className="text-muted-foreground">{TRANSACTION_ORIGIN_LABEL[origin]}</span>;
}

const INSTALLMENT_CLASS: Record<InstallmentUiStatus, string> = {
  PENDING: "bg-warning/15 text-warning-foreground",
  PARTIAL: "bg-primary/10 text-primary",
  PAID: "bg-success/10 text-success",
  OVERDUE: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function InstallmentBalanceBadge({ status }: { status: InstallmentUiStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", INSTALLMENT_CLASS[status])}>
      {INSTALLMENT_UI_STATUS_LABEL[status]}
    </Badge>
  );
}

const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  PENDING: "bg-warning/15 text-warning-foreground",
  CONFIRMED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-muted text-muted-foreground",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", PAYMENT_CLASS[status])}>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
