import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarX, Clock, ShieldAlert } from "lucide-react";
import { confirmByTokenAction, type TokenConfirmState } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/shared/container";
import { isWellFormedToken } from "@/domain/notifications/tokens";

export const metadata: Metadata = {
  title: "Confirmar presença — Método EM",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATES: Record<TokenConfirmState, { title: string; description: string; icon: typeof CalendarCheck; tone: "ok" | "warn" }> = {
  confirmed: { title: "Presença confirmada", description: "Obrigado! Sua consulta está confirmada. Até lá.", icon: CalendarCheck, tone: "ok" },
  already: { title: "Consulta já confirmada", description: "Esta consulta já estava confirmada. Nada mais a fazer.", icon: CalendarCheck, tone: "ok" },
  expired: { title: "Este link expirou", description: "Este link expirou. Entre no portal para continuar.", icon: Clock, tone: "warn" },
  used: { title: "Link já utilizado", description: "Este link já foi usado. Para ver o status da consulta, entre no portal.", icon: ShieldAlert, tone: "warn" },
  invalid: { title: "Link inválido", description: "Não reconhecemos este link. Entre no portal para continuar.", icon: ShieldAlert, tone: "warn" },
  unavailable: { title: "Consulta indisponível", description: "Esta consulta não pode mais ser confirmada (pode ter sido cancelada ou reagendada). Veja o status no portal.", icon: CalendarX, tone: "warn" },
  limited: { title: "Muitas tentativas", description: "Aguarde alguns minutos e tente de novo, ou entre no portal.", icon: ShieldAlert, tone: "warn" },
};

function isState(value: string | undefined): value is TokenConfirmState {
  return value !== undefined && value in STATES;
}

/**
 * Página pública do link "Confirmar presença" (prompt Fase 12 §20/§48/§93–§95).
 * O GET NÃO consome o token (scanners de e-mail seguem links): a confirmação
 * é um POST explícito do paciente; o token é de uso único e expira. Nenhum
 * dado da consulta é exibido antes da confirmação — o link não é autorização
 * para ler nada.
 */
export default async function ConfirmarPresencaPage({ params, searchParams }: PageProps<"/confirmar/[token]">) {
  const { token } = await params;
  const { s } = await searchParams;
  const stateParam = Array.isArray(s) ? s[0] : s;
  const state: TokenConfirmState | null = isState(stateParam) ? stateParam : isWellFormedToken(token) ? null : "invalid";

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <Card className="w-full max-w-md">
        {state ? (
          <>
            <CardHeader className="items-center text-center">
              {(() => {
                const Icon = STATES[state].icon;
                return <Icon className={state === "confirmed" || state === "already" ? "mx-auto size-10 text-primary" : "mx-auto size-10 text-muted-foreground"} aria-hidden="true" />;
              })()}
              <CardTitle className="font-heading text-2xl">{STATES[state].title}</CardTitle>
              <CardDescription>{STATES[state].description}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/paciente/consultas">Entrar no portal</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="items-center text-center">
              <CalendarCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
              <CardTitle className="font-heading text-2xl">Confirmar presença</CardTitle>
              <CardDescription>Toque no botão abaixo para confirmar que você comparecerá à consulta. Se precisar reagendar, use o portal.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <form action={confirmByTokenAction.bind(null, token)}>
                <Button type="submit" size="lg">
                  <CalendarCheck data-icon="inline-start" />
                  Confirmar presença
                </Button>
              </form>
              <Button asChild variant="link" size="sm">
                <Link href="/paciente/consultas">Preciso reagendar</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </Container>
  );
}
