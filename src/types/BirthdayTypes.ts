export type BirthdayTab = "today" | "week" | "month";

export type BirthdayStudent = {
  id: string;
  nome: string;
  foto: string | null;
  dataNascimento: string;
  dataAniversario: string;
  idade: number;
  turma: string;
  unidade: string;
  telefoneResponsavel: string;
};

export type DashboardBirthdaysResponse = {
  today: BirthdayStudent[];
  week: BirthdayStudent[];
  month: BirthdayStudent[];
};
