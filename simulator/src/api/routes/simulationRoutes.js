// simulator/src/api/routes/simulationRoutes.js

const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const SimulationController = require("../controllers/SimulationController");

const router = express.Router();
const controller = new SimulationController();

router.post("/", asyncHandler(controller.create));
router.get("/:simulation_id", asyncHandler(controller.getById));
router.post("/:simulation_id/start", asyncHandler(controller.start));
router.post("/:simulation_id/complete", asyncHandler(controller.complete));
router.get("/:simulation_id/clock", asyncHandler(controller.getClock));

module.exports = router;
