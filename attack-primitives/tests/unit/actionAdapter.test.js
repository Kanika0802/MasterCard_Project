// attack-primitives/tests/unit/actionAdapter.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const SimulatorActionAdapter = require("../../src/execution/SimulatorActionAdapter");
const { getDefaultRegistry } = require("../../src/registry/PrimitiveRegistry");
const { ActionMappingError } = require("../../src/domain/errors");

describe("M3 SimulatorActionAdapter Unit Tests", () => {
    const adapter = new SimulatorActionAdapter(getDefaultRegistry());

    it("should adapt concrete transfer primitive into canonical M1 Action Request", () => {
        const req = adapter.toActionRequest("PRIM_EXECUTE_FRAUDULENT_TRANSFER", {
            sender_account_id: "acc_victim_01",
            receiver_account_id: "acc_mule_01",
            initiator_user_id: "usr_victim_01",
            amount: 7500.00
        }, {
            simulation_id: "sim_test_01",
            experiment_id: "exp_test_01",
            step_id: "step_004"
        });

        assert.strictEqual(req.action, "PERFORM_TRANSACTION");
        assert.strictEqual(req.simulation_id, "sim_test_01");
        assert.strictEqual(req.adversarial_metadata.primitive_id, "PRIM_EXECUTE_FRAUDULENT_TRANSFER");
        assert.strictEqual(req.adversarial_metadata.step_id, "step_004");
        assert.strictEqual(req.parameters.amount, 7500.00);
        assert.strictEqual(req.parameters.currency, "USD"); // default applied
    });

    it("should adapt device spoofing primitive into M1 REGISTER_DEVICE request", () => {
        const req = adapter.toActionRequest("PRIM_REGISTER_SPOOFED_DEVICE", {
            user_id: "usr_victim_01",
            device_type: "MOBILE",
            ip_address: "198.51.100.22"
        });

        assert.strictEqual(req.action, "REGISTER_DEVICE");
        assert.strictEqual(req.parameters.user_id, "usr_victim_01");
        assert.strictEqual(req.parameters.operating_system, "Android 14"); // default applied
    });

    it("should reject adapting an abstract primitive to simulator action", () => {
        assert.throws(() => {
            adapter.toActionRequest("PRIM_OTP_INTERCEPTION_ATTEMPT", { user_id: "usr_1" });
        }, ActionMappingError);
    });

    it("should resolve action names correctly", () => {
        assert.strictEqual(adapter.resolveAction("PRIM_ADD_MULE_BENEFICIARY"), "ADD_BENEFICIARY");
        assert.strictEqual(adapter.resolveAction("PRIM_TAMPER_KYC_VERIFICATION"), "UPDATE_KYC");
        assert.strictEqual(adapter.resolveAction("PRIM_MANIPULATE_ACCOUNT_STATUS"), "CHANGE_ACCOUNT_STATUS");
    });
});
