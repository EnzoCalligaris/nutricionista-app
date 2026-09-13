import { CalendarClock, LineChart, NotebookText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/shared/container";

const pillars = [
  {
    icon: CalendarClock,
    title: "Consultas",
    description:
      "Acompanhamento presencial e online, explorando junto as dificuldades de cada paciente.",
  },
  {
    icon: NotebookText,
    title: "Planejamento nutricional",
    description:
      "Planos alimentares individualizados, ajustados sempre que necessário.",
  },
  {
    icon: LineChart,
    title: "Acompanhamento de perto",
    description:
      "Check-ins periódicos para acompanhar evolução, feedback e ajustes de rota.",
  },
] as const;

export default function HomePage() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-6">
          Plataforma em desenvolvimento
        </Badge>
        <h1 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Método EM
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          A metodologia de acompanhamento nutricional de Enzo Mangili — da
          pré-consulta à evolução contínua do paciente, sem comprometer sua
          rotina.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
        {pillars.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="font-heading text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mx-auto mt-16 max-w-md text-center text-sm text-muted-foreground">
        Esta é uma home provisória, criada para validar o design system da
        plataforma. O site institucional completo chega na Fase 4.
      </p>
    </Container>
  );
}
