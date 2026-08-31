// red-team/tests/stepOutputResolver.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const StepOutputResolver = require("../src/orchestrator/StepOutputResolver");

describe("StepOutputResolver Unit Tests", () => {
    const mockStepResults = {
        "step_login": {
            step_id: "step_login",
            status: "COMPLETED",
            latency_ms: 45,
            simulator_response: {
                success: true,
                action_id: "act_login_001",
                action_type: "SIMULATE_LOGIN",
                simulation_id: "sim_001",
                experiment_id: "exp_001",
                state_changes: [
                    {
                        entity_type: "auth_event",
                        entity_id: "evt_auth_999",
                        change: "RECORDED",
                        data: {
                            event_id: "evt_auth_999",
                            user_id: "usr_victim_123",
                            device_id: "device_raw_string",
                            success: true,
                            metadata: {
                                ip: "198.51.100.1",
                                auth_score: 98.5
                            }
                        }
                    }
                ]
            }
        },
        "spoofed-device-001": {
            step_id: "spoofed-device-001",
            status: "COMPLETED",
            latency_ms: 120,
            simulator_response: {
                success: true,
                action_id: "act_dev_002",
                action_type: "REGISTER_DEVICE",
                simulation_id: "sim_001",
                experiment_id: "exp_001",
                state_changes: [
                    {
                        entity_type: "device",
                        entity_id: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9",
                        change: "REGISTERED",
                        data: {
                            _id: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9",
                            device_id: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9",
                            user_id: "usr_victim_123",
                            device_type: "MOBILE",
                            fingerprint: "fp_attacker_xyz",
                            tags: ["spoofed", "mobile_app"]
                        }
                    }
                ]
            }
        },
        "add_mule_beneficiary": {
            step_id: "add_mule_beneficiary",
            status: "COMPLETED",
            latency_ms: 60,
            simulator_response: {
                success: true,
                action_id: "act_ben_003",
                action_type: "ADD_BENEFICIARY",
                state_changes: [
                    {
                        entity_type: "beneficiary",
                        entity_id: "ben_uuid_444",
                        change: "CREATED",
                        data: {
                            beneficiary_id: "ben_uuid_444",
                            user_id: "usr_victim_123",
                            target_account_id: "acc_mule_888",
                            nickname: "Trusted Mule"
                        }
                    }
                ]
            }
        }
    };

    const indexedOutputs = {
        "step_login": StepOutputResolver.indexStepOutput(mockStepResults["step_login"]),
        "spoofed-device-001": StepOutputResolver.indexStepOutput(mockStepResults["spoofed-device-001"]),
        "add_mule_beneficiary": StepOutputResolver.indexStepOutput(mockStepResults["add_mule_beneficiary"])
    };

    it("1. indexes step output with shortcuts and full structure", () => {
        const indexed = indexedOutputs["spoofed-device-001"];
        assert.equal(indexed.device_id, "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9");
        assert.equal(indexed.entity_id, "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9");
        assert.equal(indexed.user_id, "usr_victim_123");
        assert.equal(indexed.action_type, "REGISTER_DEVICE");
        assert.equal(indexed.data.device_type, "MOBILE");
        assert.equal(indexed.state_changes.length, 1);
    });

    it("2. resolves top-level property shortcuts", () => {
        const input = {
            device_id: "{{steps.spoofed-device-001.device_id}}",
            user_id: "{{steps.step_login.user_id}}",
            beneficiary_id: "{{steps.add_mule_beneficiary.beneficiary_id}}"
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.deepEqual(resolved, {
            device_id: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9",
            user_id: "usr_victim_123",
            beneficiary_id: "ben_uuid_444"
        });
    });

    it("3. resolves nested object paths and array indices", () => {
        const input = {
            nested_ip: "{{steps.step_login.data.metadata.ip}}",
            tag_first: "{{steps.spoofed-device-001.data.tags[0]}}",
            tag_second_dot: "{{steps.spoofed-device-001.data.tags.1}}",
            state_entity: "{{steps.spoofed-device-001.state_changes[0].entity_id}}"
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.deepEqual(resolved, {
            nested_ip: "198.51.100.1",
            tag_first: "spoofed",
            tag_second_dot: "mobile_app",
            state_entity: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9"
        });
    });

    it("4. preserves complete-value primitive types (number, boolean, object, array)", () => {
        const input = {
            is_successful: "{{steps.step_login.success}}",
            score_num: "{{steps.step_login.data.metadata.auth_score}}",
            tags_array: "{{steps.spoofed-device-001.data.tags}}",
            metadata_obj: "{{steps.step_login.data.metadata}}"
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.strictEqual(resolved.is_successful, true);
        assert.strictEqual(typeof resolved.is_successful, "boolean");
        assert.strictEqual(resolved.score_num, 98.5);
        assert.strictEqual(typeof resolved.score_num, "number");
        assert.deepEqual(resolved.tags_array, ["spoofed", "mobile_app"]);
        assert.deepEqual(resolved.metadata_obj, { ip: "198.51.100.1", auth_score: 98.5 });
    });

    it("5. performs embedded string interpolation", () => {
        const input = {
            idempotency_key: "tx_dev_{{steps.spoofed-device-001.device_id}}_mule_{{steps.add_mule_beneficiary.target_account_id}}",
            header: "Bearer {{steps.step_login.entity_id}}"
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.equal(
            resolved.idempotency_key,
            "tx_dev_4b050f3e-dd1d-4c6d-bee5-787afdc11bb9_mule_acc_mule_888"
        );
        assert.equal(resolved.header, "Bearer evt_auth_999");
    });

    it("6. recursively resolves inside nested objects and arrays", () => {
        const input = {
            parent: {
                level1: {
                    level2: {
                        target: "{{steps.add_mule_beneficiary.target_account_id}}"
                    }
                },
                list: [
                    "static_val",
                    "{{steps.spoofed-device-001.device_id}}",
                    {
                        inner_dev: "{{steps.spoofed-device-001.device_id}}"
                    }
                ]
            }
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.deepEqual(resolved, {
            parent: {
                level1: {
                    level2: {
                        target: "acc_mule_888"
                    }
                },
                list: [
                    "static_val",
                    "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9",
                    {
                        inner_dev: "4b050f3e-dd1d-4c6d-bee5-787afdc11bb9"
                    }
                ]
            }
        });
    });

    it("7. leaves non-template values and literals completely untouched", () => {
        const input = {
            literal_str: "regular string",
            amount: 500,
            flag: false,
            null_val: null,
            undef_val: undefined
        };

        const resolved = StepOutputResolver.resolve(input, indexedOutputs);
        assert.deepEqual(resolved, input);
    });

    it("8. throws clear error when referencing non-existent step", () => {
        const input = {
            target: "{{steps.non_existent_step.device_id}}"
        };

        assert.throws(
            () => StepOutputResolver.resolve(input, indexedOutputs),
            /Unresolved step reference: Step 'non_existent_step' output is not available/
        );
    });

    it("9. throws clear error when referencing undefined property on an existing step", () => {
        const input = {
            target: "{{steps.spoofed-device-001.missing_property_xyz}}"
        };

        assert.throws(
            () => StepOutputResolver.resolve(input, indexedOutputs),
            /Unresolved step reference: Property 'missing_property_xyz' not found in output of step 'spoofed-device-001'/
        );
    });

    it("10. extractReferences correctly extracts all reference metadata", () => {
        const input = {
            dev: "{{steps.spoofed-device-001.device_id}}",
            nested: {
                ben: "Target: {{steps.add_mule_beneficiary.target_account_id}}"
            },
            arr: ["{{steps.step_login.user_id}}"]
        };

        const refs = StepOutputResolver.extractReferences(input);
        assert.equal(refs.length, 3);
        assert.equal(refs[0].step_id, "spoofed-device-001");
        assert.equal(refs[0].path, "device_id");
        assert.equal(refs[1].step_id, "add_mule_beneficiary");
        assert.equal(refs[1].path, "target_account_id");
        assert.equal(refs[2].step_id, "step_login");
        assert.equal(refs[2].path, "user_id");
    });

    it("11. hasReference returns true for template strings and false otherwise", () => {
        assert.equal(StepOutputResolver.hasReference("{{steps.s1.id}}"), true);
        assert.equal(StepOutputResolver.hasReference("prefix {{steps.s1.id}} suffix"), true);
        assert.equal(StepOutputResolver.hasReference("4b050f3e-dd1d-4c6d-bee5-787afdc11bb9"), false);
        assert.equal(StepOutputResolver.hasReference(123), false);
    });
});
