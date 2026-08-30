// simulator/src/api/routes/actionRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const ActionController = require("../controllers/ActionController");

const router = express.Router();
const controller = new ActionController();

router.post("/", asyncHandler(controller.executeAction));

module.exports = router;
