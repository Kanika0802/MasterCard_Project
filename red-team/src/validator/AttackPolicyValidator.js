// red-team/src/validator/AttackPolicyValidator.js

const {
    ALLOWED_SIMULATOR_ACTIONS,
    ALLOWED_TARGET_ENTITY_TYPES,
    DEFAULT_PRIMITIVE_CATALOG,
    ACTION_PARAMETER_REQUIREMENTS,
    DEFAULT_RESOURCE_LIMITS,
    DANGEROUS_PATTERNS
} = require("./policyConfig");

const FORBIDDEN_FRAUD_FIELDS = ["fraud_score", "is_fraud", "detection_result", "fraud_label", "risk_score", "blue_team_label"];
const FORBIDDEN_OVERRIDE_FLAGS = ["allow_unsafe", "bypass_safety", "disable_validator", "ignore_policy", "admin_override"];

class AttackPolicyValidator {
    constructor(customConfig = {}) {
        this.allowedActions = new Set(customConfig.allowedActions || ALLOWED_SIMULATOR_ACTIONS);
        this.allowedTargetTypes = new Set(customConfig.allowedTargetTypes || ALLOWED_TARGET_ENTITY_TYPES);
        this.primitiveCatalog = { ...DEFAULT_PRIMITIVE_CATALOG, ...(customConfig.primitiveCatalog || {}) };
        this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...(customConfig.resourceLimits || {}) };
    }

    validate(scenario) {
        const errors = [];
        const warnings = [];

        // 1. Scenario Structure & Basic Type
        if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
            errors.push({
                code: "INVALID_SCENARIO_STRUCTURE",
                message: "Scenario must be a valid non-null object.",
                path: "scenario"
            });
            return { valid: false, errors, warnings };
        }

        // Payload byte size check
        try {
            const serialized = JSON.stringify(scenario);
            if (serialized.length > this.resourceLimits.maxScenarioBytes) {
                errors.push({
                    code: "SCENARIO_SIZE_EXCEEDED",
                    message: `Scenario size (${serialized.length} bytes) exceeds limit of ${this.resourceLimits.maxScenarioBytes} bytes.`,
                    path: "scenario"
                });
            }
        } catch (e) {
            errors.push({
                code: "UNSERIALIZABLE_SCENARIO",
                message: "Scenario could not be serialized to JSON.",
                path: "scenario"
            });
        }

        // 2. Identifiers
        if (!scenario.scenario_id || typeof scenario.scenario_id !== "string" || !scenario.scenario_id.trim()) {
            errors.push({
                code: "MISSING_SCENARIO_ID",
                message: "Scenario requires a non-empty string 'scenario_id'.",
                path: "scenario_id"
            });
        }

        if (!scenario.objective || typeof scenario.objective !== "string" || !scenario.objective.trim()) {
            errors.push({
                code: "MISSING_OBJECTIVE",
                message: "Scenario requires a non-empty string 'objective'.",
                path: "objective"
            });
        }

        // 3. Simulation & Experiment Context
        if (!scenario.simulation_id || typeof scenario.simulation_id !== "string" || !scenario.simulation_id.trim()) {
            errors.push({
                code: "MISSING_SIMULATION_ID",
                message: "Scenario requires a non-empty string 'simulation_id'.",
                path: "simulation_id"
            });
        } else {
            this._validateSyntheticIdentifier(scenario.simulation_id, "simulation_id", errors);
        }

        if (!scenario.experiment_id || typeof scenario.experiment_id !== "string" || !scenario.experiment_id.trim()) {
            errors.push({
                code: "MISSING_EXPERIMENT_ID",
                message: "Scenario requires a non-empty string 'experiment_id'.",
                path: "experiment_id"
            });
        } else {
            this._validateSyntheticIdentifier(scenario.experiment_id, "experiment_id", errors);
        }

        // 4. Scenario-level Target Validation
        if (scenario.target) {
            this._validateTarget(scenario.target, "target", errors);
        }

        // 5. Constraints & Safety Override Attempts
        if (scenario.constraints) {
            this._validateConstraints(scenario.constraints, "constraints", errors);
        }

        // 6. Metadata Validation (Fraud Labels & Bypass Prevention)
        if (scenario.metadata) {
            this._validateMetadata(scenario.metadata, "metadata", errors);
        }

        // 7. Step Count Limits
        if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
            errors.push({
                code: "EMPTY_STEPS",
                message: "Scenario must contain a non-empty array of 'steps'.",
                path: "steps"
            });
            return { valid: errors.length === 0, errors, warnings };
        }

        if (scenario.steps.length > this.resourceLimits.maxSteps) {
            errors.push({
                code: "EXCESSIVE_STEP_COUNT",
                message: `Scenario contains ${scenario.steps.length} steps, exceeding maximum limit of ${this.resourceLimits.maxSteps}.`,
                path: "steps"
            });
        }

        // 8. Individual Steps Validation
        const stepIdSet = new Set();
        const stepMap = new Map();

        for (let i = 0; i < scenario.steps.length; i++) {
            const step = scenario.steps[i];
            const stepPath = `steps[${i}]`;

            if (!step || typeof step !== "object") {
                errors.push({
                    code: "INVALID_STEP_STRUCTURE",
                    message: "Step must be a valid non-null object.",
                    path: stepPath
                });
                continue;
            }

            // Step ID validation & uniqueness
            if (!step.step_id || typeof step.step_id !== "string" || !step.step_id.trim()) {
                errors.push({
                    code: "MISSING_STEP_ID",
                    message: "Step requires a non-empty string 'step_id'.",
                    path: `${stepPath}.step_id`
                });
            } else {
                if (stepIdSet.has(step.step_id)) {
                    errors.push({
                        code: "DUPLICATE_STEP_ID",
                        message: `Duplicate step_id '${step.step_id}' found in scenario.`,
                        path: `${stepPath}.step_id`
                    });
                } else {
                    stepIdSet.add(step.step_id);
                    stepMap.set(step.step_id, step);
                }
            }

            // Action Allowlist Validation
            if (!step.action || typeof step.action !== "string" || !step.action.trim()) {
                errors.push({
                    code: "MISSING_STEP_ACTION",
                    message: "Step requires a non-empty string 'action'.",
                    path: `${stepPath}.action`
                });
            } else if (!this.allowedActions.has(step.action)) {
                errors.push({
                    code: "UNSUPPORTED_ACTION",
                    message: `Unsupported simulator action '${step.action}'. Must be one of: ${Array.from(this.allowedActions).join(", ")}`,
                    path: `${stepPath}.action`
                });
            }

            // Primitive Validation & Compatibility Mapping
            if (step.primitive_id) {
                this._validatePrimitive(step.primitive_id, step.action, stepPath, errors);
            }

            // Step Target Validation
            if (step.target) {
                this._validateTarget(step.target, `${stepPath}.target`, errors);
            }

            // Step Parameters Validation
            this._validateStepParameters(step.action, step.parameters, `${stepPath}.parameters`, errors);

            // Step Timeout Limits
            if (step.timeout_ms !== undefined) {
                if (typeof step.timeout_ms !== "number" || isNaN(step.timeout_ms) ||
                    step.timeout_ms < this.resourceLimits.minTimeoutMs ||
                    step.timeout_ms > this.resourceLimits.maxTimeoutMs) {
                    errors.push({
                        code: "INVALID_TIMEOUT",
                        message: `Step timeout_ms must be between ${this.resourceLimits.minTimeoutMs} and ${this.resourceLimits.maxTimeoutMs}. Given: ${step.timeout_ms}`,
                        path: `${stepPath}.timeout_ms`
                    });
                }
            }

            // Dependencies Format
            if (step.depends_on !== undefined && !Array.isArray(step.depends_on)) {
                errors.push({
                    code: "INVALID_DEPENDS_ON",
                    message: "'depends_on' must be an array of step_id strings.",
                    path: `${stepPath}.depends_on`
                });
            }
        }

        // 9. Semantic Dependency Graph & Cycle Detection (DAG)
        this._validateDependencyGraph(scenario.steps, stepIdSet, errors);

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    _validateTarget(target, path, errors) {
        if (!target || typeof target !== "object") {
            errors.push({
                code: "MALFORMED_TARGET",
                message: "Target must be an object with entity_type and entity_id.",
                path
            });
            return;
        }

        if (!target.entity_type || typeof target.entity_type !== "string" || !this.allowedTargetTypes.has(target.entity_type.toLowerCase())) {
            errors.push({
                code: "INVALID_TARGET_ENTITY_TYPE",
                message: `Target entity_type '${target.entity_type}' is not allowed. Must be one of: ${Array.from(this.allowedTargetTypes).join(", ")}`,
                path: `${path}.entity_type`
            });
        }

        if (!target.entity_id || typeof target.entity_id !== "string" || !target.entity_id.trim()) {
            errors.push({
                code: "EMPTY_TARGET_ENTITY_ID",
                message: "Target entity_id must be a non-empty string.",
                path: `${path}.entity_id`
            });
        } else {
            this._validateSyntheticIdentifier(target.entity_id, `${path}.entity_id`, errors);
        }
    }

    _validatePrimitive(primitiveId, action, path, errors) {
        if (typeof primitiveId !== "string" || !primitiveId.trim()) {
            errors.push({
                code: "INVALID_PRIMITIVE_ID",
                message: "primitive_id must be a non-empty string.",
                path: `${path}.primitive_id`
            });
            return;
        }

        const primitiveDef = this.primitiveCatalog[primitiveId];
        if (!primitiveDef) {
            errors.push({
                code: "UNSUPPORTED_PRIMITIVE",
                message: `Unknown or unsupported primitive_id '${primitiveId}'.`,
                path: `${path}.primitive_id`
            });
            return;
        }

        if (action && !primitiveDef.allowed_actions.includes(action)) {
            errors.push({
                code: "PRIMITIVE_ACTION_MISMATCH",
                message: `Primitive '${primitiveId}' does not permit action '${action}'. Allowed actions: ${primitiveDef.allowed_actions.join(", ")}`,
                path: `${path}.primitive_id`
            });
        }
    }

    _validateStepParameters(action, parameters, path, errors) {
        if (parameters === undefined || parameters === null) {
            parameters = {};
        }

        if (typeof parameters !== "object" || Array.isArray(parameters)) {
            errors.push({
                code: "MALFORMED_PARAMETERS",
                message: "Parameters must be a non-null object.",
                path
            });
            return;
        }

        // Check for function / executable values
        for (const [key, value] of Object.entries(parameters)) {
            const paramPath = `${path}.${key}`;
            if (typeof value === "function") {
                errors.push({
                    code: "EXECUTABLE_PARAMETER_REJECTED",
                    message: `Parameter '${key}' contains an executable function. Arbitrary code execution is forbidden.`,
                    path: paramPath
                });
            } else if (typeof value === "string") {
                this._validateSyntheticIdentifier(value, paramPath, errors, false);
            }
        }

        // Contract requirements per action
        const req = ACTION_PARAMETER_REQUIREMENTS[action];
        if (req) {
            // Check required fields
            for (const requiredKey of req.required) {
                if (parameters[requiredKey] === undefined || parameters[requiredKey] === null || parameters[requiredKey] === "") {
                    errors.push({
                        code: "MISSING_REQUIRED_PARAMETER",
                        message: `Action '${action}' requires parameter '${requiredKey}'.`,
                        path: `${path}.${requiredKey}`
                    });
                }
            }

            // Check field types
            for (const [key, expectedType] of Object.entries(req.types)) {
                const val = parameters[key];
                if (val !== undefined && val !== null) {
                    const actualType = typeof val;
                    if (actualType !== expectedType) {
                        errors.push({
                            code: "INVALID_PARAMETER_TYPE",
                            message: `Parameter '${key}' for action '${action}' must be of type '${expectedType}', got '${actualType}'.`,
                            path: `${path}.${key}`
                        });
                    }
                }
            }

            // Execute custom action validators if any
            if (req.customValidators) {
                for (const validatorFn of req.customValidators) {
                    const err = validatorFn(parameters, path);
                    if (err) errors.push(err);
                }
            }
        }
    }

    _validateDependencyGraph(steps, validStepIds, errors) {
        const adjList = new Map();

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step || !step.step_id) continue;

            const deps = Array.isArray(step.depends_on) ? step.depends_on : [];
            adjList.set(step.step_id, deps);

            for (const depId of deps) {
                if (depId === step.step_id) {
                    errors.push({
                        code: "SELF_DEPENDENCY",
                        message: `Step '${step.step_id}' cannot depend on itself.`,
                        path: `steps[${i}].depends_on`
                    });
                } else if (!validStepIds.has(depId)) {
                    errors.push({
                        code: "NON_EXISTENT_DEPENDENCY",
                        message: `Step '${step.step_id}' depends on non-existent step '${depId}'.`,
                        path: `steps[${i}].depends_on`
                    });
                }
            }
        }

        // Detect cycles via DFS
        const visited = new Set();
        const recStack = new Set();

        const hasCycle = (node, pathArr) => {
            visited.add(node);
            recStack.add(node);

            const neighbors = adjList.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor, [...pathArr, neighbor])) {
                        return true;
                    }
                } else if (recStack.has(neighbor)) {
                    errors.push({
                        code: "CIRCULAR_DEPENDENCY",
                        message: `Circular dependency detected involving steps: ${[...pathArr, neighbor].join(" -> ")}`,
                        path: "steps.depends_on"
                    });
                    return true;
                }
            }

            recStack.delete(node);
            return false;
        };

        for (const stepId of adjList.keys()) {
            if (!visited.has(stepId)) {
                hasCycle(stepId, [stepId]);
            }
        }
    }

    _validateConstraints(constraints, path, errors) {
        if (typeof constraints !== "object" || constraints === null) {
            errors.push({
                code: "INVALID_CONSTRAINTS",
                message: "Constraints must be an object.",
                path
            });
            return;
        }

        for (const [key, value] of Object.entries(constraints)) {
            if (FORBIDDEN_OVERRIDE_FLAGS.includes(key.toLowerCase())) {
                errors.push({
                    code: "SAFETY_OVERRIDE_REJECTED",
                    message: `Constraint '${key}' attempts to override security validator policies. Overrides are strictly rejected.`,
                    path: `${path}.${key}`
                });
            }
            if (FORBIDDEN_FRAUD_FIELDS.includes(key.toLowerCase())) {
                errors.push({
                    code: "FORBIDDEN_FRAUD_LABEL",
                    message: `Constraint '${key}' contains forbidden fraud detection labels. Red Team cannot decide fraud status.`,
                    path: `${path}.${key}`
                });
            }
        }
    }

    _validateMetadata(metadata, path, errors) {
        if (typeof metadata !== "object" || metadata === null) {
            errors.push({
                code: "INVALID_METADATA",
                message: "Metadata must be an object.",
                path
            });
            return;
        }

        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === "function") {
                errors.push({
                    code: "EXECUTABLE_METADATA_REJECTED",
                    message: `Metadata '${key}' contains executable code.`,
                    path: `${path}.${key}`
                });
            }
            if (FORBIDDEN_OVERRIDE_FLAGS.includes(key.toLowerCase())) {
                errors.push({
                    code: "SAFETY_OVERRIDE_REJECTED",
                    message: `Metadata '${key}' attempts to bypass validator policies. Bypass is forbidden.`,
                    path: `${path}.${key}`
                });
            }
            if (FORBIDDEN_FRAUD_FIELDS.includes(key.toLowerCase())) {
                errors.push({
                    code: "FORBIDDEN_FRAUD_LABEL",
                    message: `Metadata '${key}' contains forbidden fraud detection labels.`,
                    path: `${path}.${key}`
                });
            }
        }
    }

    _validateSyntheticIdentifier(value, path, errors, strictInfrastructure = true) {
        if (typeof value !== "string") return;

        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(value)) {
                errors.push({
                    code: "DANGEROUS_VALUE_REJECTED",
                    message: `Value in '${path}' contains unsafe external reference, shell injection, or non-synthetic system identifier: '${value}'`,
                    path
                });
                break;
            }
        }
    }
}

module.exports = AttackPolicyValidator;
