// attack-primitives/tests/unit/primitiveDefinitions.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const ALL_CANONICAL_PRIMITIVES = require("../../src/definitions/catalog");
const AUTH_PRIMITIVES = require("../../src/definitions/authentication");
const IDENTITY_KYC_PRIMITIVES = require("../../src/definitions/identity_kyc");
const DEVICE_PRIMITIVES = require("../../src/definitions/device");
const TRANSACTION_PRIMITIVES = require("../../src/definitions/transaction");
const MULE_NETWORK_PRIMITIVES = require("../../src/definitions/mule_network");
const ACCOUNT_PRIMITIVES = require("../../src/definitions/account");
const { PrimitiveValidator } = require("../../src");

describe("M3 Canonical Primitive Definitions Unit Tests", () => {

    it("should load all canonical primitives without schema errors", () => {
        assert.ok(ALL_CANONICAL_PRIMITIVES.length >= 10);
        for (const prim of ALL_CANONICAL_PRIMITIVES) {
            const validation = PrimitiveValidator.validate(prim);
            assert.strictEqual(validation.valid, true, `Primitive ${prim.primitive_id} failed: ${validation.errors.join(", ")}`);
        }
    });

    it("should contain all required core concrete attack primitives", () => {
        const concreteIds = ALL_CANONICAL_PRIMITIVES.filter(p => !p.is_abstract).map(p => p.primitive_id);

        assert.ok(concreteIds.includes("PRIM_ACCOUNT_TAKEOVER_LOGIN"));
        assert.ok(concreteIds.includes("PRIM_BRUTE_FORCE_LOGIN_BURST"));
        assert.ok(concreteIds.includes("PRIM_TAMPER_KYC_VERIFICATION"));
        assert.ok(concreteIds.includes("PRIM_REGISTER_SPOOFED_DEVICE"));
        assert.ok(concreteIds.includes("PRIM_EXECUTE_FRAUDULENT_TRANSFER"));
        assert.ok(concreteIds.includes("PRIM_RAPID_SPLIT_PAYMENTS"));
        assert.ok(concreteIds.includes("PRIM_ADD_MULE_BENEFICIARY"));
        assert.ok(concreteIds.includes("PRIM_MANIPULATE_ACCOUNT_STATUS"));
    });

    it("should correctly partition primitives by category", () => {
        assert.ok(AUTH_PRIMITIVES.length >= 2);
        assert.ok(IDENTITY_KYC_PRIMITIVES.length >= 2);
        assert.ok(DEVICE_PRIMITIVES.length >= 2);
        assert.ok(TRANSACTION_PRIMITIVES.length >= 2);
        assert.ok(MULE_NETWORK_PRIMITIVES.length >= 2);
        assert.ok(ACCOUNT_PRIMITIVES.length >= 1);
    });

    it("all concrete primitives should map to valid M1 simulator actions", () => {
        const validActions = [
            "ADD_BENEFICIARY",
            "PERFORM_TRANSACTION",
            "SIMULATE_LOGIN",
            "REGISTER_DEVICE",
            "UPDATE_KYC",
            "CHANGE_ACCOUNT_STATUS"
        ];

        for (const prim of ALL_CANONICAL_PRIMITIVES) {
            if (!prim.is_abstract) {
                assert.ok(validActions.includes(prim.simulator_action));
            }
        }
    });
});
