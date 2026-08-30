// simulator/src/api/routes/authRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const AuthController = require("../controllers/AuthController");

const router = express.Router();
const controller = new AuthController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:event_id", asyncHandler(controller.getById));
router.delete("/:event_id", asyncHandler(controller.delete));

// Auth simulation helper endpoints
router.post("/login", asyncHandler(controller.login));
router.post("/otp/request", asyncHandler(controller.requestOtp));
router.post("/otp/verify", asyncHandler(controller.verifyOtp));

module.exports = router;
