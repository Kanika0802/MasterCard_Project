// attack-primitives/src/index.js
//
// Module 3: Attack Primitive Library — Public API
//
"use strict";

const AttackPrimitive = require("./domain/AttackPrimitive");
const ParameterDefinition = require("./domain/ParameterDefinition");
const StateTransition = require("./domain/StateTransition");

const {
    PrimitiveCategory,
    AttackFamily,
    ImpactSeverity,
    ExecutionType,
    ValidSimulatorActions,
    ParameterType
} = require("./domain/constants");

const {
    PrimitiveError,
    PrimitiveValidationError,
    ParameterConstraintError,
    PreconditionViolationError,
    ActionMappingError
} = require("./domain/errors");

const ALL_CANONICAL_PRIMITIVES = require("./definitions/catalog");
const AUTH_PRIMITIVES = require("./definitions/authentication");
const IDENTITY_KYC_PRIMITIVES = require("./definitions/identity_kyc");
const DEVICE_PRIMITIVES = require("./definitions/device");
const TRANSACTION_PRIMITIVES = require("./definitions/transaction");
const MULE_NETWORK_PRIMITIVES = require("./definitions/mule_network");
const ACCOUNT_PRIMITIVES = require("./definitions/account");

const { PrimitiveRegistry, getDefaultRegistry } = require("./registry/PrimitiveRegistry");
const CatalogExporter = require("./registry/CatalogExporter");
const SimulatorActionAdapter = require("./execution/SimulatorActionAdapter");
const PrimitiveValidator = require("./validation/PrimitiveValidator");

module.exports = {
    // ── CORE DOMAIN ENTITIES ─────────────────────────────────────
    AttackPrimitive,
    ParameterDefinition,
    StateTransition,

    // ── CONSTANTS & TAXONOMY ─────────────────────────────────────
    PrimitiveCategory,
    AttackFamily,
    ImpactSeverity,
    ExecutionType,
    ValidSimulatorActions,
    ParameterType,

    // ── ERRORS ───────────────────────────────────────────────────
    PrimitiveError,
    PrimitiveValidationError,
    ParameterConstraintError,
    PreconditionViolationError,
    ActionMappingError,

    // ── REGISTRY & CATALOG ───────────────────────────────────────
    PrimitiveRegistry,
    getDefaultRegistry,
    CatalogExporter,
    PrimitiveValidator,
    ALL_CANONICAL_PRIMITIVES,
    AUTH_PRIMITIVES,
    IDENTITY_KYC_PRIMITIVES,
    DEVICE_PRIMITIVES,
    TRANSACTION_PRIMITIVES,
    MULE_NETWORK_PRIMITIVES,
    ACCOUNT_PRIMITIVES,

    // ── EXECUTION & ADAPTER ──────────────────────────────────────
    SimulatorActionAdapter
};
