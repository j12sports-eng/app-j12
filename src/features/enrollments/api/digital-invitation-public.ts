export type PublicInvitation = {
  available: true;
  capabilities: { canContinue: boolean; requiresAuthentication: false };
  expiresAt: string | null;
  nextStep: string;
};
export type DigitalEnrollmentStep = "RESPONSIBLE_DATA" | "STUDENT_DATA" | "ADDRESS" | "ADDITIONAL_INFORMATION" | "DOCUMENTS" | "REVIEW";
export type DigitalEnrollmentForm = {
  responsible: { name: string; email: string; phone: string };
  student: { name: string; birthDate: string };
  address: { zipCode: string; street: string; number: string; district: string; city: string; state: string; complement: string };
  additionalInformation: Record<string, never>;
  progress: { currentStep: DigitalEnrollmentStep; completedSteps: DigitalEnrollmentStep[]; revision: number; status: string };
};
export class PublicInvitationError extends Error {
  constructor(public readonly kind: "unavailable" | "rate_limit" | "network" | "conflict" | "invalid") { super(kind); }
}
export function isValidInvitationToken(token: string): boolean { return /^[A-Za-z0-9_-]{43}$/.test(token); }
async function request<T>(token: string, suffix: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`/api/enrollments/digital-invitations/public/${encodeURIComponent(token)}${suffix}`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", ...init, headers: init.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...(init.headers || {}) } });
    if (response.status === 429) throw new PublicInvitationError("rate_limit");
    if (response.status === 409) throw new PublicInvitationError("conflict");
    if (response.status === 400) throw new PublicInvitationError("invalid");
    if (!response.ok) throw new PublicInvitationError("unavailable");
    return ((await response.json()) as { data: T }).data;
  } catch (error) {
    if (error instanceof PublicInvitationError) throw error;
    throw new PublicInvitationError("network");
  }
}
export function resolvePublicInvitation(token: string) { return request<PublicInvitation>(token, ""); }
export function getDigitalEnrollmentForm(token: string) { return request<DigitalEnrollmentForm>(token, "/form"); }
export function getDigitalEnrollmentReview(token: string) { return request<DigitalEnrollmentForm>(token, "/review"); }
export function saveDigitalEnrollmentStep(token: string, endpoint: string, fields: Record<string, string>, revision: number) {
  return request<DigitalEnrollmentForm>(token, `/${endpoint}`, { method: "PATCH", body: JSON.stringify({ fields, revision }) });
}
export function advanceDigitalEnrollmentStep(token: string, targetStep: DigitalEnrollmentStep, revision: number) {
  return request<{ currentStep: DigitalEnrollmentStep; progress: DigitalEnrollmentForm["progress"] }>(token, "/advance", { method: "POST", body: JSON.stringify({ fields: { targetStep }, revision }) });
}

export type DigitalEnrollmentDocumentType = "CPF" | "RG" | "CERTIDAO_NASCIMENTO" | "COMPROVANTE_RESIDENCIA" | "FOTO" | "OUTRO";
export type DigitalEnrollmentDocument = { id: string; type: DigitalEnrollmentDocumentType; status: "PENDING" | "APPROVED" | "REJECTED"; originalName: string; mimeType: string; extension: string; sizeBytes: number; sha256: string; rejectionReason: string | null };
export function listDigitalEnrollmentDocuments(token: string) { return request<DigitalEnrollmentDocument[]>(token, "/documents"); }
export function uploadDigitalEnrollmentDocument(token: string, type: DigitalEnrollmentDocumentType, file: File) { const body = new FormData(); body.append("type", type); body.append("file", file); return request<DigitalEnrollmentDocument>(token, "/documents", { method: "POST", body }); }
export function deleteDigitalEnrollmentDocument(token: string, id: string) { return request<{ deleted: true; id: string }>(token, `/documents/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function digitalEnrollmentDocumentDownloadUrl(token: string, id: string) { return `/api/enrollments/digital-invitations/public/${encodeURIComponent(token)}/documents/${encodeURIComponent(id)}/download`; }