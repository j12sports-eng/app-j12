import { createFileRoute } from "@tanstack/react-router";
import { FinancialAutomationHistoryPage } from "@/features/financial/pages/FinancialAutomationHistoryPage";

export const Route = createFileRoute("/admin/financeiro/automacoes/historico")({
  component: FinancialAutomationHistoryPage,
});
