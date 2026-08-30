// simulator/src/api/routes/kycRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const KycController = require("../controllers/KycController");

const router = express.Router();
const controller = new KycController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:kyc_id", asyncHandler(controller.getById));
router.put("/:kyc_id", asyncHandler(controller.update));
router.delete("/:kyc_id", asyncHandler(controller.delete));

module.exports = router;
