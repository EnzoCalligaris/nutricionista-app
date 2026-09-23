import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Ruler,
  Settings,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";

export type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  phase: string;
};

/** Fonte única do menu do dashboard — ver docs/PROJECT_SPEC.md §6. */
export const dashboardNavItems: DashboardNavItem[] = [
  { title: "Visão Geral", href: "/dashboard", icon: LayoutDashboard, phase: "Fase 7" },
  { title: "Agenda", href: "/dashboard/agenda", icon: CalendarDays, phase: "Fase 6" },
  { title: "Pacientes", href: "/dashboard/pacientes", icon: Users, phase: "Fase 5" },
  { title: "Cardápios", href: "/dashboard/cardapios", icon: UtensilsCrossed, phase: "Fase 8" },
  { title: "Avaliações", href: "/dashboard/avaliacoes", icon: Ruler, phase: "Fase 9" },
  { title: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, phase: "Fase 5" },
  { title: "Consultas", href: "/dashboard/consultas", icon: ClipboardList, phase: "Fase 6" },
  { title: "Financeiro", href: "/dashboard/financeiro", icon: CircleDollarSign, phase: "Fase 7" },
  { title: "Blog", href: "/dashboard/blog", icon: Newspaper, phase: "Fase 14" },
  { title: "Resultados", href: "/dashboard/resultados", icon: TrendingUp, phase: "Fase 14" },
  { title: "Materiais", href: "/dashboard/materiais", icon: FolderOpen, phase: "Fase 10" },
  { title: "Notificações", href: "/dashboard/notificacoes", icon: Bell, phase: "Fase 12" },
  { title: "Configurações", href: "/dashboard/configuracoes", icon: Settings, phase: "Fase 14" },
];
