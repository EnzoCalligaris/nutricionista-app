import { Camera, CalendarPlus, LineChart, MessageSquare, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const summaryCards = [
  { title: "Próxima consulta", icon: CalendarPlus },
  { title: "Cardápio do dia", icon: UtensilsCrossed },
  { title: "Último feedback", icon: MessageSquare },
  { title: "Última avaliação", icon: LineChart },
] as const;

export default function PatientHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Início</h1>
        <p className="text-sm text-muted-foreground">
          Dados reais chegam nas Fases 5, 6, 8 e 9.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {summaryCards.map(({ title, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {title}
              </CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled className="gap-2">
          <CalendarPlus className="size-4" />
          Agendar consulta
        </Button>
        <Button disabled variant="secondary" className="gap-2">
          <Camera className="size-4" />
          Analisar refeição
        </Button>
      </div>
    </div>
  );
}
