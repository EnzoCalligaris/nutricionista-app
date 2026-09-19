import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/shared/external-link";
import { MaterialTypeBadge } from "@/components/materials/material-badges";
import { formatFileSize, materialPatientAction } from "@/domain/patient-content/materials";
import type { PatientAssignment } from "@/data/materials";
import { formatInstantDate } from "@/lib/dates";

/**
 * Card de material no portal (prompt Fase 10 §49/§74): tipo, título,
 * descrição curta, data disponibilizada e a ação conforme o tipo — "Abrir"
 * (link externo, nova aba) ou "Baixar" (route handler server-side com URL
 * assinada). Sem preview pesada.
 */
export function MaterialCard({ item }: { item: PatientAssignment }) {
  const { material } = item;
  const action = materialPatientAction(material);
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium break-words">{material.title}</h2>
          <p className="text-xs text-muted-foreground">
            Disponibilizado em {formatInstantDate(item.assignedAt)}
            {material.fileSizeBytes ? ` · ${formatFileSize(material.fileSizeBytes)}` : ""}
          </p>
        </div>
        <MaterialTypeBadge item={material} />
      </div>
      {material.description ? <p className="text-sm text-muted-foreground break-words">{material.description}</p> : null}
      <div className="mt-auto">
        {action === "OPEN" && material.externalUrl ? (
          <Button asChild size="sm" variant="outline">
            <ExternalLink href={material.externalUrl} className="no-underline">
              Abrir
            </ExternalLink>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href={`/paciente/materiais/${material.id}/arquivo`} target="_blank" rel="noopener">
              <Download data-icon="inline-start" />
              Baixar{material.mimeType === "application/pdf" ? " PDF" : ""}
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
