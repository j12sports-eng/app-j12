import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getChampionshipStatusLabel,
  getChampionshipStatusTone,
} from "../utils/championship-formatters";

import type { ChampionshipStatus } from "../types/championship.types";

export function ChampionshipStatusBadge({ status }: { status: ChampionshipStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        getChampionshipStatusTone(status),
      )}
    >
      <Trophy className="h-3.5 w-3.5" />
      {getChampionshipStatusLabel(status)}
    </span>
  );
}
