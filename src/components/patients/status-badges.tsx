import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PATIENT_STATUS_DESCRIPTION,
  PATIENT_STATUS_LABEL,
  type PatientUiStatus,
} from "@/domain/patients/status";
import {
  PORTAL_ACCESS_DESCRIPTION,
  PORTAL_ACCESS_LABEL,
  type PortalAccessStatus,
} from "@/domain/patients/portal-access";
import {
  CONTRACT_STATUS_LABEL,
  INSTALLMENT_STATUS_LABEL,
  type ContractStatus,
  type InstallmentStatus,
} from "@/domain/contracts/status";

// Badges de status com cores semânticas do design system (success/warning/
// destructive/muted) — texto sempre presente, cor nunca é o único sinal.

const PATIENT_STATUS_CLASS: Record<PatientUiStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  NO_CONTRACT: "bg-warning/15 text-warning-foreground",
  INACTIVE: "bg-muted text-muted-foreground",
};

export function PatientStatusBadge({ status, className }: { status: PatientUiStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", PATIENT_STATUS_CLASS[status], className)}
      title={PATIENT_STATUS_DESCRIPTION[status]}
    >
      {PATIENT_STATUS_LABEL[status]}
    </Badge>
  );
}

const PORTAL_ACCESS_CLASS: Record<PortalAccessStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  INVITE_PENDING: "bg-warning/15 text-warning-foreground",
  NOT_ACTIVATED: "bg-muted text-muted-foreground",
  NO_ACCOUNT: "bg-muted text-muted-foreground",
};

export function PortalAccessBadge({ status, prefix }: { status: PortalAccessStatus; prefix?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", PORTAL_ACCESS_CLASS[status])}
      title={PORTAL_ACCESS_DESCRIPTION[status]}
    >
      {prefix}
      {PORTAL_ACCESS_LABEL[status]}
    </Badge>
  );
}

const CONTRACT_STATUS_CLASS: Record<ContractStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", CONTRACT_STATUS_CLASS[status])}>
      {CONTRACT_STATUS_LABEL[status]}
    </Badge>
  );
}

const INSTALLMENT_STATUS_CLASS: Record<InstallmentStatus, string> = {
  PENDING: "bg-warning/15 text-warning-foreground",
  PAID: "bg-success/10 text-success",
  OVERDUE: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", INSTALLMENT_STATUS_CLASS[status])}>
      {INSTALLMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
