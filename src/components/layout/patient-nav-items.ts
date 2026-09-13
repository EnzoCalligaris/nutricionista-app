import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  FolderOpen,
  Home,
  LineChart,
  MessageSquare,
  Pill,
  User,
  UtensilsCrossed,
} from "lucide-react";

export type PatientNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  phase: string;
};

/** Fonte única do menu do portal do paciente — ver docs/PROJECT_SPEC.md §7. */
export const patientNavItems: PatientNavItem[] = [
  { title: "Início", href: "/paciente", icon: Home, phase: "Fase 5" },
  { title: "Meu Cardápio", href: "/paciente/cardapio", icon: UtensilsCrossed, phase: "Fase 8" },
  { title: "Minha Evolução", href: "/paciente/evolucao", icon: LineChart, phase: "Fase 9" },
  { title: "Consultas", href: "/paciente/consultas", icon: CalendarDays, phase: "Fase 6" },
  { title: "Suplementos", href: "/paciente/suplementos", icon: Pill, phase: "Fase 10" },
  { title: "Feedbacks", href: "/paciente/feedbacks", icon: MessageSquare, phase: "Fase 10" },
  { title: "Materiais", href: "/paciente/materiais", icon: FolderOpen, phase: "Fase 10" },
  { title: "Meu Perfil", href: "/paciente/perfil", icon: User, phase: "Fase 5" },
];
