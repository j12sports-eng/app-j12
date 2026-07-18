import { useQuery } from "@tanstack/react-query";
import { getCrmPipeline } from "../api/crm-pipeline.api";
import { crmPipelineQueryKeys } from "../query/crm-pipeline.query-keys";

export function useCrmPipeline() {
  return useQuery({
    queryKey: crmPipelineQueryKeys.all,
    queryFn: getCrmPipeline,
    staleTime: 5 * 60 * 1000,
  });
}
