import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";

// Conteúdo público é revalidado periodicamente (ISR): as queries usam o
// cliente anônimo sem cookies (src/lib/supabase/public.ts), então as páginas
// podem ser servidas do cache e regeneradas em background. Rotas que usam
// cookies()/searchParams (login, redefinir-senha) continuam dinâmicas.
export const revalidate = 600;

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
