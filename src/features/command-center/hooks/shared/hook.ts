import { useQuery, type QueryKey, type QueryObserverResult } from "@tanstack/react-query";

import type { BIProvider } from "../../providers/shared";

export interface BIHookOptions {
  enabled?: boolean;
  queryKey: QueryKey;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
  staleTime?: number;
}

export interface BIHookResult<TContract> {
  contract: TContract | undefined;
  error: Error | null;
  fetching: boolean;
  lastUpdate: string | null;
  loading: boolean;
  refetch: () => Promise<QueryObserverResult<TContract, Error>>;
}

/** Shared React Query boundary for injected, typed BI providers. */
export function useBIContract<TContract extends { generatedAt: string }>(
  provider: BIProvider<TContract>,
  options: BIHookOptions,
): BIHookResult<TContract> {
  const query = useQuery<TContract, Error>({
    enabled: options.enabled,
    queryFn: provider.getContract,
    queryKey: options.queryKey,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
    retry: options.retry,
    staleTime: options.staleTime,
  });

  return {
    contract: query.data,
    error: query.error,
    fetching: query.isFetching,
    lastUpdate: query.data?.generatedAt ?? null,
    loading: query.isPending,
    refetch: query.refetch,
  };
}
