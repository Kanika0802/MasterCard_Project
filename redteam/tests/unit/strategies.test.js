// redteam/tests/unit/strategies.test.js
//
// Unit tests for the StrategyRegistry and Attack Strategy Library.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { StrategyRegistry, getDefaultRegistry } = require("../../src/strategies/registry");
const STRATEGIES = require("../../src/strategies/strategies");
const { ValidationError } = require("../../../simulator/src/domain/errors");

describe("StrategyRegistry", () => {
    it("loads all strategies without throwing", () => {
        assert.doesNotThrow(() => new StrategyRegistry(STRATEGIES));
    });

    it("returns a working default singleton registry", () => {
        const registry = getDefaultRegistry();
        assert.ok(registry instanceof StrategyRegistry);
        assert.ok(registry.size >= 4, `Expected >=4 strategies, got ${registry.size}`);
    });

    it("has() returns true for known strategies", () => {
        const registry = getDefaultRegistry();
        assert.ok(registry.has("STRAT_ATO_NEW_DEVICE_FUND_DRAIN"));
        assert.ok(registry.has("STRAT_VELOCITY_FUND_DRAIN"));
        assert.ok(registry.has("STRAT_KYC_BYPASS_FUND_TRANSFER"));
        assert.ok(registry.has("STRAT_BRUTE_FORCE_THEN_FREEZE"));
    });

    it("has() returns false for unknown strategy", () => {
        const registry = getDefaultRegistry();
        assert.equal(registry.has("STRAT_NONEXISTENT"), false);
    });

    it("get() returns null for unknown strategy", () => {
        const registry = getDefaultRegistry();
        assert.equal(registry.get("STRAT_NONEXISTENT"), null);
    });

    it("get() returns the correct strategy", () => {
        const registry = getDefaultRegistry();
        const s = registry.get("STRAT_ATO_NEW_DEVICE_FUND_DRAIN");
        assert.ok(s);
        assert.equal(s.strategy_id, "STRAT_ATO_NEW_DEVICE_FUND_DRAIN");
        assert.equal(s.attack_family, "ACCOUNT_TAKEOVER");
        assert.ok(s.step_templates.length > 0);
    });

    it("getByFamily() returns only matching strategies", () => {
        const registry = getDefaultRegistry();
        const atoStrategies = registry.getByFamily("ACCOUNT_TAKEOVER");
        assert.ok(atoStrategies.length >= 2);
        for (const s of atoStrategies) {
            assert.equal(s.attack_family, "ACCOUNT_TAKEOVER");
        }
    });

    it("getByFamily() returns empty array for unknown family", () => {
        const registry = getDefaultRegistry();
        const results = registry.getByFamily("ALIEN_HACKING");
        assert.deepEqual(results, []);
    });

    it("rejects duplicate strategy_id in definitions", () => {
        const dup = [STRATEGIES[0], { ...STRATEGIES[0] }];
        assert.throws(() => new StrategyRegistry(dup), ValidationError);
    });

    it("all strategies have at least one step_template", () => {
        const registry = getDefaultRegistry();
        for (const s of registry.getAll()) {
            assert.ok(s.step_templates.length > 0, `Strategy '${s.strategy_id}' has no step_templates`);
        }
    });

    it("all strategies reference only primitive IDs that exist", () => {
        const { getDefaultRegistry: getPrimRegistry } = require("../../src/primitives/registry");
        const primRegistry = getPrimRegistry();
        const stratRegistry = getDefaultRegistry();

        for (const strategy of stratRegistry.getAll()) {
            for (const tmpl of strategy.step_templates) {
                assert.ok(
                    primRegistry.has(tmpl.primitive_id),
                    `Strategy '${strategy.strategy_id}' references unknown primitive '${tmpl.primitive_id}'`
                );
            }
        }
    });

    it("all step_templates in all strategies reference only concrete primitives", () => {
        const { getDefaultRegistry: getPrimRegistry } = require("../../src/primitives/registry");
        const primRegistry = getPrimRegistry();
        const stratRegistry = getDefaultRegistry();

        for (const strategy of stratRegistry.getAll()) {
            for (const tmpl of strategy.step_templates) {
                const prim = primRegistry.get(tmpl.primitive_id);
                if (prim) {
                    assert.equal(
                        prim.is_abstract,
                        false,
                        `Strategy '${strategy.strategy_id}' uses abstract primitive '${tmpl.primitive_id}'`
                    );
                }
            }
        }
    });

    it("STRAT_VELOCITY_FUND_DRAIN has severity HIGH", () => {
        const registry = getDefaultRegistry();
        const s = registry.get("STRAT_VELOCITY_FUND_DRAIN");
        assert.equal(s.severity, "HIGH");
        assert.equal(s.attack_family, "VELOCITY_ABUSE");
    });

    it("STRAT_KYC_BYPASS_FUND_TRANSFER has severity MEDIUM", () => {
        const registry = getDefaultRegistry();
        const s = registry.get("STRAT_KYC_BYPASS_FUND_TRANSFER");
        assert.equal(s.severity, "MEDIUM");
    });

    it("STRAT_BRUTE_FORCE_THEN_FREEZE has severity CRITICAL", () => {
        const registry = getDefaultRegistry();
        const s = registry.get("STRAT_BRUTE_FORCE_THEN_FREEZE");
        assert.equal(s.severity, "CRITICAL");
    });

    it("toSnapshot() returns all strategies", () => {
        const registry = getDefaultRegistry();
        const snapshot = registry.toSnapshot();
        assert.equal(snapshot.length, registry.size);
    });
});
