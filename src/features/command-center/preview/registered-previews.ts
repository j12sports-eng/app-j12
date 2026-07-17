import { AgendaCommandCenterPreview } from "./AgendaCommandCenterPreview";
import { ClassesCommandCenterPreview } from "./ClassesCommandCenterPreview";
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
] as const);
