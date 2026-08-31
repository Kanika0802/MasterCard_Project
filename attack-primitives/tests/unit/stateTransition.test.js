// attack-primitives/tests/unit/stateTransition.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const StateTransition = require("../../src/domain/StateTransition");
const { PreconditionViolationError } = require("../../src/domain/errors");

describe("M3 StateTransition Contract Unit Tests", () => {

    it("should pass when state satisfies preconditions", () => {
        const transition = new StateTransition({
            preconditions: [
                (state, params) => Boolean(state.account && state.account.balance >= params.amount)
            ]
        });

        const state = { account: { balance: 1000 } };
        const params = { amount: 500 };

        assert.doesNotThrow(() => {
            transition.assertPreconditions(state, params);
        });
    });

    it("should throw PreconditionViolationError when state violates preconditions", () => {
        const transition = new StateTransition({
            preconditions: [
                (state, params) => Boolean(state.account && state.account.balance >= params.amount)
            ]
        });

        const state = { account: { balance: 200 } };
        const params = { amount: 500 }; // Insufficient funds

        assert.throws(() => {
            transition.assertPreconditions(state, params);
        }, PreconditionViolationError);
    });
});
