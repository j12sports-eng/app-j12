import { FinancialCommandCenterPreview } from "./FinancialCommandCenterPreview";
import { createCommandCenterPreviewRegistry } from "./registry";

/** Central typed registry; future previews can be appended without changing consumers. */
export const commandCenterPreviewRegistry = createCommandCenterPreviewRegistry([
  {
    component: FinancialCommandCenterPreview,
    id: "financial",
    title: "Preview BI Financeiro",
  },
] as const);
