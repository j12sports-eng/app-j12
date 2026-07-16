import { calculateTrend } from "./calculate-trend";
import type { CommandCenterComparison } from "@/features/command-center/types/command-center.types";

export function comparePeriods(
  currentValue: number | null | undefined,
  previousValue: number | null | undefined,
): CommandCenterComparison {
  if (currentValue == null || previousValue == null) {
    return {
      available: false,
      percent: null,
      previousValue: previousValue ?? null,
      reason: "COMPARISON_VALUES_UNAVAILABLE",
      trend: "unavailable",
    };
  }

  if (previousValue === 0) {
    return {
      available: false,
      percent: null,
      previousValue,
      reason: "COMPARISON_BASE_ZERO",
      trend: calculateTrend(currentValue, previousValue),
    };
  }

  return {
    available: true,
    percent: ((currentValue - previousValue) / Math.abs(previousValue)) * 100,
    previousValue,
    reason: null,
    trend: calculateTrend(currentValue, previousValue),
  };
}
