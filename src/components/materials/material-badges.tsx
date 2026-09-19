import { Archive, CheckCircle2, FileText, Image as ImageIcon, Link2, Paperclip, Slash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ASSIGNMENT_PRESENTATION_LABEL,
  MATERIAL_STATUS_LABEL,
  assignmentPresentation,
  materialStatus,
  materialTypeLabel,
  type AssignmentLike,
  type MaterialLike,
} from "@/domain/patient-content/materials";

/** Tipo do material com ícone + texto ("PDF", "Imagem", "Link"). */
export function MaterialTypeBadge({ item }: { item: Pick<MaterialLike, "kind" | "mimeType"> }) {
  const label = materialTypeLabel(item);
  const Icon = item.kind === "LINK" ? Link2 : item.mimeType === "application/pdf" ? FileText : item.mimeType?.startsWith("image/") ? ImageIcon : Paperclip;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function MaterialStatusBadge({ item }: { item: Pick<MaterialLike, "archivedAt"> }) {
  const status = materialStatus(item);
  return status === "ARCHIVED" ? (
    <Badge variant="outline" className="gap-1 border-transparent bg-muted text-muted-foreground">
      <Archive className="size-3" aria-hidden="true" />
      {MATERIAL_STATUS_LABEL.ARCHIVED}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-transparent bg-success/10 text-success">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {MATERIAL_STATUS_LABEL.ACTIVE}
    </Badge>
  );
}

/** Estado da atribuição no perfil do paciente (§42): ativa, acesso removido, material arquivado. */
export function AssignmentStatusBadge({ item }: { item: AssignmentLike }) {
  const presentation = assignmentPresentation(item);
  if (presentation === "ACTIVE") {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-success/10 text-success">
        <CheckCircle2 className="size-3" aria-hidden="true" />
        {ASSIGNMENT_PRESENTATION_LABEL.ACTIVE}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-transparent bg-muted text-muted-foreground">
      {presentation === "REVOKED" ? <Slash className="size-3" aria-hidden="true" /> : <Archive className="size-3" aria-hidden="true" />}
      {ASSIGNMENT_PRESENTATION_LABEL[presentation]}
    </Badge>
  );
}
