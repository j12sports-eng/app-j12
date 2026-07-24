/**
 * Repository contract for canonical user-unit memberships.
 *
 * @typedef {Object} UserUnitMembershipRepository
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} create
 * @property {(id: string) => Promise<Record<string, unknown>|null>} findById
 * @property {(input: { authIdentityId: string, unitId: string }) => Promise<Record<string, unknown>|null>} findByIdentityAndUnit
 * @property {(authIdentityId: string) => Promise<Record<string, unknown>[]>} listByIdentity
 * @property {(authIdentityId: string) => Promise<Record<string, unknown>[]>} listActiveByIdentity
 * @property {(input: { membershipId: string, revokedAt?: string|null, revokedByAuthIdentityId: string }) => Promise<{ changed: boolean, membership: Record<string, unknown>|null }>} revoke
 * @property {(input: { membershipId: string, deactivatedAt?: string|null }) => Promise<{ changed: boolean, membership: Record<string, unknown>|null }>} deactivate
 * @property {(input: { membershipId: string, role: string }) => Promise<{ changed: boolean, membership: Record<string, unknown>|null, previousRole: string|null }>} changeRole
 * @property {(input: { membershipId: string }) => Promise<{ changed: boolean, membership: Record<string, unknown>|null }>} setDefault
 * @property {(authIdentityId: string) => Promise<{ changed: boolean, count: number }>} clearDefaultByIdentity
 * @property {(input: { membershipId: string, authIdentityId?: string|null, unitId?: string|null }) => Promise<{ membership: Record<string, unknown>|null, previousDefault: Record<string, unknown>|null, changed: boolean, reused: boolean }>} setDefaultTransactionally
 * @property {(input: { authIdentityId: string, unitId: string }) => Promise<Record<string, unknown>|null>} checkActive
 */

class UserUnitMembershipRepositoryContract {
  async create() {
    throw new TypeError("UserUnitMembershipRepository.create must be implemented.");
  }

  async findById() {
    throw new TypeError("UserUnitMembershipRepository.findById must be implemented.");
  }

  async findByIdentityAndUnit() {
    throw new TypeError("UserUnitMembershipRepository.findByIdentityAndUnit must be implemented.");
  }

  async listByIdentity() {
    throw new TypeError("UserUnitMembershipRepository.listByIdentity must be implemented.");
  }

  async listActiveByIdentity() {
    throw new TypeError("UserUnitMembershipRepository.listActiveByIdentity must be implemented.");
  }

  async revoke() {
    throw new TypeError("UserUnitMembershipRepository.revoke must be implemented.");
  }

  async deactivate() {
    throw new TypeError("UserUnitMembershipRepository.deactivate must be implemented.");
  }

  async changeRole() {
    throw new TypeError("UserUnitMembershipRepository.changeRole must be implemented.");
  }

  async setDefault() {
    throw new TypeError("UserUnitMembershipRepository.setDefault must be implemented.");
  }

  async clearDefaultByIdentity() {
    throw new TypeError("UserUnitMembershipRepository.clearDefaultByIdentity must be implemented.");
  }

  async setDefaultTransactionally() {
    throw new TypeError(
      "UserUnitMembershipRepository.setDefaultTransactionally must be implemented.",
    );
  }

  async checkActive() {
    throw new TypeError("UserUnitMembershipRepository.checkActive must be implemented.");
  }
}

module.exports = {
  UserUnitMembershipRepositoryContract,
};
