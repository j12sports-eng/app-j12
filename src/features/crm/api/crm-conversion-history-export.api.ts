import { ApiError, buildApiUrl } from "@/lib/api";
import { clearAuthSession, getStoredAuthToken } from "@/lib/auth-storage";
import type { CrmConversionHistoryFilters } from "../types/crm-conversion-history.types";

export async function downloadCrmConversionHistoryExport(
  filters: CrmConversionHistoryFilters,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    leadId: filters.leadId,
    unitId: filters.unitId,
    convertedBy: filters.convertedBy,
    enrollmentStatus: filters.enrollmentStatus,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  const response = await fetch(
    buildApiUrl(`/internal/crm/conversions/export${query ? `?${query}` : ""}`),
    { headers: { Authorization: `Bearer ${getStoredAuthToken() || ""}` } },
  );
  if (!response.ok) {
    let message = "Não foi possível exportar o histórico.";
    let code: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      message = body.error || message;
      code = body.code;
    } catch {
      // Mantém a mensagem segura para respostas não JSON.
    }
    if (response.status === 401) {
      clearAuthSession();
      window.location.assign("/login");
    }
    const error = new ApiError(message, response.status);
    Object.assign(error, { code });
    throw error;
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([a-z0-9._-]+)"/i)?.[1] || "crm-conversions.csv";
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
