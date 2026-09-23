import { Badge } from "@/components/ui/badge";
import { CHARGE_STATUS_LABEL, ONLINE_METHOD_LABEL, type ChargeStatus, type OnlinePaymentMethod } from "@/domain/payments/charges";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<ChargeStatus, string> = {
  CREATED: "bg-muted text-muted-foreground",
  PENDING: "bg-warning/15 text-warning-foreground",
  PAID: "bg-success/10 text-success",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/10 text-destructive",
};

/** Status da COBRANÇA (≠ pagamento confirmado — §76). */
export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASS[status])} data-charge-status={status}>
      {CHARGE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ChargeMethodBadge({ method }: { method: OnlinePaymentMethod }) {
  return <Badge variant="secondary">{ONLINE_METHOD_LABEL[method]}</Badge>;
}

/** Aviso permanente enquanto o gateway for simulado (§4/§65/§67). */
export function SimulatedEnvironmentNotice({ environment, className }: { environment: string; className?: string }) {
  if (environment === "production") return null;
  const label = environment === "sandbox" ? "Ambiente de teste (sandbox)" : "Ambiente de pagamentos simulado";
  const description =
    environment === "sandbox"
      ? "As cobranças usam as credenciais de teste do provedor — nenhum valor real é movimentado."
      : "Nenhuma cobrança real é gerada e nenhum valor é movimentado. Este é um ambiente de demonstração.";
  return (
    <div className={cn("rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground", className)} role="note">
      <span className="font-medium">{label}.</span> {description}
    </div>
  );
}
