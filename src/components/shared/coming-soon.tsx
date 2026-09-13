import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Placeholder de conteúdo para telas cujo shell/layout já existe mas cujo
 * módulo funcional pertence a uma fase futura (ver docs/ROADMAP.md).
 *
 * O título usa <h1> (em vez do CardTitle padrão do shadcn, que renderiza uma
 * <div>) porque nestas páginas-tronco ele é o único heading da página —
 * necessário para navegação por leitor de tela (seção 16 da Fase 1).
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-xl font-medium">{title}</h1>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Módulo previsto para a <span className="font-medium">{phase}</span>{" "}
          — este layout existe apenas para validar a estrutura (Fase 1).
        </p>
      </CardContent>
    </Card>
  );
}
