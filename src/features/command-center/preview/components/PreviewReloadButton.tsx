import { RefreshCw } from "lucide-react";

import type { PreviewReloadHandler } from "../types";

export type PreviewReloadButtonProps = {
  fetching: boolean;
  label: string;
  loadingLabel?: string;
  onReload: PreviewReloadHandler;
};

/** Standard reload control that prevents duplicate refresh requests. */
export function PreviewReloadButton({
  fetching,
  label,
  loadingLabel = "Atualizando",
  onReload,
}: PreviewReloadButtonProps) {
  return (
    <button
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary disabled:cursor-wait disabled:opacity-60"
      disabled={fetching}
      onClick={() => void onReload()}
      type="button"
    >
      <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
      {fetching ? loadingLabel : "Recarregar"}
    </button>
  );
}
