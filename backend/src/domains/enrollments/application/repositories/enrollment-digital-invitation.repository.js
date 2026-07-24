/**
 * Repository contract for Enrollment Digital Invitation persistence.
 *
 * @typedef {Object} EnrollmentDigitalInvitationRepository
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} create
 * @property {(id: string) => Promise<Record<string, unknown>|null>} findById
 * @property {(enrollmentId: string) => Promise<Record<string, unknown>|null>} findActiveByEnrollment
 * @property {(tokenHash: string) => Promise<Record<string, unknown>|null>} findByTokenHash
 * @property {(input: { invitationId?: string|null, revokedAt?: string|null, revokedBy?: string|null, replacedByInvitationId?: string|null }) => Promise<{ changed: boolean, invitation: Record<string, unknown>|null }>} revokeInvitation
 * @property {(input: { invitationId?: string|null, expiredAt?: string|null }) => Promise<{ changed: boolean, invitation: Record<string, unknown>|null }>} expireInvitation
 * @property {(input: { currentInvitationId?: string|null, replacement?: Record<string, unknown>, revokedAt?: string|null, revokedBy?: string|null }) => Promise<{ previousInvitation: Record<string, unknown>|null, invitation: Record<string, unknown>, renewed: boolean }>} replaceInvitation
 */

module.exports = {};
