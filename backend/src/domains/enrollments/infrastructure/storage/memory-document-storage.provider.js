const { DocumentStorageProvider } = require("../../application/storage/document-storage.provider.js");

class MemoryDocumentStorageProvider extends DocumentStorageProvider {
  constructor() {
    super();
    this.files = new Map();
  }
  async put({ buffer, key }) {
    this.files.set(key, Buffer.from(buffer));
    return { key };
  }
  async get(key) {
    const value = this.files.get(key);
    return value ? Buffer.from(value) : null;
  }
  async delete(key) {
    return this.files.delete(key);
  }
}
module.exports = { MemoryDocumentStorageProvider };
