// redteam/src/composer/ScenarioSerializer.js
//
// ScenarioSerializer — handles serialization, deserialization, export, and import
// of AttackScenario artifacts and bundles.
//
// Guarantees:
//  - Strictly validates data against AttackScenario contract on deserialization.
//  - Enforces schema version compatibility.
//  - Supports multi-scenario experiment bundles.

"use strict";

const { validateAttackScenario } = require("../schemas/AttackScenario");
const { ValidationError } = require("../../../simulator/src/domain/errors");

const BUNDLE_VERSION = "1.0.0";

class ScenarioSerializer {
    /**
     * Serialize an AttackScenario to a JSON string.
     * @param {object} scenario - Validated AttackScenario
     * @param {boolean} [pretty=true]
     * @returns {string}
     */
    static serialize(scenario, pretty = true) {
        validateAttackScenario(scenario);
        return pretty ? JSON.stringify(scenario, null, 2) : JSON.stringify(scenario);
    }

    /**
     * Deserialize a JSON string into an AttackScenario.
     * Validates structure and schema rules.
     * @param {string} jsonString
     * @returns {object} Validated AttackScenario
     */
    static deserialize(jsonString) {
        if (typeof jsonString !== "string" || !jsonString.trim()) {
            throw new ValidationError("ScenarioSerializer.deserialize requires a non-empty JSON string.");
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (err) {
            throw new ValidationError(`ScenarioSerializer: invalid JSON string: ${err.message}`);
        }

        validateAttackScenario(parsed);
        return parsed;
    }

    /**
     * Package multiple AttackScenarios into an experiment export bundle.
     * @param {object[]} scenarios - Array of validated AttackScenarios
     * @param {object} [metadata={}] - Optional metadata (experiment name, tags, description)
     * @returns {object} Canonical ScenarioBundle
     */
    static exportBundle(scenarios, metadata = {}) {
        if (!Array.isArray(scenarios) || scenarios.length === 0) {
            throw new ValidationError("ScenarioSerializer.exportBundle requires a non-empty array of scenarios.");
        }

        for (const s of scenarios) {
            validateAttackScenario(s);
        }

        return {
            bundle_id: metadata.bundle_id || `bundle_${Date.now()}`,
            bundle_version: BUNDLE_VERSION,
            exported_at: new Date().toISOString(),
            description: metadata.description || "Adversarial Attack Scenario Export Bundle",
            tags: metadata.tags || [],
            total_scenarios: scenarios.length,
            scenarios: scenarios.map(s => ({ ...s }))
        };
    }

    /**
     * Parse and validate an experiment bundle.
     * @param {object|string} bundleData - Bundle object or JSON string
     * @returns {object[]} Array of validated AttackScenarios
     */
    static importBundle(bundleData) {
        let bundle = bundleData;
        if (typeof bundleData === "string") {
            try {
                bundle = JSON.parse(bundleData);
            } catch (err) {
                throw new ValidationError(`ScenarioSerializer.importBundle: invalid JSON: ${err.message}`);
            }
        }

        if (!bundle || typeof bundle !== "object") {
            throw new ValidationError("ScenarioSerializer.importBundle: bundle must be a non-null object.");
        }

        if (!Array.isArray(bundle.scenarios) || bundle.scenarios.length === 0) {
            throw new ValidationError("ScenarioSerializer.importBundle: bundle contains no scenarios.");
        }

        const validScenarios = [];
        for (let i = 0; i < bundle.scenarios.length; i++) {
            const scenario = bundle.scenarios[i];
            try {
                validateAttackScenario(scenario);
                validScenarios.push(scenario);
            } catch (err) {
                throw new ValidationError(`ScenarioSerializer.importBundle: scenario[${i}] is invalid: ${err.message}`);
            }
        }

        return validScenarios;
    }
}

module.exports = {
    ScenarioSerializer,
    BUNDLE_VERSION
};
