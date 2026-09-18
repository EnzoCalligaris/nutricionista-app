import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/shared/container";
import { ResetPasswordGate } from "@/components/auth/reset-password-gate";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Redefinir senha — Método EM",
};

export default async function ResetPasswordPage() {
  // O link de e-mail (convite/recuperação) chega aqui com o token no
  // FRAGMENTO da URL, não numa query string server-visível — só o client
  // consegue lê-lo (ver ResetPasswordGate). Aqui só checamos se já existe
  // sessão via cookie (ex.: usuário recarregou a página depois que o
  // client já processou o token uma vez).
  const user = await getCurrentUser();

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Redefinir senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResetPasswordGate initialHasSession={Boolean(user)} />
        </CardContent>
      </Card>
    </Container>
  );
}
