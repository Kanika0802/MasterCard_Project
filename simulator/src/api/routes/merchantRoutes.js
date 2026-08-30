// simulator/src/api/routes/merchantRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const MerchantController = require("../controllers/MerchantController");

const router = express.Router();
const controller = new MerchantController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:merchant_id", asyncHandler(controller.getById));
router.put("/:merchant_id/status", asyncHandler(controller.updateStatus));

module.exports = router;
