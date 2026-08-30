// redteam/tests/unit/serializer.test.js
//
// Unit tests for ScenarioSerializer (serialization, deserialization, export/import bundles).

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { ScenarioSerializer, BUNDLE_VERSION } = require("../../src/composer/ScenarioSerializer");
const { ValidationError } = require("../../../simulator/src/domain/errors");

function makeValidScenario(overrides = {}) {
    return {
        scenario_id: "e4d3c2b1-a098-4765-b321-fedcba987654",
        name: "Serialization Test Scenario",
        description: "Test description for serialization",
        attack_family: "ACCOUNT_TAKEOVER",
        severity: "HIGH",
        strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
        simulation_id: "sim_test_001",
        experiment_id: "exp_test_001",
        target_entities: {
            user_ids: ["usr_001"],
            account_ids: ["acc_001"],
            device_ids: null,
            merchant_ids: null
        },
        steps: [
            {
                step_id: "step_000",
                step_index: 0,
                primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                parameters: { user_id: "usr_001", device_type: "MOBILE" },
                delay_ms: null,
                depends_on: null,
                on_failure: "ABORT",
                max_retries: 0,
                description: "Register device"
            }
        ],
        max_duration_ms: null,
        requires_seeded_data: true,
        generated_by: "STRATEGY_LIBRARY",
        planner_model: null,
        generation_timestamp: "2026-08-31T00:00:00.000Z",
        status: "VALIDATED",
        validation_errors: null,
        version: "1.0.0",
        tags: ["serialization-test"],
        ...overrides
    };
}

describe("ScenarioSerializer", () => {
    it("serializes valid scenario to formatted JSON string", () => {
        const scenario = makeValidScenario();
        const jsonStr = ScenarioSerializer.serialize(scenario, true);
        assert.equal(typeof jsonStr, "string");
        assert.ok(jsonStr.includes("Serialization Test Scenario"));
    });

    it("serializes to compact JSON when pretty=false", () => {
        const scenario = makeValidScenario();
        const jsonStr = ScenarioSerializer.serialize(scenario, false);
        assert.ok(!jsonStr.includes("\n"));
    });

    it("serialize() throws on invalid scenario", () => {
        assert.throws(
            () => ScenarioSerializer.serialize({ name: "Incomplete" }),
            ValidationError
        );
    });

    it("deserializes valid JSON string back into AttackScenario object", () => {
        const original = makeValidScenario();
        const jsonStr = ScenarioSerializer.serialize(original);
        const restored = ScenarioSerializer.deserialize(jsonStr);

        assert.deepEqual(restored, original);
    });

    it("deserialize() throws on malformed JSON string", () => {
        assert.throws(
            () => ScenarioSerializer.deserialize("{ broken json"),
            ValidationError
        );
    });

    it("deserialize() throws on empty string", () => {
        assert.throws(
            () => ScenarioSerializer.deserialize(""),
            ValidationError
        );
    });

    it("deserialize() throws on JSON that violates AttackScenario schema", () => {
        const invalidJson = JSON.stringify({
            scenario_id: "not-a-uuid",
            name: "Bad"
        });
        assert.throws(
            () => ScenarioSerializer.deserialize(invalidJson),
            ValidationError
        );
    });

    it("exportBundle() creates a valid bundle with metadata and scenarios", () => {
        const s1 = makeValidScenario({ scenario_id: "11111111-2222-3333-4444-555555555555" });
        const s2 = makeValidScenario({ scenario_id: "66666666-7777-8888-9999-000000000000" });

        const bundle = ScenarioSerializer.exportBundle([s1, s2], {
            bundle_id: "sec_eval_bundle_01",
            description: "Security benchmark eval suite",
            tags: ["benchmark", "ato"]
        });

        assert.equal(bundle.bundle_id, "sec_eval_bundle_01");
        assert.equal(bundle.bundle_version, BUNDLE_VERSION);
        assert.equal(bundle.total_scenarios, 2);
        assert.equal(bundle.scenarios.length, 2);
        assert.ok(bundle.exported_at);
    });

    it("exportBundle() throws on empty scenario list", () => {
        assert.throws(
            () => ScenarioSerializer.exportBundle([]),
            ValidationError
        );
    });

    it("importBundle() imports and validates bundle from object", () => {
        const s1 = makeValidScenario({ scenario_id: "11111111-2222-3333-4444-555555555555" });
        const bundle = ScenarioSerializer.exportBundle([s1]);

        const imported = ScenarioSerializer.importBundle(bundle);
        assert.equal(imported.length, 1);
        assert.equal(imported[0].scenario_id, "11111111-2222-3333-4444-555555555555");
    });

    it("importBundle() imports and validates bundle from JSON string", () => {
        const s1 = makeValidScenario({ scenario_id: "11111111-2222-3333-4444-555555555555" });
        const bundleJson = JSON.stringify(ScenarioSerializer.exportBundle([s1]));

        const imported = ScenarioSerializer.importBundle(bundleJson);
        assert.equal(imported.length, 1);
    });

    it("importBundle() throws on invalid scenario within bundle", () => {
        const badBundle = {
            bundle_id: "bad_bundle",
            scenarios: [
                { scenario_id: "not-valid" }
            ]
        };
        assert.throws(
            () => ScenarioSerializer.importBundle(badBundle),
            ValidationError
        );
    });
});
