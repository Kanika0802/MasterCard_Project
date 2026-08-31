// attack-primitives/tests/unit/primitiveRegistry.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { PrimitiveRegistry, getDefaultRegistry } = require("../../src/registry/PrimitiveRegistry");
const { PrimitiveCategory, AttackFamily } = require("../../src/domain/constants");
const { PrimitiveValidationError } = require("../../src/domain/errors");

describe("M3 PrimitiveRegistry Unit Tests", () => {

    it("should initialize default registry with all canonical primitives", () => {
        const registry = getDefaultRegistry();
        assert.ok(registry.size() >= 10);
        assert.ok(registry.getConcrete().length >= 8);
        assert.ok(registry.getAbstract().length >= 2);
    });

    it("should lookup primitives by ID, category, family, and action", () => {
        const registry = getDefaultRegistry();

        const p1 = registry.get("PRIM_EXECUTE_FRAUDULENT_TRANSFER");
        assert.ok(p1);
        assert.strictEqual(p1.category, PrimitiveCategory.TRANSACTION);

        const authPrims = registry.getByCategory(PrimitiveCategory.AUTHENTICATION);
        assert.ok(authPrims.length >= 2);

        const mulePrims = registry.getByFamily(AttackFamily.MULE_NETWORK);
        assert.ok(mulePrims.length >= 2);

        const loginPrims = registry.getByAction("SIMULATE_LOGIN");
        assert.ok(loginPrims.length >= 2);
    });

    it("should reject duplicate primitive registration", () => {
        const registry = new PrimitiveRegistry([]);
        const p = getDefaultRegistry().get("PRIM_EXECUTE_FRAUDULENT_TRANSFER");

        registry.register(p);
        assert.throws(() => {
            registry.register(p);
        }, PrimitiveValidationError);
    });
});
