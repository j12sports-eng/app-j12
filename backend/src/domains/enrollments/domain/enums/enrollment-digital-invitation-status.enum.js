const EnrollmentDigitalInvitationStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
  USED: "USED",
});

const ENROLLMENT_DIGITAL_INVITATION_STATUS_VALUES = Object.freeze(
  Object.values(EnrollmentDigitalInvitationStatus),
);

function normalizeEnrollmentDigitalInvitationStatus(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return ENROLLMENT_DIGITAL_INVITATION_STATUS_VALUES.includes(normalized) ? normalized : null;
}

module.exports = {
  ENROLLMENT_DIGITAL_INVITATION_STATUS_VALUES,
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
};
