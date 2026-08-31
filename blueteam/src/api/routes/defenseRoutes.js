// blueteam/src/api/routes/defenseRoutes.js
"use strict";

const express = require("express");
const DefenseController = require("../controllers/DefenseController");

function createDefenseRoutes(defenseEngine) {
    const router = express.Router();
    const controller = new DefenseController(defenseEngine);

    router.get("/health", (req, res) => controller.getHealth(req, res));
    router.post("/evaluate/transaction", (req, res) => controller.evaluateTransaction(req, res));
    router.post("/evaluate/event", (req, res) => controller.evaluateEvent(req, res));
    router.get("/profiles/:entityType/:entityId", (req, res) => controller.getProfile(req, res));
    router.get("/alerts", (req, res) => controller.listAlerts(req, res));
    router.get("/alerts/:alertId", (req, res) => controller.getAlertById(req, res));
    router.post("/alerts/:alertId/resolve", (req, res) => controller.resolveAlert(req, res));
    router.post("/alerts/:alertId/dismiss", (req, res) => controller.dismissAlert(req, res));
    router.get("/rules", (req, res) => controller.getRules(req, res));
    router.get("/metrics", (req, res) => controller.getMetrics(req, res));

    return router;
}

module.exports = createDefenseRoutes;
