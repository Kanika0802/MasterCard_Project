// attack-primitives/src/domain/StateTransition.js
"use strict";

const { PreconditionViolationError } = require("./errors");

class StateTransition {
    constructor({
        preconditions = [],
        postconditions = [],
        state_invariants = [],
        entity_impacts = {}
    } = {}) {
        this.preconditions = Object.freeze(Array.isArray(preconditions) ? [...preconditions] : []);
        this.postconditions = Object.freeze(Array.isArray(postconditions) ? [...postconditions] : []);
        this.state_invariants = Object.freeze(Array.isArray(state_invariants) ? [...state_invariants] : []);
        this.entity_impacts = Object.freeze(typeof entity_impacts === "object" && entity_impacts !== null ? { ...entity_impacts } : {});

        Object.freeze(this);
    }

    assertPreconditions(state = {}, parameters = {}) {
        for (const pre of this.preconditions) {
            if (typeof pre === "function") {
                const passed = pre(state, parameters);
                if (!passed) {
                    throw new PreconditionViolationError(`Precondition check failed for primitive execution.`);
                }
            }
        }
        return true;
    }

    toJSON() {
        return {
            preconditions: this.preconditions.map(p => typeof p === "string" ? p : "Function Precondition"),
            postconditions: this.postconditions.map(p => typeof p === "string" ? p : "Function Postcondition"),
            state_invariants: this.state_invariants.map(i => typeof i === "string" ? i : "Invariant Specification"),
            entity_impacts: this.entity_impacts
        };
    }
}

module.exports = StateTransition;
