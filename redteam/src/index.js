// redteam/src/index.js
//
// M2 Red Team Attack Intelligence — Public API
//
// ══════════════════════════════════════════════════════════════
//  PERSON 1 INTEGRATION SURFACE
//  Person 1's AttackOrchestrator should only need:
//
//    const { ScenarioHandler } = require("./redteam/src/index");
//    const handler = new ScenarioHandler();
//    handler.assertConsumable(scenario);
//    const req = handler.toActionRequest(scenario, step);
//
//  See INTEGRATION_CONTRACT.md for the full protocol.
// ══════════════════════════════════════════════════════════════

"use strict";

// Person 1 integration facade
const { ScenarioHandler, SUPPORTED_SCENARIO_VERSION } = require("./ScenarioHandler");

// Schemas
const { validateAttackPrimitive, VALID_SIMULATOR_ACTIONS, VALID_CATEGORIES } = require("./schemas/AttackPrimitive");
const { validateAttackStep, VALID_ON_FAILURE } = require("./schemas/AttackStep");
const { validateAttackScenario, VALID_SEVERITY, VALID_STATUS, VALID_GENERATED_BY } = require("./schemas/AttackScenario");
const { validateAttackStrategy } = require("./schemas/AttackStrategy");
const { validatePlannerInput } = require("./schemas/PlannerInput");
const { validatePlannerOutputShape } = require("./schemas/PlannerOutput");

// Registries
const { PrimitiveRegistry, getDefaultRegistry: getDefaultPrimitiveRegistry } = require("./primitives/registry");
const { StrategyRegistry, getDefaultRegistry: getDefaultStrategyRegistry } = require("./strategies/registry");

// Core components
const { ScenarioValidator } = require("./validation/ScenarioValidator");
const { AttackComposer } = require("./composer/AttackComposer");
const { PlannerInterface } = require("./planner/PlannerInterface");
const { RuleBasedPlanner } = require("./planner/RuleBasedPlanner");

module.exports = {
    // ── PERSON 1 INTEGRATION SURFACE (start here) ──────────────
    ScenarioHandler,
    SUPPORTED_SCENARIO_VERSION,

    // ── SCHEMA VALIDATORS ───────────────────────────────────────
    validateAttackPrimitive,
    validateAttackStep,
    validateAttackScenario,
    validateAttackStrategy,
    validatePlannerInput,
    validatePlannerOutputShape,

    // ── CONSTANTS ───────────────────────────────────────────────
    VALID_SIMULATOR_ACTIONS,
    VALID_CATEGORIES,
    VALID_ON_FAILURE,
    VALID_SEVERITY,
    VALID_STATUS,
    VALID_GENERATED_BY,

    // ── REGISTRIES ──────────────────────────────────────────────
    PrimitiveRegistry,
    StrategyRegistry,
    getDefaultPrimitiveRegistry,
    getDefaultStrategyRegistry,

    // ── CORE M2 COMPONENTS ──────────────────────────────────────
    ScenarioValidator,
    AttackComposer,
    PlannerInterface,
    RuleBasedPlanner
};
