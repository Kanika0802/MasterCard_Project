// attack-primitives/src/domain/AttackPrimitive.js
"use strict";

const {
    PrimitiveCategory,
    AttackFamily,
    ImpactSeverity,
    ExecutionType,
    ValidSimulatorActions
} = require("./constants");
const { PrimitiveValidationError } = require("./errors");
const ParameterDefinition = require("./ParameterDefinition");
const StateTransition = require("./StateTransition");

const PRIMITIVE_ID_REGEX = /^PRIM_[A-Z0-9_]+$/;

class AttackPrimitive {
    constructor({
        primitive_id,
        name,
        description,
        category,
        attack_family,
        execution_type = ExecutionType.CONCRETE,
        simulator_action = null,
        parameters = [],
        expected_success_events = [],
        expected_failure_events = [],
        state_transition = null,
        mitre_attack_id = null,
        stealth_score = 3,
        detection_risk = 0.5,
        financial_impact_severity = ImpactSeverity.MEDIUM,
        tags = [],
        version = "1.0.0"
    }) {
        // --- 1. Primitive ID & Basic Metadata ---
        if (!primitive_id || typeof primitive_id !== "string" || !PRIMITIVE_ID_REGEX.test(primitive_id)) {
            throw new PrimitiveValidationError(
                `AttackPrimitive: invalid 'primitive_id' '${primitive_id}'. Must match pattern PRIM_[A-Z0-9_]+`
            );
        }
        if (!name || typeof name !== "string") {
            throw new PrimitiveValidationError(`AttackPrimitive '${primitive_id}': 'name' must be a non-empty string.`);
        }
        if (!description || typeof description !== "string") {
            throw new PrimitiveValidationError(`AttackPrimitive '${primitive_id}': 'description' must be a non-empty string.`);
        }

        // --- 2. Categorization & Families ---
        if (!category || !Object.values(PrimitiveCategory).includes(category)) {
            throw new PrimitiveValidationError(
                `AttackPrimitive '${primitive_id}': invalid category '${category}'. Valid: ${Object.values(PrimitiveCategory).join(", ")}`
            );
        }
        if (!attack_family || !Object.values(AttackFamily).includes(attack_family)) {
            throw new PrimitiveValidationError(
                `AttackPrimitive '${primitive_id}': invalid attack_family '${attack_family}'. Valid: ${Object.values(AttackFamily).join(", ")}`
            );
        }

        // --- 3. Execution Type & M1 Action Mapping ---
        const isConcrete = execution_type === ExecutionType.CONCRETE;
        if (isConcrete) {
            if (!simulator_action || !ValidSimulatorActions.includes(simulator_action)) {
                throw new PrimitiveValidationError(
                    `AttackPrimitive '${primitive_id}': concrete primitive must define a valid simulator_action. Valid: ${ValidSimulatorActions.join(", ")}`
                );
            }
        } else {
            if (simulator_action !== null) {
                throw new PrimitiveValidationError(
                    `AttackPrimitive '${primitive_id}': abstract primitive must have simulator_action = null.`
                );
            }
        }

        // --- 4. Parameters Mapping ---
        const paramDefs = [];
        if (Array.isArray(parameters)) {
            for (const p of parameters) {
                paramDefs.push(p instanceof ParameterDefinition ? p : new ParameterDefinition(p));
            }
        }
        this.parameters = Object.freeze(paramDefs);

        // --- 5. Telemetry & State Transitions ---
        this.expected_success_events = Object.freeze(Array.isArray(expected_success_events) ? [...expected_success_events] : []);
        this.expected_failure_events = Object.freeze(Array.isArray(expected_failure_events) ? [...expected_failure_events] : []);
        this.state_transition = state_transition instanceof StateTransition
            ? state_transition
            : new StateTransition(state_transition || {});

        // --- 6. Impact & Risk Metadata ---
        this.primitive_id = primitive_id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.attack_family = attack_family;
        this.execution_type = execution_type;
        this.is_abstract = !isConcrete;
        this.simulator_action = simulator_action;
        this.mitre_attack_id = mitre_attack_id;
        this.stealth_score = Math.max(1, Math.min(5, Number(stealth_score) || 3));
        this.detection_risk = Math.max(0.0, Math.min(1.0, Number(detection_risk) || 0.5));
        this.financial_impact_severity = financial_impact_severity;
        this.tags = Object.freeze(Array.isArray(tags) ? [...tags] : []);
        this.version = version;

        Object.freeze(this);
    }

    /**
     * Validate parameter inputs against the primitive's parameter contract
     */
    validateParameters(inputParams = {}) {
        const validated = {};
        for (const paramDef of this.parameters) {
            const val = inputParams[paramDef.name];
            validated[paramDef.name] = paramDef.validate(val);
        }
        return validated;
    }

    toJSON() {
        return {
            primitive_id: this.primitive_id,
            name: this.name,
            description: this.description,
            category: this.category,
            attack_family: this.attack_family,
            execution_type: this.execution_type,
            is_abstract: this.is_abstract,
            simulator_action: this.simulator_action,
            parameters: this.parameters.map(p => p.toJSON()),
            expected_success_events: this.expected_success_events,
            expected_failure_events: this.expected_failure_events,
            state_transition: this.state_transition.toJSON(),
            mitre_attack_id: this.mitre_attack_id,
            stealth_score: this.stealth_score,
            detection_risk: this.detection_risk,
            financial_impact_severity: this.financial_impact_severity,
            tags: this.tags,
            version: this.version
        };
    }
}

module.exports = AttackPrimitive;
