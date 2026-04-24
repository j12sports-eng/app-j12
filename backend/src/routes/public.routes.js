const express = require("express");
const {
  createPublicEnrollment,
  getNextEnrollmentNumber,
  lookupAddress,
} = require("../controllers/public-enrollments.controller");

const router = express.Router();

router.get("/enrollments/next-number", getNextEnrollmentNumber);
router.post("/enrollments", createPublicEnrollment);
router.get("/address/lookup", lookupAddress);

module.exports = router;
