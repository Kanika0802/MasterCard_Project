// simulator/src/api/routes/deviceRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const DeviceController = require("../controllers/DeviceController");

const router = express.Router();
const controller = new DeviceController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:device_id", asyncHandler(controller.getById));
router.put("/:device_id", asyncHandler(controller.update));
router.delete("/:device_id", asyncHandler(controller.retire));

module.exports = router;
