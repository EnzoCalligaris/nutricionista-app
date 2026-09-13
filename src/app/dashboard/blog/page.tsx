import { Newspaper } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function DashboardBlogPage() {
  return (
    <ComingSoon
      icon={Newspaper}
      title="Blog"
      description="CMS próprio para artigos do site público: rascunho, publicado, arquivado, SEO e Open Graph."
      phase="Fase 14"
    />
  );
}
