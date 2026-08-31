// red-team/src/orchestrator/AttackOrchestrator.js

const crypto = require("crypto");
const { AttackPolicyValidator } = require("../validator");
const { AttackExecutor } = require("../executor");
const AttackResult = require("../domain/attack/AttackResult");
const AttackScenario = require("../domain/attack/AttackScenario");
const AttackStep = require("../domain/attack/AttackStep");
const ExecutionContext = require("../domain/execution/ExecutionContext");
const { ExecutionState, StepExecutionStatus } = require("../domain/execution/ExecutionState");

class AttackOrchestrator {
    constructor(options = {}) {
        this.validator = options.validator || new AttackPolicyValidator();
        this.executor = options.executor || new AttackExecutor(options.executorOptions || {});
        this.options = options;
    }

    async executeScenario(scenarioInput, contextInput = null, executionOptions = {}) {
        const startedAt = new Date().toISOString();
        const signal = executionOptions.signal || null;

        // 1. Convert or wrap scenario
        let scenario;
        try {
            scenario = scenarioInput instanceof AttackScenario
                ? scenarioInput
                : AttackScenario.fromJSON(scenarioInput);
        } catch (err) {
            return new AttackResult({
                execution_id: contextInput?.execution_id || crypto.randomUUID(),
                scenario_id: scenarioInput?.scenario_id || "malformed_scenario",
                status: ExecutionState.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                step_results: [],
                error: {
                    code: err.errorCode || "MALFORMED_SCENARIO",
                    message: `Scenario could not be parsed: ${err.message}`
                }
            });
        }

        // 2. Establish ExecutionContext
        let context;
        try {
            if (contextInput instanceof ExecutionContext) {
                context = contextInput;
            } else if (contextInput && typeof contextInput === "object") {
                const mergedContext = {
                    scenario_id: scenario.scenario_id,
                    simulation_id: scenario.simulation_id,
                    experiment_id: scenario.experiment_id,
                    ...contextInput
                };
                context = ExecutionContext.fromJSON(mergedContext);
            } else {
                context = new ExecutionContext({
                    execution_id: crypto.randomUUID(),
                    scenario_id: scenario.scenario_id,
                    simulation_id: scenario.simulation_id,
                    experiment_id: scenario.experiment_id,
                    correlation_id: scenario.metadata?.correlation_id || null,
                    causation_id: scenario.metadata?.causation_id || null,
                    metadata: scenario.metadata || {}
                });
            }
        } catch (ctxErr) {
            return new AttackResult({
                execution_id: crypto.randomUUID(),
                scenario_id: scenario.scenario_id,
                status: ExecutionState.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                step_results: [],
                error: {
                    code: "MALFORMED_CONTEXT",
                    message: `ExecutionContext is invalid: ${ctxErr.message}`
                }
            });
        }

        // 3. Security & Policy Validation (MUST happen before execution)
        const validationResult = this.validator.validate(scenario);
        if (!validationResult.valid) {
            return new AttackResult({
                execution_id: context.execution_id,
                scenario_id: scenario.scenario_id,
                status: ExecutionState.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                step_results: [],
                error: {
                    code: "SCENARIO_VALIDATION_FAILED",
                    message: "AttackScenario failed policy validation.",
                    validation_errors: validationResult.errors
                },
                metadata: {
                    ...context.metadata,
                    validation_failed: true
                }
            });
        }

        // 4. Resolve Step Dependency Graph (Topological Sort)
        let orderedSteps;
        try {
            orderedSteps = this._topologicalSort(scenario.steps);
        } catch (sortErr) {
            return new AttackResult({
                execution_id: context.execution_id,
                scenario_id: scenario.scenario_id,
                status: ExecutionState.FAILED,
                started_at: startedAt,
                completed_at: new Date().toISOString(),
                step_results: [],
                error: {
                    code: "DEPENDENCY_RESOLUTION_ERROR",
                    message: sortErr.message
                }
            });
        }

        // 5. Execute Steps sequentially with Fail-Fast Policy
        const stepResults = [];
        let scenarioStatus = ExecutionState.COMPLETED;
        let scenarioError = null;

        for (const step of orderedSteps) {
            // Check for abort request
            if (signal && signal.aborted) {
                scenarioStatus = ExecutionState.ABORTED;
                scenarioError = {
                    code: "EXECUTION_ABORTED",
                    message: "Scenario execution was aborted."
                };
                break;
            }

            // Execute the step via AttackExecutor
            let stepResult;
            try {
                stepResult = await this.executor.executeStep(step, context);
            } catch (unhandledErr) {
                stepResult = {
                    step_id: step.step_id,
                    status: StepExecutionStatus.FAILED,
                    started_at: new Date().toISOString(),
                    completed_at: new Date().toISOString(),
                    latency_ms: 0,
                    error: {
                        code: "UNEXPECTED_EXECUTOR_ERROR",
                        message: unhandledErr.message || "Unexpected error during step execution"
                    },
                    isSuccess: () => false
                };
            }

            stepResults.push(stepResult);

            // Fail-fast check
            const isStepSuccess = typeof stepResult.isSuccess === "function"
                ? stepResult.isSuccess()
                : (stepResult.status === StepExecutionStatus.COMPLETED && !stepResult.error);

            if (!isStepSuccess) {
                scenarioStatus = ExecutionState.FAILED;
                scenarioError = {
                    code: "STEP_EXECUTION_FAILED",
                    message: `Step '${step.step_id}' failed: ${stepResult.error?.message || "Execution error"}`,
                    failed_step_id: step.step_id,
                    step_error: stepResult.error
                };
                break; // Stop executing subsequent dependent/future steps
            }
        }

        const completedAt = new Date().toISOString();

        return new AttackResult({
            execution_id: context.execution_id,
            scenario_id: scenario.scenario_id,
            status: scenarioStatus,
            started_at: startedAt,
            completed_at: completedAt,
            step_results: stepResults,
            error: scenarioError,
            metadata: {
                ...context.metadata,
                total_declared_steps: scenario.steps.length,
                executed_steps_count: stepResults.length
            }
        });
    }

    _topologicalSort(steps) {
        const stepMap = new Map();
        const inDegree = new Map();
        const outgoingEdges = new Map(); // depId -> [stepIds that depend on depId]
        const originalIndex = new Map();

        // 1. Initialize data structures
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            stepMap.set(step.step_id, step);
            inDegree.set(step.step_id, 0);
            outgoingEdges.set(step.step_id, []);
            originalIndex.set(step.step_id, i);
        }

        // 2. Build dependency edges and in-degrees
        for (const step of steps) {
            const deps = Array.isArray(step.depends_on) ? step.depends_on : [];
            for (const depId of deps) {
                if (!stepMap.has(depId)) {
                    throw new Error(`Step '${step.step_id}' depends on non-existent step '${depId}'.`);
                }
                if (depId === step.step_id) {
                    throw new Error(`Step '${step.step_id}' has a circular self-dependency.`);
                }
                outgoingEdges.get(depId).push(step.step_id);
                inDegree.set(step.step_id, inDegree.get(step.step_id) + 1);
            }
        }

        // 3. Find initial nodes with in-degree 0 (sorted by original declaration order for determinism)
        const readyQueue = [];
        for (const [stepId, degree] of inDegree.entries()) {
            if (degree === 0) {
                readyQueue.push(stepId);
            }
        }
        readyQueue.sort((a, b) => originalIndex.get(a) - originalIndex.get(b));

        const sorted = [];

        // 4. Process queue
        while (readyQueue.length > 0) {
            const currentId = readyQueue.shift();
            sorted.push(stepMap.get(currentId));

            const dependents = outgoingEdges.get(currentId) || [];
            const newReady = [];

            for (const depStepId of dependents) {
                const newDegree = inDegree.get(depStepId) - 1;
                inDegree.set(depStepId, newDegree);
                if (newDegree === 0) {
                    newReady.push(depStepId);
                }
            }

            // Sort newly ready items deterministically and enqueue
            newReady.sort((a, b) => originalIndex.get(a) - originalIndex.get(b));
            for (const id of newReady) {
                readyQueue.push(id);
            }
            readyQueue.sort((a, b) => originalIndex.get(a) - originalIndex.get(b));
        }

        // 5. Check if all steps were resolved (no cycles)
        if (sorted.length !== steps.length) {
            throw new Error("Circular dependency detected in attack scenario steps.");
        }

        return sorted;
    }
}

module.exports = AttackOrchestrator;
