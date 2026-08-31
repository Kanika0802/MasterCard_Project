// red-team/tests/referenceEngineValidation.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const StepOutputResolver = require("../src/orchestrator/StepOutputResolver");
const { AttackOrchestrator } = require("../src/orchestrator");
const { AttackPolicyValidator } = require("../src/validator");
const AttackScenario = require("../src/domain/attack/AttackScenario");
const AttackStep = require("../src/domain/attack/AttackStep");
const ExecutionContext = require("../src/domain/execution/ExecutionContext");
const { ExecutionState, StepExecutionStatus } = require("../src/domain/execution/ExecutionState");

describe("Step-Output Reference Engine Comprehensive Architectural Validation", () => {
    const validator = new AttackPolicyValidator();

    // ── Helper Mock Executor for Pure In-Memory Orchestration Tests ───────────
    class MockAttackExecutor {
        constructor(stepHandlers = {}) {
            this.stepHandlers = stepHandlers;
            this.executedSteps = [];
        }

        async executeStep(step, context) {
            this.executedSteps.push({
                step_id: step.step_id,
                parameters: JSON.parse(JSON.stringify(step.parameters || {})),
                action: step.action
            });

            if (this.stepHandlers[step.step_id]) {
                return this.stepHandlers[step.step_id](step, context);
            }

            // Default mock response with state change data
            return {
                step_id: step.step_id,
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 10,
                simulator_response: {
                    success: true,
                    action_id: `act_${step.step_id}`,
                    action_type: step.action,
                    state_changes: [
                        {
                            entity_type: "generic_entity",
                            entity_id: `id_from_${step.step_id}`,
                            change: "MUTATED",
                            data: {
                                ...(step.parameters || {}),
                                entity_id: `id_from_${step.step_id}`,
                                generated_code: `CODE_${step.step_id}`
                            }
                        }
                    ]
                },
                isSuccess: () => true
            };
        }
    }

    // ── Case 1: Device UUID Propagation ─────────────────────────────────────
    it("1. DEVICE UUID propagation: REGISTER_DEVICE -> PERFORM_TRANSACTION -> {{steps.register-device.device_id}}", async () => {
        const executor = new MockAttackExecutor({
            "register-device": (step) => ({
                step_id: "register-device",
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 15,
                simulator_response: {
                    success: true,
                    action_id: "act_dev_001",
                    action_type: "REGISTER_DEVICE",
                    state_changes: [
                        {
                            entity_type: "device",
                            entity_id: "e4a3b8d1-9f2c-4b6a-8d3e-7a1b2c3d4e5f",
                            change: "REGISTERED",
                            data: {
                                device_id: "e4a3b8d1-9f2c-4b6a-8d3e-7a1b2c3d4e5f",
                                user_id: "usr_synth_001",
                                device_type: "MOBILE"
                            }
                        }
                    ]
                },
                isSuccess: () => true
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case1_device_uuid",
            objective: "Verify device UUID propagation",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "register-device",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    parameters: { user_id: "usr_synth_001", device_type: "MOBILE" }
                }),
                new AttackStep({
                    step_id: "perform-transaction",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["register-device"],
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 100,
                        device_id: "{{steps.register-device.device_id}}"
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps.length, 2);
        assert.equal(
            executor.executedSteps[1].parameters.device_id,
            "e4a3b8d1-9f2c-4b6a-8d3e-7a1b2c3d4e5f"
        );
    });

    // ── Case 2: Nested Output Propagation ────────────────────────────────────
    it("2. Nested output propagation: {{steps.step-1.data.some_nested_value}}", async () => {
        const executor = new MockAttackExecutor({
            "step-1": () => ({
                step_id: "step-1",
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 10,
                simulator_response: {
                    success: true,
                    action_id: "act_001",
                    action_type: "SIMULATE_LOGIN",
                    state_changes: [
                        {
                            entity_type: "auth_event",
                            entity_id: "evt_001",
                            change: "RECORDED",
                            data: {
                                security_profile: {
                                    risk_tier: "CRITICAL_TIER",
                                    geo: { country: "NL", city: "Amsterdam" }
                                }
                            }
                        }
                    ]
                },
                isSuccess: () => true
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case2_nested",
            objective: "Verify nested output propagation",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step-1",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step-2",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    depends_on: ["step-1"],
                    parameters: {
                        user_id: "usr_synth_001",
                        device_fingerprint: "{{steps.step-1.data.security_profile.risk_tier}}",
                        ip_address: "{{steps.step-1.data.security_profile.geo.city}}"
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps[1].parameters.device_fingerprint, "CRITICAL_TIER");
        assert.equal(executor.executedSteps[1].parameters.ip_address, "Amsterdam");
    });

    // ── Case 3: Array Output Propagation ─────────────────────────────────────
    it("3. Array output propagation: {{steps.step-1.state_changes[0].entity_id}}", async () => {
        const executor = new MockAttackExecutor({
            "step-1": () => ({
                step_id: "step-1",
                status: StepExecutionStatus.COMPLETED,
                latency_ms: 10,
                simulator_response: {
                    success: true,
                    action_id: "act_001",
                    action_type: "ADD_BENEFICIARY",
                    state_changes: [
                        {
                            entity_type: "beneficiary",
                            entity_id: "ben_target_999",
                            change: "CREATED",
                            data: { beneficiary_id: "ben_target_999", target_account_id: "acc_dest_777" }
                        }
                    ]
                },
                isSuccess: () => true
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case3_array_index",
            objective: "Verify array index output propagation",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step-1",
                    action: "ADD_BENEFICIARY",
                    primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                    parameters: { user_id: "usr_synth_001", target_account_id: "acc_dest_777" }
                }),
                new AttackStep({
                    step_id: "step-2",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["step-1"],
                    parameters: {
                        sender_account_id: "acc_source_001",
                        receiver_account_id: "{{steps.step-1.state_changes[0].data.target_account_id}}",
                        amount: 250
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps[1].parameters.receiver_account_id, "acc_dest_777");
    });

    // ── Case 4: Primitive Preservation (number, boolean, object) ─────────────
    it("4. Primitive preservation: number, boolean, and object values preserve their exact types", async () => {
        const stepOutputs = {
            "step-1": StepOutputResolver.indexStepOutput({
                status: "COMPLETED",
                simulator_response: {
                    success: true,
                    state_changes: [
                        {
                            data: {
                                amount: 1250.75,
                                is_verified: true,
                                metadata_obj: { key: "value", flag: false }
                            }
                        }
                    ]
                }
            })
        };

        const params = {
            num: "{{steps.step-1.amount}}",
            bool: "{{steps.step-1.is_verified}}",
            obj: "{{steps.step-1.metadata_obj}}"
        };

        const resolved = StepOutputResolver.resolve(params, stepOutputs);
        assert.strictEqual(resolved.num, 1250.75);
        assert.strictEqual(typeof resolved.num, "number");
        assert.strictEqual(resolved.bool, true);
        assert.strictEqual(typeof resolved.bool, "boolean");
        assert.deepEqual(resolved.obj, { key: "value", flag: false });
        assert.strictEqual(typeof resolved.obj, "object");
    });

    // ── Case 5: Embedded String Interpolation ─────────────────────────────────
    it("5. Embedded string interpolation: 'prefix-{{steps.step-1.id}}-suffix'", () => {
        const stepOutputs = {
            "step-1": StepOutputResolver.indexStepOutput({
                status: "COMPLETED",
                simulator_response: {
                    state_changes: [{ data: { id: "98765" } }]
                }
            })
        };

        const resolved = StepOutputResolver.resolve({
            reference_tag: "prefix-{{steps.step-1.id}}-suffix"
        }, stepOutputs);

        assert.equal(resolved.reference_tag, "prefix-98765-suffix");
    });

    // ── Case 6: Multiple References in the Same Parameter Object ─────────────
    it("6. Multiple references in the same parameter object from different steps", async () => {
        const executor = new MockAttackExecutor({
            "step-login": () => ({
                step_id: "step-login",
                status: StepExecutionStatus.COMPLETED,
                simulator_response: {
                    state_changes: [{ data: { user_id: "usr_resolved_001" } }]
                },
                isSuccess: () => true
            }),
            "step-device": () => ({
                step_id: "step-device",
                status: StepExecutionStatus.COMPLETED,
                simulator_response: {
                    state_changes: [{ data: { device_id: "dev_resolved_002" } }]
                },
                isSuccess: () => true
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case6_multiref_obj",
            objective: "Verify multiple references in same parameter object",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step-login",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step-device",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    depends_on: ["step-login"],
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step-txn",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["step-login", "step-device"],
                    parameters: {
                        initiator_user_id: "{{steps.step-login.user_id}}",
                        device_id: "{{steps.step-device.device_id}}",
                        sender_account_id: "acc_001",
                        amount: 100
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        const txnParams = executor.executedSteps[2].parameters;
        assert.equal(txnParams.initiator_user_id, "usr_resolved_001");
        assert.equal(txnParams.device_id, "dev_resolved_002");
    });

    // ── Case 7: Multiple References Inside Arrays ────────────────────────────
    it("7. Multiple references inside arrays", () => {
        const stepOutputs = {
            "s1": StepOutputResolver.indexStepOutput({
                status: "COMPLETED",
                simulator_response: { state_changes: [{ data: { tag: "alpha" } }] }
            }),
            "s2": StepOutputResolver.indexStepOutput({
                status: "COMPLETED",
                simulator_response: { state_changes: [{ data: { tag: "beta" } }] }
            })
        };

        const resolved = StepOutputResolver.resolve({
            tags: ["static_0", "{{steps.s1.tag}}", "{{steps.s2.tag}}", ["nested_{{steps.s1.tag}}"]]
        }, stepOutputs);

        assert.deepEqual(resolved.tags, [
            "static_0",
            "alpha",
            "beta",
            ["nested_alpha"]
        ]);
    });

    // ── Case 8: Transitive Dependencies (A -> B -> C where C references A) ───
    it("8. Transitive dependencies: A -> B -> C where C references output from A", async () => {
        const executor = new MockAttackExecutor({
            "step_A": () => ({
                step_id: "step_A",
                status: StepExecutionStatus.COMPLETED,
                simulator_response: { state_changes: [{ data: { token_a: "secret_token_123" } }] },
                isSuccess: () => true
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case8_transitive",
            objective: "Verify transitive dependency reference propagation",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_A",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step_B",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    depends_on: ["step_A"],
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step_C",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    // step_C directly depends on step_B, transitively depending on step_A
                    depends_on: ["step_B"],
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 50,
                        idempotency_key: "tx_{{steps.step_A.token_a}}"
                    }
                })
            ]
        });

        // Validator must recognize transitive ancestry and accept step_C's reference to step_A
        const validation = validator.validate(scenario);
        assert.equal(validation.valid, true);

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.equal(executor.executedSteps[2].parameters.idempotency_key, "tx_secret_token_123");
    });

    // ── Case 9: Invalid Reference: Nonexistent Step ──────────────────────────
    it("9. Invalid reference: reference to nonexistent step is rejected by validator", () => {
        const scenario = new AttackScenario({
            scenario_id: "scn_case9_nonexistent_ref",
            objective: "Verify rejection of nonexistent step reference",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_1",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 100,
                        device_id: "{{steps.ghost_step.device_id}}"
                    }
                })
            ]
        });

        const validation = validator.validate(scenario);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some(e => e.code === "NON_EXISTENT_STEP_REFERENCE"));
    });

    // ── Case 10: Invalid Dependency: Reference Without Ancestry ──────────────
    it("10. Invalid dependency: step C references step A without declaring dependency or ancestor relationship", () => {
        const scenario = new AttackScenario({
            scenario_id: "scn_case10_undeclared_dep",
            objective: "Verify rejection of reference without dependency declaration",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_A",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step_B",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    // step_B references step_A but depends_on is empty
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 100,
                        device_id: "{{steps.step_A.device_id}}"
                    }
                })
            ]
        });

        const validation = validator.validate(scenario);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some(e => e.code === "UNDECLARED_STEP_DEPENDENCY"));
    });

    // ── Case 11: Self-Reference ──────────────────────────────────────────────
    it("11. Self-reference: step referencing its own output is rejected", () => {
        const scenario = new AttackScenario({
            scenario_id: "scn_case11_self_ref",
            objective: "Verify rejection of self-reference",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_self",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    parameters: {
                        user_id: "usr_synth_001",
                        device_fingerprint: "{{steps.step_self.device_fingerprint}}"
                    }
                })
            ]
        });

        const validation = validator.validate(scenario);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some(e => e.code === "SELF_REFERENCE"));
    });

    // ── Case 12: Failed Upstream Step: Downstream Must Not Execute ───────────
    it("12. Failed upstream step: downstream step referencing upstream output must not execute", async () => {
        const executor = new MockAttackExecutor({
            "step_fail": () => ({
                step_id: "step_fail",
                status: StepExecutionStatus.FAILED,
                error: { code: "DEVICE_REGISTRATION_FAILED", message: "Hardware rejected" },
                isSuccess: () => false
            })
        });

        const orchestrator = new AttackOrchestrator({ validator, executor });
        const scenario = new AttackScenario({
            scenario_id: "scn_case12_fail_fast",
            objective: "Verify fail-fast policy stops execution before dependent steps",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_fail",
                    action: "REGISTER_DEVICE",
                    primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                    parameters: { user_id: "usr_synth_001" }
                }),
                new AttackStep({
                    step_id: "step_downstream",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["step_fail"],
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 100,
                        device_id: "{{steps.step_fail.device_id}}"
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(scenario);
        assert.equal(result.status, ExecutionState.FAILED);
        assert.equal(result.error.failed_step_id, "step_fail");
        // Downstream step was never executed
        assert.equal(executor.executedSteps.length, 1);
        assert.equal(executor.executedSteps[0].step_id, "step_fail");
    });

    // ── Case 13: Backward Compatibility: Literal Parameters ──────────────────
    it("13. Backward compatibility: scenario containing only literal parameters behaves exactly as before", async () => {
        const executor = new MockAttackExecutor();
        const orchestrator = new AttackOrchestrator({ validator, executor });

        const literalScenario = new AttackScenario({
            scenario_id: "scn_case13_literals",
            objective: "Verify backwards compatibility with static literals",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_literal_1",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: {
                        user_id: "usr_fixed_123",
                        device_id: "device_literal_string",
                        success: true
                    }
                }),
                new AttackStep({
                    step_id: "step_literal_2",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["step_literal_1"],
                    parameters: {
                        sender_account_id: "acc_fixed_456",
                        amount: 99.95,
                        currency: "USD"
                    }
                })
            ]
        });

        const result = await orchestrator.executeScenario(literalScenario);
        assert.equal(result.status, ExecutionState.COMPLETED);
        assert.deepEqual(executor.executedSteps[0].parameters, {
            user_id: "usr_fixed_123",
            device_id: "device_literal_string",
            success: true
        });
        assert.deepEqual(executor.executedSteps[1].parameters, {
            sender_account_id: "acc_fixed_456",
            amount: 99.95,
            currency: "USD"
        });
    });

    // ── Case 14: Security: Malformed Templates & Unsafe Paths Rejected ────────
    it("14. Security: malformed templates, unbalanced braces, and prototype traversal are rejected safely", () => {
        // 14a. Prototype traversal
        const protoScenario = new AttackScenario({
            scenario_id: "scn_case14_proto",
            objective: "Verify rejection of prototype traversal",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_1",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_001" }
                }),
                new AttackStep({
                    step_id: "step_2",
                    action: "PERFORM_TRANSACTION",
                    primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                    depends_on: ["step_1"],
                    parameters: {
                        sender_account_id: "acc_001",
                        amount: 10,
                        device_id: "{{steps.step_1.__proto__.polluted}}"
                    }
                })
            ]
        });

        const protoVal = validator.validate(protoScenario);
        assert.equal(protoVal.valid, false);
        assert.ok(protoVal.errors.some(e => e.code === "UNSAFE_REFERENCE_PATH"));

        // 14b. Unbalanced template braces
        const unbalancedScenario = new AttackScenario({
            scenario_id: "scn_case14_unbalanced",
            objective: "Verify rejection of unbalanced braces",
            simulation_id: "sim_test",
            experiment_id: "exp_test",
            steps: [
                new AttackStep({
                    step_id: "step_1",
                    action: "SIMULATE_LOGIN",
                    primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                    parameters: { user_id: "usr_001", device_id: "{{steps.step_1.id" }
                })
            ]
        });

        const unbalVal = validator.validate(unbalancedScenario);
        assert.equal(unbalVal.valid, false);
        assert.ok(unbalVal.errors.some(e => e.code === "MALFORMED_STEP_REFERENCE"));

        // 14c. getPathValue returns undefined on forbidden properties at runtime
        const mockObj = { normal: "safe" };
        assert.equal(StepOutputResolver.getPathValue(mockObj, "__proto__.toString"), undefined);
        assert.equal(StepOutputResolver.getPathValue(mockObj, "constructor.name"), undefined);
        assert.equal(StepOutputResolver.getPathValue(mockObj, "prototype.pollute"), undefined);
    });
});
