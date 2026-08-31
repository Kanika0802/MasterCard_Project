// attack-primitives/tests/integration/m1ActionCompatibility.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { getDefaultRegistry } = require("../../src/registry/PrimitiveRegistry");
const SimulatorActionAdapter = require("../../src/execution/SimulatorActionAdapter");
const { ValidSimulatorActions } = require("../../src/domain/constants");

describe("M3 ↔ M1 Action API Integration Compatibility Tests", () => {
    const registry = getDefaultRegistry();
    const adapter = new SimulatorActionAdapter(registry);

    it("every concrete primitive in M3 must produce a valid M1 Action request envelope", () => {
        const concretePrimitives = registry.getConcrete();
        assert.ok(concretePrimitives.length >= 8);

        const sampleParams = {
            user_id: "usr_compat_01",
            initiator_user_id: "usr_compat_01",
            sender_account_id: "acc_compat_01",
            receiver_account_id: "acc_compat_02",
            target_account_id: "acc_compat_02",
            account_id: "acc_compat_01",
            amount: 100.00,
            status: "ACTIVE",
            verification_status: "VERIFIED"
        };

        for (const prim of concretePrimitives) {
            const req = adapter.toActionRequest(prim, sampleParams, {
                simulation_id: "sim_compat_001",
                experiment_id: "exp_compat_001",
                step_id: "step_001"
            });

            // Verify envelope fields
            assert.ok(ValidSimulatorActions.includes(req.action));
            assert.strictEqual(req.simulation_id, "sim_compat_001");
            assert.strictEqual(req.experiment_id, "exp_compat_001");
            assert.ok(req.adversarial_metadata);
            assert.strictEqual(req.adversarial_metadata.primitive_id, prim.primitive_id);
            assert.strictEqual(req.adversarial_metadata.attack_family, prim.attack_family);
            assert.ok(req.parameters);
        }
    });
});
