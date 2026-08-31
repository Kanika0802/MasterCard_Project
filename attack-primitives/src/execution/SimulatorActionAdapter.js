// attack-primitives/src/execution/SimulatorActionAdapter.js
"use strict";

const { ActionMappingError } = require("../domain/errors");
const { getDefaultRegistry } = require("../registry/PrimitiveRegistry");

class SimulatorActionAdapter {
    constructor(registry = getDefaultRegistry()) {
        this.registry = registry;
    }

    /**
     * Map a primitive and its parameters into the exact request payload for M1 POST /api/v1/simulator/actions
     */
    toActionRequest(primitiveOrId, rawParameters = {}, context = {}) {
        const primitive = typeof primitiveOrId === "string"
            ? this.registry.get(primitiveOrId)
            : primitiveOrId;

        if (!primitive) {
            throw new ActionMappingError(`Cannot adapt unknown primitive '${primitiveOrId}'.`);
        }

        if (primitive.is_abstract) {
            throw new ActionMappingError(
                `Primitive '${primitive.primitive_id}' is ABSTRACT and cannot be mapped to an M1 Simulator Action.`
            );
        }

        // Validate parameter contract
        const validatedParams = primitive.validateParameters(rawParameters);

        // Build canonical M1 Action Request envelope
        return {
            action: primitive.simulator_action,
            simulation_id: context.simulation_id || "sim_default",
            experiment_id: context.experiment_id || "exp_default",
            adversarial_metadata: {
                attack_scenario_id: context.attack_scenario_id || null,
                primitive_id: primitive.primitive_id,
                step_id: context.step_id || null,
                attack_family: primitive.attack_family,
                generated_by: context.generated_by || "M4_GENAI_RED_TEAM",
                mitre_attack_id: primitive.mitre_attack_id || null
            },
            parameters: validatedParams
        };
    }

    resolveAction(primitiveId) {
        const primitive = this.registry.get(primitiveId);
        if (!primitive) {
            throw new ActionMappingError(`Unknown primitive_id '${primitiveId}'.`);
        }
        if (primitive.is_abstract) {
            throw new ActionMappingError(`Primitive '${primitiveId}' is abstract with no M1 action mapping.`);
        }
        return primitive.simulator_action;
    }
}

module.exports = SimulatorActionAdapter;
