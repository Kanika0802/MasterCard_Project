// simulator/src/api/routes/transactionRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const TransactionController = require("../controllers/TransactionController");

const router = express.Router();
const controller = new TransactionController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:transaction_id", asyncHandler(controller.getById));
router.put("/:transaction_id", asyncHandler(controller.updateState));
router.delete("/:transaction_id", asyncHandler(controller.delete));

module.exports = router;
