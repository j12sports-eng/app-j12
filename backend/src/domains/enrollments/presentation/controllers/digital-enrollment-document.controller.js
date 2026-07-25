const path = require("node:path");
const { readTokenParam } = require("./enrollment-invitation-public.controller.js");

class DigitalEnrollmentDocumentController {
  constructor({ service } = {}) {
    this.service = service;
    for (const method of ["upload", "list", "delete", "download"]) this[method] = this[method].bind(this);
  }
  upload(req, res) { return this.execute(res, () => this.service.upload(readTokenParam(req), { file: req.file, type: req.body?.type }), 201); }
  list(req, res) { return this.execute(res, () => this.service.list(readTokenParam(req))); }
  delete(req, res) { return this.execute(res, () => this.service.delete(readTokenParam(req), req.params.id)); }
  async download(req, res) {
    try {
      const result = await this.service.download(readTokenParam(req), req.params.id);
      const name = path.basename(result.document.originalName).replace(/["\r\n]/g, "_");
      res.set("Content-Type", result.document.mimeType);
      res.set("Content-Length", String(result.buffer.length));
      res.set("Content-Disposition", `attachment; filename="${name}"`);
      return res.send(result.buffer);
    } catch (error) { return failure(res, error); }
  }
  async execute(res, operation, status = 200) {
    try { return res.status(status).json({ data: await operation(), success: true }); }
    catch (error) { return failure(res, error); }
  }
}
function failure(res, error) {
  const status = [400, 404, 409, 413].includes(error?.statusCode) ? error.statusCode : 404;
  return res.status(status).json({ code: error?.code || "DIGITAL_ENROLLMENT_DOCUMENTS_UNAVAILABLE", error: "Documentos da matricula indisponiveis.", success: false });
}
module.exports = { DigitalEnrollmentDocumentController };
