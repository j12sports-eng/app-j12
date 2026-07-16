import type { DashboardArea } from "./dashboard-layout";

export type DashboardSectionId =
  | "executive"
  | "financial"
  | "students"
  | "classes"
  | "agenda"
  | "championships"
  | "rentals"
  | "sponsorships"
  | "alerts";

export type DashboardSectionDefinition = {
  area: DashboardArea;
  description: string;
  eyebrow: string;
  id: DashboardSectionId;
  title: string;
};

export const DASHBOARD_SECTIONS: DashboardSectionDefinition[] = [
  {
    area: "executive",
    description: "Indicadores prioritários para acompanhamento da operação.",
    eyebrow: "Visão geral",
    id: "executive",
    title: "Resumo Executivo",
  },
  {
    area: "financial",
    description: "Receitas, despesas, cobranças e evolução financeira.",
    eyebrow: "Resultado",
    id: "financial",
    title: "Financeiro",
  },
  {
    area: "students",
    description: "Base ativa, novas entradas e distribuição dos alunos.",
    eyebrow: "Crescimento",
    id: "students",
    title: "Alunos",
  },
  {
    area: "classes",
    description: "Capacidade, ocupação e situação das turmas.",
    eyebrow: "Operação esportiva",
    id: "classes",
    title: "Turmas",
  },
  {
    area: "agenda",
    description: "Espaço reservado para compromissos e ocorrências da operação.",
    eyebrow: "Rotina",
    id: "agenda",
    title: "Agenda",
  },
  {
    area: "championships",
    description: "Competições, inscrições, equipes e partidas.",
    eyebrow: "Eventos esportivos",
    id: "championships",
    title: "Campeonatos",
  },
  {
    area: "rentals",
    description: "Espaço reservado para ocupação e operação de locações.",
    eyebrow: "Estrutura",
    id: "rentals",
    title: "Locações",
  },
  {
    area: "sponsorships",
    description: "Espaço reservado para contratos e entregas de patrocínio.",
    eyebrow: "Parcerias",
    id: "sponsorships",
    title: "Patrocínios",
  },
  {
    area: "alerts",
    description: "Pendências e sinais que exigem atenção da gestão.",
    eyebrow: "Inteligência",
    id: "alerts",
    title: "Alertas",
  },
];
