// redteam/src/planner/PlannerInterface.js
//
// Abstract interface that all planner implementations must satisfy.
// Enforces the contract: planners receive a PlannerInput and return a PlannerOutput.
// Planners MUST NOT execute simulator actions, access databases, or produce executable code.

"use strict";

class PlannerInterface {
    /**
     * The name of this planner implementation (used in PlannerOutput.planner_id).
     * Subclasses must override this.
     * @returns {string}
     */
    get name() {
        throw new Error("PlannerInterface.name must be implemented by subclass.");
    }

    /**
     * Generate one or more raw scenario proposals from the given PlannerInput.
     *
     * @param {object} plannerInput - Validated PlannerInput object.
     * @returns {Promise<object>} A PlannerOutput object.
     *
     * Contract:
     *  - Must return a PlannerOutput-shaped object.
     *  - Must NOT call simulator APIs.
     *  - Must NOT access PostgreSQL, MongoDB, or Kafka.
     *  - Must produce only structured data — no executable code.
     *  - Output will be validated by ScenarioValidator before any execution.
     */
    async plan(plannerInput) { // eslint-disable-line no-unused-vars
        throw new Error("PlannerInterface.plan() must be implemented by subclass.");
    }
}

module.exports = { PlannerInterface };
