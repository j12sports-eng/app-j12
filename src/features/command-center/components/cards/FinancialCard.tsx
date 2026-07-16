import { Wallet } from "lucide-react";

import { KPITrendCard } from "./KPITrendCard";
import type { CommandCenterTrend } from "@/features/command-center/types/command-center.types";

export function FinancialCard(props: {
  description?: string;
  label: string;
  trend: CommandCenterTrend;
  trendLabel: string;
  value: string;
}) {
  return <KPITrendCard {...props} icon={Wallet} tone="success" />;
}
