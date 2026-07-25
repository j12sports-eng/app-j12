const { promises: fs } = require("node:fs");
const path = require("node:path");
const { DocumentStorageProvider } = require("../../application/storage/document-storage.provider.js");

class FilesystemDocumentStorageProvider extends DocumentStorageProvider {
  constructor({ root = path.resolve(process.cwd(), "data", "digital-enrollment-documents") } = {}) {
    super();
    this.root = path.resolve(root);
  }
  resolve(key) {
    if (!/^[a-f0-9-]{36}$/.test(String(key || ""))) throw new TypeError("Invalid storage key.");
    const target = path.resolve(this.root, key);
    if (path.dirname(target) !== this.root) throw new TypeError("Invalid storage path.");
    return target;
  }
  async put({ buffer, key }) {
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.resolve(key), buffer, { flag: "wx", mode: 0o600 });
    return { key };
  }
  async get(key) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  async delete(key) {
    try {
      await fs.unlink(this.resolve(key));
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }
}
module.exports = { FilesystemDocumentStorageProvider };
