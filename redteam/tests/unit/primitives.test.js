// redteam/tests/unit/primitives.test.js
//
// Unit tests for the PrimitiveRegistry and Attack Primitive Library.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { PrimitiveRegistry, getDefaultRegistry } = require("../../src/primitives/registry");
const PRIMITIVES = require("../../src/primitives/primitives");
const { ValidationError } = require("../../../simulator/src/domain/errors");
const { VALID_SIMULATOR_ACTIONS } = require("../../src/schemas/AttackPrimitive");

describe("PrimitiveRegistry", () => {
    it("loads without throwing (all primitives are valid definitions)", () => {
        assert.doesNotThrow(() => new PrimitiveRegistry(PRIMITIVES));
    });

    it("returns the default singleton registry", () => {
        const registry = getDefaultRegistry();
        assert.ok(registry instanceof PrimitiveRegistry);
        assert.ok(registry.size > 0);
    });

    it("contains at least 6 concrete primitives matching M1 actions", () => {
        const registry = getDefaultRegistry();
        const concrete = registry.getConcrete();
        assert.ok(concrete.length >= 6, `Expected >=6 concrete primitives, got ${concrete.length}`);
    });

    it("concrete primitives map to valid M1 simulator_actions only", () => {
        const registry = getDefaultRegistry();
        for (const p of registry.getConcrete()) {
            assert.ok(
                VALID_SIMULATOR_ACTIONS.includes(p.simulator_action),
                `${p.primitive_id}: simulator_action '${p.simulator_action}' not in M1 action list`
            );
        }
    });

    it("abstract primitives all have null simulator_action", () => {
        const registry = getDefaultRegistry();
        for (const p of registry.getAbstract()) {
            assert.equal(p.simulator_action, null, `${p.primitive_id} is abstract but has non-null simulator_action`);
        }
    });

    it("has() returns true for known primitives", () => {
        const registry = getDefaultRegistry();
        assert.ok(registry.has("PRIM_ADD_MULE_BENEFICIARY"));
        assert.ok(registry.has("PRIM_EXECUTE_FRAUDULENT_TRANSFER"));
        assert.ok(registry.has("PRIM_ACCOUNT_TAKEOVER_LOGIN"));
        assert.ok(registry.has("PRIM_REGISTER_SPOOFED_DEVICE"));
        assert.ok(registry.has("PRIM_TAMPER_KYC_VERIFICATION"));
        assert.ok(registry.has("PRIM_MANIPULATE_ACCOUNT_STATUS"));
    });

    it("has() returns false for unknown primitive", () => {
        const registry = getDefaultRegistry();
        assert.equal(registry.has("PRIM_DOES_NOT_EXIST"), false);
    });

    it("get() returns null for unknown primitive", () => {
        const registry = getDefaultRegistry();
        assert.equal(registry.get("PRIM_NONEXISTENT"), null);
    });

    it("get() returns the correct primitive definition", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_ADD_MULE_BENEFICIARY");
        assert.ok(p);
        assert.equal(p.primitive_id, "PRIM_ADD_MULE_BENEFICIARY");
        assert.equal(p.simulator_action, "ADD_BENEFICIARY");
        assert.equal(p.is_abstract, false);
    });

    it("assertExecutable() throws for unknown primitive_id", () => {
        const registry = getDefaultRegistry();
        assert.throws(
            () => registry.assertExecutable("PRIM_NONEXISTENT"),
            ValidationError
        );
    });

    it("assertExecutable() throws for abstract primitive", () => {
        const registry = getDefaultRegistry();
        assert.throws(
            () => registry.assertExecutable("PRIM_OTP_INTERCEPT"),
            ValidationError
        );
    });

    it("assertExecutable() passes for all concrete primitives", () => {
        const registry = getDefaultRegistry();
        for (const p of registry.getConcrete()) {
            assert.doesNotThrow(() => registry.assertExecutable(p.primitive_id));
        }
    });

    it("assertParametersSatisfied() passes when all required params provided", () => {
        const registry = getDefaultRegistry();
        assert.doesNotThrow(() =>
            registry.assertParametersSatisfied("PRIM_ADD_MULE_BENEFICIARY", {
                user_id: "usr_001",
                target_account_id: "acc_001"
            })
        );
    });

    it("assertParametersSatisfied() throws when required params are missing", () => {
        const registry = getDefaultRegistry();
        assert.throws(
            () => registry.assertParametersSatisfied("PRIM_ADD_MULE_BENEFICIARY", {
                user_id: "usr_001"
                // target_account_id missing
            }),
            ValidationError
        );
    });

    it("assertParametersSatisfied() throws when params are null", () => {
        const registry = getDefaultRegistry();
        assert.throws(
            () => registry.assertParametersSatisfied("PRIM_ADD_MULE_BENEFICIARY", {
                user_id: null,
                target_account_id: null
            }),
            ValidationError
        );
    });

    it("rejects duplicate primitive_id in definitions", () => {
        const duplicates = [PRIMITIVES[0], { ...PRIMITIVES[0] }];
        assert.throws(() => new PrimitiveRegistry(duplicates), ValidationError);
    });

    it("toSnapshot() returns all primitives including abstract", () => {
        const registry = getDefaultRegistry();
        const snapshot = registry.toSnapshot();
        assert.ok(Array.isArray(snapshot));
        assert.equal(snapshot.length, registry.size);
    });

    it("PRIM_EXECUTE_FRAUDULENT_TRANSFER maps to PERFORM_TRANSACTION", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_EXECUTE_FRAUDULENT_TRANSFER");
        assert.equal(p.simulator_action, "PERFORM_TRANSACTION");
    });

    it("PRIM_ACCOUNT_TAKEOVER_LOGIN maps to SIMULATE_LOGIN", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_ACCOUNT_TAKEOVER_LOGIN");
        assert.equal(p.simulator_action, "SIMULATE_LOGIN");
    });

    it("PRIM_REGISTER_SPOOFED_DEVICE maps to REGISTER_DEVICE", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_REGISTER_SPOOFED_DEVICE");
        assert.equal(p.simulator_action, "REGISTER_DEVICE");
    });

    it("PRIM_TAMPER_KYC_VERIFICATION maps to UPDATE_KYC", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_TAMPER_KYC_VERIFICATION");
        assert.equal(p.simulator_action, "UPDATE_KYC");
    });

    it("PRIM_MANIPULATE_ACCOUNT_STATUS maps to CHANGE_ACCOUNT_STATUS", () => {
        const registry = getDefaultRegistry();
        const p = registry.get("PRIM_MANIPULATE_ACCOUNT_STATUS");
        assert.equal(p.simulator_action, "CHANGE_ACCOUNT_STATUS");
    });
});
