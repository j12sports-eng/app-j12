const express = require("express");
const multer = require("multer");

const { DigitalEnrollmentFormApplicationService } = require("../application/services/digital-enrollment-form-application.service.js");
const { ResolveEnrollmentInvitationApplicationService } = require("../application/services/resolve-enrollment-invitation-application.service.js");
const { EnrollmentDigitalInvitationService } = require("../application/services/enrollment-digital-invitation.service.js");
const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const { DigitalEnrollmentFormController } = require("../presentation/controllers/digital-enrollment-form.controller.js");
const { DigitalEnrollmentDocumentController } = require("../presentation/controllers/digital-enrollment-document.controller.js");
const { DigitalEnrollmentDocumentService, MAX_DOCUMENT_SIZE_BYTES } = require("../application/services/digital-enrollment-document.service.js");
const { applyPublicInvitationResponseHeaders, EnrollmentInvitationPublicController } = require("../presentation/controllers/enrollment-invitation-public.controller.js");
const { DigitalEnrollmentFormGateway } = require("./digital-enrollment-form.gateway.js");
const { createDigitalEnrollmentTransactionRunner } = require("./digital-enrollment-transaction.runner.js");
const { MySqlEnrollmentDigitalInvitationRepository } = require("./repositories/mysql-enrollment-digital-invitation.repository.js");
const { MySqlEnrollmentRepository } = require("./repositories/mysql-enrollment.repository.js");
const { MySqlDigitalEnrollmentDocumentRepository } = require("./repositories/mysql-digital-enrollment-document.repository.js");
const { FilesystemDocumentStorageProvider } = require("./storage/filesystem-document-storage.provider.js");

const ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH = "/enrollments/digital-invitations/public";
const ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH = "/:token";

function createEnrollmentInvitationPublicComposition(options = {}) {
  const enrollmentRepository = options.enrollmentRepository || new MySqlEnrollmentRepository(options.enrollmentRepositoryOptions || {});
  const enrollmentFacade = options.enrollmentFacade || new EnrollmentFacade({ enrollmentRepository });
  const invitationRepository = options.invitationRepository || new MySqlEnrollmentDigitalInvitationRepository(options.invitationRepositoryOptions || {});
  const invitationResolver = options.invitationResolver || new EnrollmentDigitalInvitationService({ clock: options.clock, enrollmentReader: enrollmentFacade, invitationRepository, logger: options.logger });
  const resolveEnrollmentInvitationService = options.resolveEnrollmentInvitationService || new ResolveEnrollmentInvitationApplicationService({ invitationResolver, logger: options.logger });
  const controller = options.controller || new EnrollmentInvitationPublicController({ logger: options.logger, resolveEnrollmentInvitationService });
  const transactionRunner = options.transactionRunner || createDigitalEnrollmentTransactionRunner(options.transactionRunnerOptions || {});
  const formGateway = options.formGateway || new DigitalEnrollmentFormGateway({ transactionRunner });
  const formService = options.formService || new DigitalEnrollmentFormApplicationService({ aggregateGateway: formGateway, invitationResolver, logger: options.logger });
  const formController = options.formController || new DigitalEnrollmentFormController({ formService, logger: options.logger });
  const documentRepository = options.documentRepository || new MySqlDigitalEnrollmentDocumentRepository(options.documentRepositoryOptions || {});
  const documentStorageProvider = options.documentStorageProvider || new FilesystemDocumentStorageProvider(options.documentStorageOptions || {});
  const documentService = options.documentService || new DigitalEnrollmentDocumentService({ accessGateway: formGateway, invitationResolver, repository: documentRepository, storageProvider: documentStorageProvider });
  const documentController = options.documentController || new DigitalEnrollmentDocumentController({ service: documentService });

  return Object.freeze({ controller, documentController, documentRepository, documentService, documentStorageProvider, formController, formGateway, formService, invitationRepository, invitationResolver, resolveEnrollmentInvitationService, routeBasePath: ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH, routePath: ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH });
}

function createEnrollmentInvitationPublicRouter(options = {}) {
  const router = express.Router();
  const composition = createEnrollmentInvitationPublicComposition(options);
  router.get(ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH, applyPublicInvitationResponseHeaders, composition.controller.getByToken);
  router.get("/:token/form", applyPublicInvitationResponseHeaders, composition.formController.getForm);
  router.patch("/:token/responsible", applyPublicInvitationResponseHeaders, composition.formController.updateResponsible);
  router.patch("/:token/student", applyPublicInvitationResponseHeaders, composition.formController.updateStudent);
  router.patch("/:token/address", applyPublicInvitationResponseHeaders, composition.formController.updateAddress);
  router.patch("/:token/additional-information", applyPublicInvitationResponseHeaders, composition.formController.updateAdditionalInformation);
  router.post("/:token/advance", applyPublicInvitationResponseHeaders, composition.formController.advanceStep);
  router.get("/:token/review", applyPublicInvitationResponseHeaders, composition.formController.getReview);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES, files: 1, fields: 2 } }).single("file");
  const parseDocumentUpload = (req, res, next) => upload(req, res, (error) => {
    if (!error) return next();
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ code: status === 413 ? "DIGITAL_ENROLLMENT_DOCUMENT_TOO_LARGE" : "DIGITAL_ENROLLMENT_DOCUMENT_INVALID", error: "Upload de documento invalido.", success: false });
  });
  router.post("/:token/documents", applyPublicInvitationResponseHeaders, parseDocumentUpload, composition.documentController.upload);
  router.get("/:token/documents", applyPublicInvitationResponseHeaders, composition.documentController.list);
  router.delete("/:token/documents/:id", applyPublicInvitationResponseHeaders, composition.documentController.delete);
  router.get("/:token/documents/:id/download", applyPublicInvitationResponseHeaders, composition.documentController.download);
  return router;
}

module.exports = { ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH, ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH, createEnrollmentInvitationPublicComposition, createEnrollmentInvitationPublicRouter };
