import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/shared/container";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Entrar — Método EM",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Quem já está autenticado não precisa ver o formulário (prompt Fase 4
  // §55) — vai direto para a própria área.
  const profile = await getCurrentProfile();
  if (profile) {
    // Fase 6: `?next=` também vale para quem já está logado (ex.: /agendar
    // -> /login?next=/paciente/agendar). Só dentro da área do próprio
    // papel — um nutricionista nunca é mandado ao portal do paciente.
    const home = profile.role === "NUTRITIONIST" ? "/dashboard" : "/paciente";
    const next = sanitizeRedirectPath(params.next, home);
    redirect(next === home || next.startsWith(`${home}/`) ? next : home);
  }

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Entrar</CardTitle>
          <CardDescription>Acesse o dashboard ou o portal do paciente.</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <p role="alert" className="mb-4 text-sm text-destructive">
              Não foi possível concluir a autenticação. Tente novamente.
            </p>
          ) : null}
          <LoginForm next={params.next} />
        </CardContent>
      </Card>
    </Container>
  );
}
