import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/shared/container";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar — Método EM",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

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
