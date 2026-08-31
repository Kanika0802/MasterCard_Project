// red-team/src/api/RedTeamExecutionController.js

const { AttackOrchestrator } = require("../orchestrator");
const { ExecutionState } = require("../domain/execution/ExecutionState");

class RedTeamExecutionController {
    constructor(options = {}) {
        this.orchestrator = options.orchestrator || new AttackOrchestrator(options.orchestratorOptions || {});
    }

    execute = async (req, res) => {
        // 1. Transport-level Validation
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "MALFORMED_REQUEST",
                    message: "Request body must be a valid JSON object."
                }
            });
        }

        // Extract scenario, context, and execution options
        const scenarioInput = req.body.scenario !== undefined ? req.body.scenario : req.body;
        const contextInput = req.body.context || {};
        const executionOptions = req.body.execution_options || {};

        if (!scenarioInput || typeof scenarioInput !== "object" || Object.keys(scenarioInput).length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "MISSING_SCENARIO",
                    message: "Request must provide a valid 'scenario' object."
                }
            });
        }

        // 2. Correlation, Causation, and Idempotency Header Extraction
        const correlationId = req.headers["x-correlation-id"] || contextInput.correlation_id;
        const causationId = req.headers["x-causation-id"] || contextInput.causation_id;
        const idempotencyKey = req.headers["idempotency-key"] || contextInput.idempotency_key;

        const effectiveContext = {
            scenario_id: scenarioInput.scenario_id,
            simulation_id: scenarioInput.simulation_id,
            experiment_id: scenarioInput.experiment_id,
            ...contextInput,
            ...(correlationId ? { correlation_id: String(correlationId) } : {}),
            ...(causationId ? { causation_id: String(causationId) } : {}),
            ...(idempotencyKey ? { idempotency_key: String(idempotencyKey) } : {})
        };

        // 3. Setup Request Abort Signal Handling
        const effectiveSignal = executionOptions.signal || null;
        const effectiveOptions = {
            ...executionOptions,
            signal: effectiveSignal
        };

        // 4. Delegate to Orchestrator
        try {
            const attackResult = await this.orchestrator.executeScenario(
                scenarioInput,
                effectiveContext,
                effectiveOptions
            );

            const serializedResult = typeof attackResult.toJSON === "function"
                ? attackResult.toJSON()
                : attackResult;

            // 5. HTTP Status Mapping
            if (serializedResult.status === ExecutionState.COMPLETED) {
                return res.status(200).json(serializedResult);
            }

            if (serializedResult.error?.code === "SCENARIO_VALIDATION_FAILED" ||
                serializedResult.error?.code === "SCENARIO_VALIDATION_ERROR") {
                return res.status(422).json(serializedResult);
            }

            if (serializedResult.error?.code === "MALFORMED_SCENARIO" ||
                serializedResult.error?.code === "MALFORMED_CONTEXT") {
                return res.status(400).json(serializedResult);
            }

            // Normal scenario failure (e.g. step failed or aborted) returns 200 with FAILED status
            return res.status(200).json(serializedResult);
        } catch (unhandledErr) {
            // Guard against leaking internal stack traces
            return res.status(500).json({
                success: false,
                error: {
                    code: "INTERNAL_ORCHESTRATION_ERROR",
                    message: "An unexpected error occurred during scenario orchestration."
                }
            });
        }
    };
}

module.exports = RedTeamExecutionController;
