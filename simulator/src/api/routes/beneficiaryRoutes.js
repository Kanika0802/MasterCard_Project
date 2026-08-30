// simulator/src/api/routes/beneficiaryRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const BeneficiaryController = require("../controllers/BeneficiaryController");

const router = express.Router();
const controller = new BeneficiaryController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:beneficiary_id", asyncHandler(controller.getById));
router.put("/:beneficiary_id", asyncHandler(controller.update));
router.delete("/:beneficiary_id", asyncHandler(controller.disable));

module.exports = router;
