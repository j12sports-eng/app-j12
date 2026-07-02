const { AppError } = require("../../errors/app-error.js");

/**
 * Core export for the shared application error.
 *
 * This file reuses the existing AppError implementation to avoid creating a
 * second error contract while the legacy backend is still active.
 */
module.exports = {
  AppError,
};
