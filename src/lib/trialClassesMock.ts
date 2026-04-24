import type { Modalidade } from "./alunos-store";

export type TrialClassStatus =
  | "Agendada"
  | "Confirmada"
  | "Compareceu"
  | "N\u00E3o compareceu"
  | "Reagendada"
  | "Convertida"
  | "Cancelada";

export type TrialClassMockRecord = {
  id: string;
  student_name: string;
  guardian_name: string;
  phone: string;
  modality: Modalidade;
  teacher: string;
  date: string;
  time: string;
  status: TrialClassStatus;
  lead_source: string;
  birth_date: string;
  notes: string;
  whatsapp: string;
  email: string;
  unit: string;
  turma: string;
};

export const trialClassesMock: TrialClassMockRecord[] = [
  {
    id: "tc1",
    student_name: "Joao Miguel Souza",
    guardian_name: "Fernanda Souza",
    phone: "(11) 99111-2020",
    modality: "Futebol",
    teacher: "Ricardo Mendes",
    date: "2026-04-23",
    time: "14:00",
    status: "Agendada",
    lead_source: "Instagram",
    birth_date: "2015-03-18",
    notes: "Aluno chegou por campanha de performance no social.",
    whatsapp: "(11) 99111-2020",
    email: "fernanda.souza@email.com",
    unit: "Unidade Centro",
    turma: "Sub-11 Tarde",
  },
  {
    id: "tc2",
    student_name: "Ana Clara Lima",
    guardian_name: "Rafael Lima",
    phone: "(11) 98222-3030",
    modality: "V\u00F4lei",
    teacher: "Camila Rocha",
    date: "2026-04-22",
    time: "15:00",
    status: "Confirmada",
    lead_source: "Indicacao",
    birth_date: "2013-08-10",
    notes: "Responsavel pediu retorno apos a aula.",
    whatsapp: "(11) 98222-3030",
    email: "rafael.lima@email.com",
    unit: "Unidade Centro",
    turma: "Sub-13 Tarde",
  },
  {
    id: "tc3",
    student_name: "Pedro Henrique Costa",
    guardian_name: "Juliana Costa",
    phone: "(11) 97333-4040",
    modality: "Futsal",
    teacher: "Andre Silva",
    date: "2026-04-20",
    time: "19:00",
    status: "Compareceu",
    lead_source: "Site",
    birth_date: "2011-01-21",
    notes: "Mostrou boa adaptacao ao ritmo da turma.",
    whatsapp: "(11) 97333-4040",
    email: "juliana.costa@email.com",
    unit: "Unidade Zona Sul",
    turma: "Sub-15 Noite",
  },
  {
    id: "tc4",
    student_name: "Marina Alves",
    guardian_name: "Carlos Alves",
    phone: "(11) 96444-5050",
    modality: "Basquete",
    teacher: "Bruno Lima",
    date: "2026-04-19",
    time: "20:00",
    status: "N\u00E3o compareceu",
    lead_source: "WhatsApp",
    birth_date: "2009-11-02",
    notes: "Responsavel pediu novo horario para reposicao.",
    whatsapp: "(11) 96444-5050",
    email: "carlos.alves@email.com",
    unit: "Unidade Centro",
    turma: "Adulto Noite",
  },
  {
    id: "tc5",
    student_name: "Lucas Teixeira",
    guardian_name: "Roberta Teixeira",
    phone: "(11) 95555-6060",
    modality: "Futebol",
    teacher: "Ricardo Mendes",
    date: "2026-04-25",
    time: "09:00",
    status: "Reagendada",
    lead_source: "Meta Ads",
    birth_date: "2016-06-15",
    notes: "Familia preferiu aula no sabado pela manha.",
    whatsapp: "(11) 95555-6060",
    email: "roberta.teixeira@email.com",
    unit: "Unidade Zona Norte",
    turma: "Sub-9 Manha",
  },
  {
    id: "tc6",
    student_name: "Isabela Martins",
    guardian_name: "Renata Martins",
    phone: "(11) 94666-7070",
    modality: "Nata\u00E7\u00E3o",
    teacher: "Camila Rocha",
    date: "2026-04-18",
    time: "16:00",
    status: "Convertida",
    lead_source: "Evento",
    birth_date: "2012-11-19",
    notes: "Conversao feita no mesmo dia apos aula experimental.",
    whatsapp: "(11) 94666-7070",
    email: "renata.martins@email.com",
    unit: "Unidade Centro",
    turma: "Sub-13 Tarde",
  },
  {
    id: "tc7",
    student_name: "Gabriel Nogueira",
    guardian_name: "Patricia Nogueira",
    phone: "(11) 93777-8080",
    modality: "Futsal",
    teacher: "Andre Silva",
    date: "2026-04-17",
    time: "18:30",
    status: "Cancelada",
    lead_source: "Parceria escolar",
    birth_date: "2010-04-27",
    notes: "Cancelada por indisponibilidade da familia.",
    whatsapp: "(11) 93777-8080",
    email: "patricia.nogueira@email.com",
    unit: "Unidade Zona Sul",
    turma: "Sub-15 Noite",
  },
];
