// red-team/src/executor/AttackExecutor.js

const { SimulatorClient, SimulatorClientErrorCode } = require("../simulator-client");
const StepResult = require("../domain/execution/StepResult");
const { StepExecutionStatus } = require("../domain/execution/ExecutionState");

class AttackExecutor {
    constructor(options = {}) {
        this.simulatorClient = options.simulatorClient || new SimulatorClient(options.clientOptions || {});
    }

    async executeStep(step, context) {
        const startedAt = new Date().toISOString();
        const startNs = process.hrtime.bigint();

        // 1. Guard against malformed internal inputs
        if (!step || typeof step !== "object") {
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            return new StepResult({
                step_id: "unknown",
                status: StepExecutionStatus.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                latency_ms: latencyMs,
                error: {
                    code: "MALFORMED_STEP",
                    message: "executeStep requires a valid AttackStep object."
                }
            });
        }

        if (!step.step_id || typeof step.step_id !== "string" || !step.step_id.trim()) {
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            return new StepResult({
                step_id: "unknown",
                status: StepExecutionStatus.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                latency_ms: latencyMs,
                error: {
                    code: "MISSING_STEP_ID",
                    message: "AttackStep missing required step_id."
                }
            });
        }

        if (!step.action || typeof step.action !== "string" || !step.action.trim()) {
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            return new StepResult({
                step_id: step.step_id,
                status: StepExecutionStatus.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                latency_ms: latencyMs,
                error: {
                    code: "MISSING_ACTION",
                    message: `AttackStep '${step.step_id}' missing required action.`
                }
            });
        }

        if (!context || typeof context !== "object") {
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            return new StepResult({
                step_id: step.step_id,
                status: StepExecutionStatus.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                latency_ms: latencyMs,
                error: {
                    code: "MALFORMED_CONTEXT",
                    message: "executeStep requires a valid ExecutionContext."
                }
            });
        }

        // 2. Derive deterministic idempotency key if supported/required
        let idempotencyKey = step.parameters?.idempotency_key || step.idempotency_key || null;
        if (!idempotencyKey && step.action === "PERFORM_TRANSACTION") {
            idempotencyKey = `${context.execution_id || "exec"}_${step.step_id}`;
        }

        // 3. Assemble adversarial metadata and target info
        const targetObj = step.target
            ? (typeof step.target.toJSON === "function" ? step.target.toJSON() : step.target)
            : null;

        const adversarialMetadata = {
            step_id: step.step_id,
            primitive_id: step.primitive_id || null,
            execution_id: context.execution_id || null,
            scenario_id: context.scenario_id || null,
            ...(context.metadata || {}),
            ...(targetObj ? { target: targetObj } : {})
        };

        // 4. Construct parameters payload
        const parameters = { ...(step.parameters || {}) };
        if (targetObj && targetObj.entity_type && targetObj.entity_id) {
            // If target is specified and entity_id is not already mapped into parameters
            if (targetObj.entity_type === "user" && !parameters.user_id) {
                parameters.user_id = targetObj.entity_id;
            } else if (targetObj.entity_type === "account" && !parameters.account_id && !parameters.sender_account_id) {
                parameters.account_id = targetObj.entity_id;
            } else if (targetObj.entity_type === "kyc" && !parameters.kyc_id) {
                parameters.kyc_id = targetObj.entity_id;
            } else if (targetObj.entity_type === "device" && !parameters.device_id) {
                parameters.device_id = targetObj.entity_id;
            }
        }

        const actionRequest = {
            action: step.action,
            parameters,
            simulation_id: context.simulation_id,
            experiment_id: context.experiment_id,
            adversarial_metadata: adversarialMetadata,
            idempotency_key: idempotencyKey,
            correlation_id: context.correlation_id || context.execution_id,
            causation_id: context.causation_id || context.execution_id,
            timeout_ms: step.timeout_ms
        };

        // 5. Execute via SimulatorClient
        try {
            const simulatorResponse = await this.simulatorClient.executeAction(actionRequest);
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            const completedAt = new Date().toISOString();

            return new StepResult({
                step_id: step.step_id,
                status: StepExecutionStatus.COMPLETED,
                started_at: startedAt,
                completed_at: completedAt,
                latency_ms: latencyMs,
                simulator_response: simulatorResponse,
                error: null
            });
        } catch (err) {
            const endNs = process.hrtime.bigint();
            const latencyMs = Number((endNs - startNs) / 1_000_000n);
            const completedAt = new Date().toISOString();

            const status = (err.code === SimulatorClientErrorCode.TIMEOUT)
                ? StepExecutionStatus.TIMED_OUT
                : StepExecutionStatus.FAILED;

            const normalizedError = {
                code: err.code || "EXECUTION_ERROR",
                message: err.message || "Step execution failed",
                status: err.status || null,
                details: err.details || null
            };

            return new StepResult({
                step_id: step.step_id,
                status,
                started_at: startedAt,
                completed_at: completedAt,
                latency_ms: latencyMs,
                simulator_response: err.details || {},
                error: normalizedError
            });
        }
    }
}

module.exports = AttackExecutor;
