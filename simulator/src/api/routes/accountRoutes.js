// simulator/src/api/routes/accountRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const AccountController = require("../controllers/AccountController");

const router = express.Router();
const controller = new AccountController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:account_id", asyncHandler(controller.getById));
router.put("/:account_id", asyncHandler(controller.updateStatus));
router.delete("/:account_id", asyncHandler(controller.close));

module.exports = router;
