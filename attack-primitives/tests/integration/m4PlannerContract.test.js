// attack-primitives/tests/integration/m4PlannerContract.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { getDefaultRegistry } = require("../../src/registry/PrimitiveRegistry");
const CatalogExporter = require("../../src/registry/CatalogExporter");
const { ParameterConstraintError } = require("../../src/domain/errors");

describe("M3 ↔ M4 GenAI Planner Contract Integration Tests", () => {
    const registry = getDefaultRegistry();
    const exporter = new CatalogExporter(registry);

    it("should export LLM prompt injection catalog with compact parameter schemas", () => {
        const promptCatalog = exporter.exportForLLMPrompt({ concreteOnly: true });

        assert.ok(Array.isArray(promptCatalog));
        assert.ok(promptCatalog.length >= 8);

        const transferDef = promptCatalog.find(p => p.id === "PRIM_EXECUTE_FRAUDULENT_TRANSFER");
        assert.ok(transferDef);
        assert.strictEqual(transferDef.simulator_action, "PERFORM_TRANSACTION");
        assert.ok(transferDef.parameters.some(p => p.name === "amount" && p.required === true));
    });

    it("should validate LLM generated step parameters and detect hallucinations", () => {
        const prim = registry.get("PRIM_EXECUTE_FRAUDULENT_TRANSFER");

        // 1. Valid LLM generated step params
        const validLLMParams = {
            sender_account_id: "acc_victim_10",
            receiver_account_id: "acc_mule_10",
            initiator_user_id: "usr_victim_10",
            amount: 5000.00,
            channel: "MOBILE_APP"
        };
        const validated = prim.validateParameters(validLLMParams);
        assert.strictEqual(validated.amount, 5000.00);

        // 2. Hallucinated missing required parameter
        const hallucinatedParams = {
            sender_account_id: "acc_victim_10",
            amount: 5000.00
            // missing receiver_account_id & initiator_user_id
        };
        assert.throws(() => {
            prim.validateParameters(hallucinatedParams);
        }, ParameterConstraintError);

        // 3. Hallucinated invalid enum channel
        const invalidEnumParams = {
            ...validLLMParams,
            channel: "TELEPATHY_CHANNEL"
        };
        assert.throws(() => {
            prim.validateParameters(invalidEnumParams);
        }, ParameterConstraintError);
    });
});
