import type { CommandCenterTrend } from "@/features/command-center/types/command-center.types";

export function calculateTrend(
  currentValue: number | null | undefined,
  previousValue: number | null | undefined,
): CommandCenterTrend {
  if (currentValue == null || previousValue == null) return "unavailable";
  if (currentValue > previousValue) return "positive";
  if (currentValue < previousValue) return "negative";
  return "neutral";
}
