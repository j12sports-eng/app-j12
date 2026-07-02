class BaseRepository {
  constructor({ db = null } = {}) {
    this.db = db;
  }

  async create() {
    throw new Error("BaseRepository.create must be implemented.");
  }

  async delete() {
    throw new Error("BaseRepository.delete must be implemented.");
  }

  async findById() {
    throw new Error("BaseRepository.findById must be implemented.");
  }

  async list() {
    throw new Error("BaseRepository.list must be implemented.");
  }

  async update() {
    throw new Error("BaseRepository.update must be implemented.");
  }
}

module.exports = {
  BaseRepository,
};
