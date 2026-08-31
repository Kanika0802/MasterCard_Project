// red-team/tests/attackPolicyValidator.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { AttackPolicyValidator } = require("../src/validator");
const AttackScenario = require("../src/domain/attack/AttackScenario");

describe("AttackPolicyValidator Unit Tests", () => {
    const validator = new AttackPolicyValidator();

    function createValidScenarioData(overrides = {}) {
        return {
            scenario_id: "scn_valid_01",
            version: 1,
            objective: "Simulated credential stuffing attack against synthetic user",
            simulation_id: "sim_test_01",
            experiment_id: "exp_test_01",
            target: {
                entity_type: "user",
                entity_id: "usr_synth_1001"
            },
            steps: [
                {
                    step_id: "step_1",
                    primitive_id: "AUTH_OTP_INTERCEPT_9",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: "usr_synth_1001",
                        success: true
                    },
                    timeout_ms: 3000
                },
                {
                    step_id: "step_2",
                    primitive_id: "NETWORK_MULE_ADD_9",
                    action: "ADD_BENEFICIARY",
                    parameters: {
                        user_id: "usr_synth_1001",
                        target_account_id: "acc_mule_99"
                    },
                    depends_on: ["step_1"],
                    timeout_ms: 4000
                },
                {
                    step_id: "step_3",
                    primitive_id: "TXN_SPLIT_VELOCITY_9",
                    action: "PERFORM_TRANSACTION",
                    parameters: {
                        sender_account_id: "acc_victim_01",
                        receiver_account_id: "acc_mule_99",
                        amount: 1500.00
                    },
                    depends_on: ["step_2"],
                    timeout_ms: 5000
                }
            ],
            metadata: {
                attack_family: "account_takeover",
                generator: "synthetic_planner"
            },
            ...overrides
        };
    }

    it("1. valid scenario passes validation", () => {
        const scenario = createValidScenarioData();
        const result = validator.validate(scenario);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
    });

    it("2. missing simulation_id fails", () => {
        const scenario = createValidScenarioData({ simulation_id: "" });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "MISSING_SIMULATION_ID"));
    });

    it("3. missing experiment_id fails", () => {
        const scenario = createValidScenarioData({ experiment_id: "" });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "MISSING_EXPERIMENT_ID"));
    });

    it("4. unsupported action fails", () => {
        const scenario = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    action: "DROP_DATABASE_TABLE",
                    parameters: {}
                }
            ]
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "UNSUPPORTED_ACTION"));
    });

    it("5. unsupported primitive or primitive/action mismatch fails", () => {
        // Unknown primitive
        const scnUnknownPrim = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    primitive_id: "EXPLOIT_ZERO_DAY_999",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: "usr_1" }
                }
            ]
        });
        const res1 = validator.validate(scnUnknownPrim);
        assert.equal(res1.valid, false);
        assert.ok(res1.errors.some(e => e.code === "UNSUPPORTED_PRIMITIVE"));

        // Mismatched action for primitive
        const scnMismatched = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    primitive_id: "AUTH_OTP_INTERCEPT_9", // only allows SIMULATE_LOGIN
                    action: "PERFORM_TRANSACTION",
                    parameters: { sender_account_id: "acc_1", amount: 100 }
                }
            ]
        });
        const res2 = validator.validate(scnMismatched);
        assert.equal(res2.valid, false);
        assert.ok(res2.errors.some(e => e.code === "PRIMITIVE_ACTION_MISMATCH"));
    });

    it("6. invalid target entity type fails", () => {
        const scenario = createValidScenarioData({
            target: {
                entity_type: "kubernetes_cluster",
                entity_id: "k8s_prod"
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "INVALID_TARGET_ENTITY_TYPE"));
    });

    it("7. empty target entity_id fails", () => {
        const scenario = createValidScenarioData({
            target: {
                entity_type: "account",
                entity_id: "   "
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "EMPTY_TARGET_ENTITY_ID"));
    });

    it("8. malformed action parameters fail (missing required or wrong type)", () => {
        const scenario = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    action: "PERFORM_TRANSACTION",
                    parameters: {
                        sender_account_id: "acc_1",
                        amount: -250 // invalid negative amount
                    }
                }
            ]
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "INVALID_PARAMETER_VALUE"));
    });

    it("9. executable/function parameter fails with EXECUTABLE_PARAMETER_REJECTED", () => {
        const scenario = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    action: "SIMULATE_LOGIN",
                    parameters: {
                        user_id: "usr_1",
                        payload: () => { process.exit(1); }
                    }
                }
            ]
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "EXECUTABLE_PARAMETER_REJECTED"));
    });

    it("10. external URL / infrastructure target fails", () => {
        const scenario = createValidScenarioData({
            target: {
                entity_type: "user",
                entity_id: "https://api.victim-bank.com/v1/users"
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "DANGEROUS_VALUE_REJECTED"));
    });

    it("11. excessive step count fails resource limits", () => {
        const customValidator = new AttackPolicyValidator({
            resourceLimits: { maxSteps: 3 }
        });
        const scenario = createValidScenarioData(); // has 3 steps
        scenario.steps.push({
            step_id: "step_4",
            action: "SIMULATE_LOGIN",
            parameters: { user_id: "usr_1" }
        }); // now 4 steps > 3

        const result = customValidator.validate(scenario);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "EXCESSIVE_STEP_COUNT"));
    });

    it("12. invalid timeout fails", () => {
        const scenario = createValidScenarioData({
            steps: [
                {
                    step_id: "step_1",
                    action: "SIMULATE_LOGIN",
                    parameters: { user_id: "usr_1" },
                    timeout_ms: 999999 // exceeds 60s max
                }
            ]
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "INVALID_TIMEOUT"));
    });

    it("13. scenario attempting to override safety policy fails", () => {
        const scenario = createValidScenarioData({
            constraints: {
                bypass_safety: true,
                allow_unsafe: true
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "SAFETY_OVERRIDE_REJECTED"));
    });

    it("14. invalid dependency semantics fail (cycle detection & missing dependency)", () => {
        // Missing dependency
        const scnMissingDep = createValidScenarioData({
            steps: [
                { step_id: "s1", action: "SIMULATE_LOGIN", parameters: { user_id: "u1" }, depends_on: ["s_nonexistent"] }
            ]
        });
        const res1 = validator.validate(scnMissingDep);
        assert.equal(res1.valid, false);
        assert.ok(res1.errors.some(e => e.code === "NON_EXISTENT_DEPENDENCY"));

        // Self dependency
        const scnSelf = createValidScenarioData({
            steps: [
                { step_id: "s1", action: "SIMULATE_LOGIN", parameters: { user_id: "u1" }, depends_on: ["s1"] }
            ]
        });
        const res2 = validator.validate(scnSelf);
        assert.equal(res2.valid, false);
        assert.ok(res2.errors.some(e => e.code === "SELF_DEPENDENCY"));

        // Circular cycle: s1 -> s2 -> s1
        const scnCycle = createValidScenarioData({
            steps: [
                { step_id: "s1", action: "SIMULATE_LOGIN", parameters: { user_id: "u1" }, depends_on: ["s2"] },
                { step_id: "s2", action: "SIMULATE_LOGIN", parameters: { user_id: "u1" }, depends_on: ["s1"] }
            ]
        });
        const res3 = validator.validate(scnCycle);
        assert.equal(res3.valid, false);
        assert.ok(res3.errors.some(e => e.code === "CIRCULAR_DEPENDENCY"));
    });

    it("15. multiple validation errors are collected and returned together", () => {
        const badScenario = {
            scenario_id: "",
            objective: "",
            simulation_id: "",
            experiment_id: "",
            target: { entity_type: "invalid_type", entity_id: "" },
            steps: [
                { step_id: "", action: "INVALID_ACTION", timeout_ms: -1 }
            ]
        };

        const result = validator.validate(badScenario);
        assert.equal(result.valid, false);
        assert.ok(result.errors.length >= 6, `Expected >= 6 errors, got ${result.errors.length}`);

        const errorCodes = result.errors.map(e => e.code);
        assert.ok(errorCodes.includes("MISSING_SCENARIO_ID"));
        assert.ok(errorCodes.includes("MISSING_OBJECTIVE"));
        assert.ok(errorCodes.includes("MISSING_SIMULATION_ID"));
        assert.ok(errorCodes.includes("MISSING_EXPERIMENT_ID"));
        assert.ok(errorCodes.includes("INVALID_TARGET_ENTITY_TYPE"));
        assert.ok(errorCodes.includes("UNSUPPORTED_ACTION"));
    });

    it("16. valid adversarial metadata passes without error", () => {
        const scenario = createValidScenarioData({
            metadata: {
                attack_family: "credential_stuffing",
                technique: "T1110",
                generator: "llm_planner_v1"
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, true);
    });

    it("17. adversarial metadata cannot bypass validation or include fraud labels", () => {
        const scenario = createValidScenarioData({
            metadata: {
                bypass_safety: true,
                is_fraud: true
            }
        });
        const result = validator.validate(scenario);

        assert.equal(result.valid, false);
        assert.ok(result.errors.some(e => e.code === "SAFETY_OVERRIDE_REJECTED"));
        assert.ok(result.errors.some(e => e.code === "FORBIDDEN_FRAUD_LABEL"));
    });

    it("18. validator performs pure in-memory validation with zero side effects", () => {
        // Track global fetch calls to guarantee no network activity
        let fetchCalled = false;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => {
            fetchCalled = true;
            throw new Error("Network call from validator is forbidden!");
        };

        try {
            const scenario = createValidScenarioData();
            const result = validator.validate(scenario);
            assert.equal(result.valid, true);
            assert.equal(fetchCalled, false, "Validator must never make network calls");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
