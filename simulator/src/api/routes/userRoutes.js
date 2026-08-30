// simulator/src/api/routes/userRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const UserController = require("../controllers/UserController");

const router = express.Router();
const controller = new UserController();

router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:user_id", asyncHandler(controller.getById));
router.put("/:user_id", asyncHandler(controller.update));
router.delete("/:user_id", asyncHandler(controller.deactivate));

module.exports = router;
