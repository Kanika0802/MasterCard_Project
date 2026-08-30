// simulator/src/api/routes/index.js

const express = require("express");

const userRoutes = require("./userRoutes");
const accountRoutes = require("./accountRoutes");
const transactionRoutes = require("./transactionRoutes");
const deviceRoutes = require("./deviceRoutes");
const kycRoutes = require("./kycRoutes");
const beneficiaryRoutes = require("./beneficiaryRoutes");
const authRoutes = require("./authRoutes");
const merchantRoutes = require("./merchantRoutes");
const simulationRoutes = require("./simulationRoutes");
const actionRoutes = require("./actionRoutes");

const router = express.Router();

router.use("/users", userRoutes);
router.use("/accounts", accountRoutes);
router.use("/transactions", transactionRoutes);
router.use("/devices", deviceRoutes);
router.use("/kycs", kycRoutes);
router.use("/beneficiaries", beneficiaryRoutes);
router.use("/auth_events", authRoutes);
router.use("/merchants", merchantRoutes);
router.use("/simulations", simulationRoutes);
router.use("/actions", actionRoutes);

module.exports = router;
