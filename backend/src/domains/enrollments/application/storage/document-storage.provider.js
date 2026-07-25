class DocumentStorageProvider {
  async put() {
    throw new TypeError("DocumentStorageProvider.put must be implemented.");
  }
  async get() {
    throw new TypeError("DocumentStorageProvider.get must be implemented.");
  }
  async delete() {
    throw new TypeError("DocumentStorageProvider.delete must be implemented.");
  }
}
module.exports = { DocumentStorageProvider };
