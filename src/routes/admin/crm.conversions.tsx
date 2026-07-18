import { createFileRoute } from "@tanstack/react-router";
import { CrmConversionHistoryRoutePage } from "@/features/crm/pages/CrmConversionHistoryPage";

export const Route = createFileRoute("/admin/crm/conversions")({
  component: CrmConversionHistoryRoutePage,
});
