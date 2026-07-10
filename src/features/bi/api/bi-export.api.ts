import { buildApiUrl, ApiError } from "@/lib/api";
import { clearAuthSession, getStoredAuthToken } from "@/lib/auth-storage";
import type { BiFoundationFilters } from "../types/bi-foundation.types";

export type BiExportReport =
  | "executive"
  | "financial"
  | "students"
  | "classes"
  | "delinquency"
  | "courts"
  | "championships";
export type BiExportFormat = "csv" | "xlsx" | "pdf";

export async function downloadBiExport(
  report: BiExportReport,
  format: BiExportFormat,
  filters: BiFoundationFilters,
) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.unitId) params.set("unitId", filters.unitId);
  const response = await fetch(
    buildApiUrl(`/admin/bi/exports/${report}/${format}?${params.toString()}`),
    { headers: { Authorization: `Bearer ${getStoredAuthToken() || ""}` } },
  );
  if (!response.ok) {
    let message = "Falha ao exportar relatorio.";
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error || message;
    } catch {
      // Mantém a mensagem segura quando o backend não retorna JSON.
    }
    if (response.status === 401) {
      clearAuthSession();
      window.location.assign("/login");
    }
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([a-z0-9._-]+)"/i)?.[1] || `j12-bi.${format}`;
  const url = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
