import { AgendaCommandCenterPreview } from "./AgendaCommandCenterPreview";
import { ClassesCommandCenterPreview } from "./ClassesCommandCenterPreview";
import { CourtsCommandCenterPreview } from "./CourtsCommandCenterPreview";
import { ChampionshipsCommandCenterPreview } from "./ChampionshipsCommandCenterPreview";
import { EventsCommandCenterPreview } from "./EventsCommandCenterPreview";
import { EnrollmentCommandCenterPreview } from "./EnrollmentCommandCenterPreview";
import { FinancialCommandCenterPreview } from "./FinancialCommandCenterPreview";
import { createCommandCenterPreviewRegistry } from "./registry";
import { StudentsCommandCenterPreview } from "./StudentsCommandCenterPreview";

/** Central typed registry; future previews can be appended without changing consumers. */
export const commandCenterPreviewRegistry = createCommandCenterPreviewRegistry([
  {
    component: FinancialCommandCenterPreview,
    id: "financial",
    title: "Preview BI Financeiro",
  },
  {
    component: StudentsCommandCenterPreview,
    id: "students",
    title: "Preview BI Alunos",
  },
  {
    component: EnrollmentCommandCenterPreview,
    id: "enrollments",
    title: "Preview BI Matrículas",
  },
  {
    component: ClassesCommandCenterPreview,
    id: "classes",
    title: "Preview BI Turmas",
  },
  {
    component: AgendaCommandCenterPreview,
    id: "agenda",
    title: "Preview BI Agenda",
  },
  {
    component: CourtsCommandCenterPreview,
    id: "courts",
    title: "Preview BI Quadras",
  },
  {
    component: ChampionshipsCommandCenterPreview,
    id: "championships",
    title: "Preview BI Campeonatos",
  },
  {
    component: EventsCommandCenterPreview,
    id: "events",
    title: "Preview BI Eventos",
  },
] as const);
