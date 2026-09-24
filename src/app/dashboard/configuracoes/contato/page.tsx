import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsBreadcrumb } from "@/components/settings/settings-breadcrumb";
import { SettingsGroupForm } from "@/components/settings/settings-group-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getSiteSettingsSnapshot } from "@/data/site-settings";
import { settingsOfGroup } from "@/domain/site-settings/registry";
import { toFieldValues } from "@/domain/site-settings/form-values";
import { formatAddressLine } from "@/domain/site-settings/resolve";

export const metadata: Metadata = { title: "Contato e localização" };
export const dynamic = "force-dynamic";

/**
 * Contato (prompt Fase 14 §4) e endereço (§5/§6). Telefone é normalizado para
 * E.164 pela mesma regra da Fase 12; Instagram e LinkedIn passam pelo
 * validador de URL da Fase 10 (§57/§58).
 */
export default async function ConfiguracoesContatoPage() {
  await requireNutritionist();
  const snapshot = await getSiteSettingsSnapshot();
  const contactFields = settingsOfGroup("contact");
  const addressFields = settingsOfGroup("address");
  const addressLine = formatAddressLine(snapshot.address);

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb current="Contato e localização" />
        <h1 className="font-heading text-2xl font-medium">Contato e localização</h1>
        <p className="text-sm text-muted-foreground">
          Canais de contato e endereço do atendimento presencial. Nenhum valor é preenchido por suposição.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Canais de contato</CardTitle>
          <CardDescription>
            Telefone e WhatsApp são gravados no formato internacional. O site exibe formatado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsGroupForm
            group="contact"
            definitions={contactFields}
            values={toFieldValues(contactFields, snapshot.raw)}
            submitLabel="Salvar contato"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Endereço do consultório</CardTitle>
          <CardDescription>
            Com &ldquo;mostrar endereço&rdquo; desligado, o endereço fica só no dashboard — o visitante anônimo não
            consegue lê-lo nem pela API, e os e-mails não o incluem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {addressLine ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Como fica em uma linha: </span>
              {addressLine}
              <span className="ml-2 text-xs text-muted-foreground">
                ({snapshot.address.showPublic ? "visível no site" : "apenas interno"})
              </span>
            </p>
          ) : null}
          <SettingsGroupForm
            group="address"
            definitions={addressFields}
            values={toFieldValues(addressFields, snapshot.raw)}
            submitLabel="Salvar endereço"
          />
        </CardContent>
      </Card>
    </div>
  );
}
