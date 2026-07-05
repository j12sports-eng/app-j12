const RegistrationStatus = Object.freeze({
  CANCELLED: "CANCELLED",
  CONFIRMED: "CONFIRMED",
  PENDING: "PENDING",
  REFUSED: "REFUSED",
});

const REGISTRATION_STATUSES = Object.freeze(Object.values(RegistrationStatus));

module.exports = {
  REGISTRATION_STATUSES,
  RegistrationStatus,
};
