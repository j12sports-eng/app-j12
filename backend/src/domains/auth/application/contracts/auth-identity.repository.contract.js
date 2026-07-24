/**
 * Repository contract for canonical authentication identities.
 *
 * @typedef {Object} AuthIdentityRepository
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} create
 * @property {(id: string) => Promise<Record<string, unknown>|null>} findById
 * @property {(input: { source: string, sourceUserId: string }) => Promise<Record<string, unknown>|null>} findBySourceUser
 * @property {(input: { identityId: string, disabledAt?: string|null }) => Promise<{ changed: boolean, identity: Record<string, unknown>|null }>} disableIdentity
 */

class AuthIdentityRepositoryContract {
  async create() {
    throw new TypeError("AuthIdentityRepository.create must be implemented.");
  }

  async findById() {
    throw new TypeError("AuthIdentityRepository.findById must be implemented.");
  }

  async findBySourceUser() {
    throw new TypeError("AuthIdentityRepository.findBySourceUser must be implemented.");
  }

  async disableIdentity() {
    throw new TypeError("AuthIdentityRepository.disableIdentity must be implemented.");
  }
}

module.exports = {
  AuthIdentityRepositoryContract,
};
