import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCrmLeadStageTiming } from "../api/crm-lead-stage-timing.api";
import { crmLeadStageTimingQueryKeys } from "../query/crm-lead-stage-timing.query-keys";

export function useCrmLeadStageTiming(leadId: string | null, enabled = true) {
  return useQuery({
    queryKey: crmLeadStageTimingQueryKeys.detail(leadId || ""),
    queryFn: () => getCrmLeadStageTiming(leadId as string),
    enabled: Boolean(leadId) && enabled,
  });
}

export function useVisibleMinuteClock() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const start = () => {
      stop();
      setNowMs(Date.now());
      if (document.visibilityState === "visible") {
        interval = setInterval(() => setNowMs(Date.now()), 60_000);
      }
    };
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", start);
    };
  }, []);
  return nowMs;
}
