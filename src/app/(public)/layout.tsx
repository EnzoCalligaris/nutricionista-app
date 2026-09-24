import type { Metadata } from "next";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { siteConfig } from "@/config/site";
import { getSeoDefaults, publicSiteAssetUrl } from "@/data/site-settings";

// Conteúdo público é revalidado periodicamente (ISR): as queries usam o
// cliente anônimo sem cookies (src/lib/supabase/public.ts), então as páginas
// podem ser servidas do cache e regeneradas em background. Rotas que usam
// cookies()/searchParams (login, redefinir-senha) continuam dinâmicas.
// Toda mutação administrativa revalida explicitamente estes caminhos
// (src/lib/revalidate.ts), então uma mudança no dashboard não espera os 10
// minutos (prompt Fase 14 §49/§50).
export const revalidate = 600;

/**
 * Título, descrição e imagem de compartilhamento PADRÃO do site (§41). Quando
 * não configurados, continuam os da Fase 4 — nada é inventado aqui.
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoDefaults();
  const ogImageUrl = publicSiteAssetUrl(seo.ogImagePath);
  const title = seo.title ?? siteConfig.name;
  const description = seo.description ?? siteConfig.description;
  const image = ogImageUrl ?? "/images/og-default.jpg";

  return {
    title: { default: title, template: `%s · ${siteConfig.name}` },
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: siteConfig.name,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: siteConfig.fullName }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
