import { createFileRoute } from "@tanstack/react-router";
import { CrmLeadsRoutePage } from "@/features/crm/pages/CrmLeadsPage";

export const Route = createFileRoute("/admin/crm/leads")({ component: CrmLeadsRoutePage });
