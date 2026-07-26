const ELIGIBILITY_ERROR_CODE = "DIGITAL_ENROLLMENT_REVIEW_NOT_ELIGIBLE";

class DigitalEnrollmentReviewEligibilityPolicy {
  evaluate(context = {}) {
    const eligible =
      context.documentsComplete === true &&
      context.contractAccepted === true &&
      context.progressEligible === true &&
      context.enrollmentStatus === "DRAFT";
    if (!eligible) {
      const error = new Error("Digital enrollment is not eligible for administrative review.");
      error.code = ELIGIBILITY_ERROR_CODE;
      error.statusCode = 409;
      error.expose = true;
      throw error;
    }
    return Object.freeze({ eligible: true });
  }
}

module.exports = { DigitalEnrollmentReviewEligibilityPolicy, ELIGIBILITY_ERROR_CODE };
