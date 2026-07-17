import type { BIHookOptions } from "../hooks/shared";

type PreviewQueryOverrides = Omit<BIHookOptions, "queryKey">;

export function createPreviewQueryOptions(
  key: readonly string[],
  overrides: PreviewQueryOverrides = {},
): BIHookOptions {
  return {
    queryKey: ["command-center-preview", ...key],
    refetchOnWindowFocus: false,
    ...overrides,
  };
}
