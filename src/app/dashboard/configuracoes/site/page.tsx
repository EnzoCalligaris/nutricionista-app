import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsBreadcrumb } from "@/components/settings/settings-breadcrumb";
import { SettingsGroupForm } from "@/components/settings/settings-group-form";
import { SiteAssetField } from "@/components/settings/site-asset-field";
import { requireNutritionist } from "@/lib/auth/session";
import { getSiteSettingsSnapshot } from "@/data/site-settings";
import { settingsOfGroup } from "@/domain/site-settings/registry";
import { toFieldValues } from "@/domain/site-settings/form-values";
import { customizedContentFields, siteContentKey } from "@/domain/site-settings/resolve";
import { SITE_CONTENT_FALLBACK, SITE_CONTENT_FALLBACK_VERSION } from "@/content/site-content";
import { siteAssetPublicUrl } from "@/services/site-settings";

export const metadata: Metadata = { title: "Site público" };
export const dynamic = "force-dynamic";

const CONTENT_LABELS: Record<keyof typeof SITE_CONTENT_FALLBACK, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  ctaLabel: "Texto do botão principal",
  heroNote: "Nota abaixo dos botões",
  methodIntro: "Texto do Método EM",
  mission: "Missão",
  aboutIntro: "Sobre — introdução",
  aboutPhilosophy: "Sobre — filosofia",
};

/**
 * Conteúdo público e SEO (prompt Fase 14 §9–§12, §41). NÃO é um CMS genérico
 * (§10): são os campos específicos do produto. Campo em branco = o site usa o
 * texto atual (fallback versionado); depois de salvar, o banco é a fonte.
 */
export default async function ConfiguracoesSitePage() {
  await requireNutritionist();
  const snapshot = await getSiteSettingsSnapshot();
  const homeFields = settingsOfGroup("home");
  const seoFields = settingsOfGroup("seo").filter((definition) => definition.kind !== "asset");
  const customized = new Set(customizedContentFields(snapshot.raw));
  const ogImageUrl = await siteAssetPublicUrl(snapshot.seo.ogImagePath);

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb current="Site público" />
        <h1 className="font-heading text-2xl font-medium">Site público</h1>
        <p className="text-sm text-muted-foreground">
          Os textos principais da home e de Sobre, mais o SEO padrão. Deixar em branco mantém o texto atual do site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Textos em uso hoje</CardTitle>
          <CardDescription>
            Referência do que está no ar agora (versão de fallback <code>{SITE_CONTENT_FALLBACK_VERSION}</code>). Só o
            que você salvar abaixo substitui esses textos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(CONTENT_LABELS) as (keyof typeof SITE_CONTENT_FALLBACK)[]).map((field) => (
              <div key={field} className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {CONTENT_LABELS[field]}
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] font-normal normal-case tracking-normal">
                    {customized.has(field) ? "personalizado" : "texto atual"}
                  </span>
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">
                  {(snapshot.content[field] || SITE_CONTENT_FALLBACK[field]).slice(0, 220)}
                  {(snapshot.content[field] || "").length > 220 ? "…" : ""}
                </dd>
                <dd className="mt-1 text-[0.7rem] text-muted-foreground">
                  chave: <code>{siteContentKey(field)}</code>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Conteúdo da home e de Sobre</CardTitle>
          <CardDescription>Campo em branco volta para o texto atual do site.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsGroupForm
            group="home"
            definitions={homeFields}
            values={toFieldValues(homeFields, snapshot.raw)}
            submitLabel="Salvar conteúdo"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">SEO padrão</CardTitle>
          <CardDescription>
            Título e descrição usados quando a página não define os próprios. Sem campo de palavras-chave: limites
            curtos e um texto só, de propósito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsGroupForm
            group="seo"
            definitions={seoFields}
            values={toFieldValues(seoFields, snapshot.raw)}
            submitLabel="Salvar SEO"
          />
          <SiteAssetField
            settingKey="seo.og_image_path"
            label="Imagem de compartilhamento (Open Graph)"
            help="Aparece quando um link do site é compartilhado. 1200×630 px funciona bem."
            currentUrl={ogImageUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
