import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsBreadcrumb } from "@/components/settings/settings-breadcrumb";
import { SettingsGroupForm } from "@/components/settings/settings-group-form";
import { SiteAssetField } from "@/components/settings/site-asset-field";
import { requireNutritionist } from "@/lib/auth/session";
import { getSiteSettingsSnapshot } from "@/data/site-settings";
import { settingsOfGroup } from "@/domain/site-settings/registry";
import { toFieldValues } from "@/domain/site-settings/form-values";
import { siteAssetPublicUrl } from "@/services/site-settings";

export const metadata: Metadata = { title: "Perfil profissional" };
export const dynamic = "force-dynamic";

/**
 * Perfil profissional (prompt Fase 14 §2/§3). Nada é pré-preenchido: o CRN
 * continua PENDENTE até Enzo informar, e o sistema aceita cadastrá-lo depois
 * sem exigir valor fictício (§3).
 */
export default async function ConfiguracoesPerfilPage() {
  await requireNutritionist();
  const snapshot = await getSiteSettingsSnapshot();
  const definitions = settingsOfGroup("professional");
  const textFields = definitions.filter((definition) => definition.kind !== "asset");

  const [photoUrl, logoUrl] = await Promise.all([
    siteAssetPublicUrl(snapshot.professional.photoPath),
    siteAssetPublicUrl(snapshot.professional.logoPath),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb current="Perfil profissional" />
        <h1 className="font-heading text-2xl font-medium">Perfil profissional</h1>
        <p className="text-sm text-muted-foreground">
          O que o site mostra sobre você. Campo vazio simplesmente não aparece em nenhuma página.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Dados profissionais</CardTitle>
          <CardDescription>
            O CRN fica em branco enquanto não for informado — nenhum número é preenchido por suposição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsGroupForm
            group="professional"
            definitions={textFields}
            values={toFieldValues(textFields, snapshot.raw)}
            submitLabel="Salvar perfil"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Imagens</CardTitle>
          <CardDescription>
            Assets institucionais, guardados separados de qualquer foto de paciente. WEBP, PNG ou JPG de até 5 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SiteAssetField
            settingKey="professional.photo_path"
            label="Foto profissional"
            help="Usada nas páginas Sobre e na home quando configurada."
            currentUrl={photoUrl}
          />
          <SiteAssetField
            settingKey="professional.logo_path"
            label="Logo"
            help="Opcional. O monograma atual continua sendo usado quando não há logo configurado."
            currentUrl={logoUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
