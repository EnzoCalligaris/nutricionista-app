import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsBreadcrumb } from "@/components/settings/settings-breadcrumb";
import { SettingsGroupForm } from "@/components/settings/settings-group-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getSiteSettingsSnapshot } from "@/data/site-settings";
import { settingsOfGroup } from "@/domain/site-settings/registry";
import { toFieldValues } from "@/domain/site-settings/form-values";

export const metadata: Metadata = { title: "Atendimento online" };
export const dynamic = "force-dynamic";

/**
 * Consulta online (prompt Fase 14 §7). NENHUM exemplo entra como default
 * real: a plataforma é texto livre configurável e continua vazia até Enzo
 * definir. As instruções e o link base são privados — só o paciente recebe
 * (portal/e-mail); o visitante anônimo nem consegue ler essas chaves.
 */
export default async function ConfiguracoesAtendimentoPage() {
  await requireNutritionist();
  const snapshot = await getSiteSettingsSnapshot();
  const definitions = settingsOfGroup("attendance");

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb current="Atendimento online" />
        <h1 className="font-heading text-2xl font-medium">Atendimento online</h1>
        <p className="text-sm text-muted-foreground">
          Como a consulta online acontece. Enquanto a plataforma não for definida, o site fala de &ldquo;atendimento
          online&rdquo; sem citar ferramenta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Plataforma e instruções</CardTitle>
          <CardDescription>
            Só o nome da plataforma é público. Instruções e link base ficam restritos ao paciente autenticado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsGroupForm
            group="attendance"
            definitions={definitions}
            values={toFieldValues(definitions, snapshot.raw)}
            submitLabel="Salvar atendimento"
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-heading text-base">Regras da agenda</CardTitle>
          <CardDescription>
            Duração, granularidade, antecedências, horizonte e modalidades ficam em Agenda → Configurações. A
            periodicidade das consultas por plano continua PENDENTE DE DEFINIÇÃO e não é inferida pela duração do
            plano.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
