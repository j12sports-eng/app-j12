import { Users } from "lucide-react";

import { KPITrendCard } from "./KPITrendCard";
import type { CommandCenterTrend } from "@/features/command-center/types/command-center.types";

export function StudentCard(props: {
  description?: string;
  label: string;
  trend: CommandCenterTrend;
  trendLabel: string;
  value: string;
}) {
  return <KPITrendCard {...props} icon={Users} tone="primary" />;
}
