export type PublicInvitation = {
  available: true;
  capabilities: { canContinue: false; requiresAuthentication: false };
  expiresAt: string | null;
  nextStep: "WAIT_FOR_ENROLLMENT_FORM";
};

export class PublicInvitationError extends Error {
  constructor(public readonly kind: "unavailable" | "rate_limit" | "network") {
    super(kind);
  }
}

export function isValidInvitationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function resolvePublicInvitation(token: string): Promise<PublicInvitation> {
  try {
    const response = await fetch(
      `/api/enrollments/digital-invitations/public/${encodeURIComponent(token)}`,
      { method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" },
    );
    if (response.status === 429) throw new PublicInvitationError("rate_limit");
    if (!response.ok) throw new PublicInvitationError("unavailable");
    const payload = (await response.json()) as { data: PublicInvitation };
    return payload.data;
  } catch (error) {
    if (error instanceof PublicInvitationError) throw error;
    throw new PublicInvitationError("network");
  }
}
