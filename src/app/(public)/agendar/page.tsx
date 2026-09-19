import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/section";
import { getPublicPlans } from "@/data/plans";
import { getContactInfo } from "@/data/site-settings";
import { hasAnyContactChannel, whatsappHref } from "@/domain/site-settings/contact";

export const metadata: Metadata = {
  title: "Agendar pré-consulta",
  description:
    "Comece o acompanhamento com uma pré-consulta gratuita com Enzo Mangili. Pacientes agendam online pelo portal.",
  alternates: { canonical: "/agendar" },
};

/**
 * Porta de entrada do agendamento (prompt Fase 4 §30 / Fase 6 §43). Sem
 * calendário para visitante anônimo: quem ainda não é paciente segue pelos
 * canais de contato; quem já é paciente entra e cai direto no fluxo do
 * portal (`/login?next=/paciente/agendar` — `next` sanitizado no login;
 * nutricionista logado nunca é levado ao portal do paciente, o proxy o
 * manda ao dashboard). `?plano=` só personaliza o texto (vem de /planos).
 */
export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const [{ plano }, plans, contact] = await Promise.all([searchParams, getPublicPlans(), getContactInfo()]);
  const selectedPlan = plano && plans.ok ? plans.data.find((plan) => plan.code.toLowerCase() === plano.toLowerCase()) : undefined;
  const showChannels = hasAnyContactChannel(contact);

  return (
    <Section size="compact">
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          as="h1"
          eyebrow="Agendar"
          title="Comece pela pré-consulta gratuita."
          lead={
            selectedPlan
              ? `Você se interessou pelo ${selectedPlan.name}. O primeiro passo é o mesmo para todos os formatos: uma conversa inicial, sem custo, para entender o seu momento.`
              : "Uma conversa inicial, sem custo, para entender o seu momento e os seus objetivos — e definir juntos o melhor formato de acompanhamento."
          }
        />

        <ol className="mt-10 space-y-4 text-base leading-relaxed">
          <li className="flex gap-4">
            <span className="font-heading text-xl text-primary/60">1</span>
            <p>Você entra em contato e agenda a pré-consulta gratuita.</p>
          </li>
          <li className="flex gap-4">
            <span className="font-heading text-xl text-primary/60">2</span>
            <p>Na conversa, alinhamos objetivos, rotina e o plano mais adequado.</p>
          </li>
          <li className="flex gap-4">
            <span className="font-heading text-xl text-primary/60">3</span>
            <p>Você recebe o acesso ao portal do paciente e o formulário de anamnese — e a consulta é marcada.</p>
          </li>
        </ol>

        <div className="mt-10 rounded-[1.5rem] border border-border bg-card p-6 sm:p-8">
          <p className="font-heading text-xl font-medium">Como agendar hoje</p>
          {showChannels ? (
            <ul className="mt-4 space-y-3 text-sm">
              {contact.whatsapp ? (
                <li>
                  <Button asChild>
                    <a href={whatsappHref(contact.whatsapp)} rel="noopener">
                      Agendar pelo WhatsApp
                    </a>
                  </Button>
                </li>
              ) : null}
              {contact.email ? (
                <li>
                  E-mail:{" "}
                  <a href={`mailto:${contact.email}`} className="underline underline-offset-4">
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.phone ? <li>Telefone: {contact.phone}</li> : null}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Ainda não é paciente? Envie uma mensagem pela página de contato — respondemos para
              combinar a pré-consulta. Já é paciente? Entre no portal e escolha um horário livre.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!showChannels ? (
              <Button asChild>
                <Link href="/contato">Ir para o contato</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/login?next=%2Fpaciente%2Fagendar">Já sou paciente — agendar online</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
