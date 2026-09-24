import { Badge } from "@/components/ui/badge";

const LABELS = { DRAFT: "Rascunho", PUBLISHED: "Publicado", ARCHIVED: "Arquivado" } as const;
const VARIANTS = { DRAFT: "outline", PUBLISHED: "default", ARCHIVED: "secondary" } as const;

export function PostStatusBadge({ status }: { status: keyof typeof LABELS }) {
  return (
    <Badge variant={VARIANTS[status]} className="font-normal">
      {LABELS[status]}
    </Badge>
  );
}
