// red-team/src/demo.js
"use strict";

require("dotenv").config();
const http = require("http");
const crypto = require("crypto");

const { AttackOrchestrator } = require("./orchestrator");
const { AttackPolicyValidator } = require("./validator");
const { AttackExecutor } = require("./executor");
const { SimulatorClient } = require("./simulator-client");
const AttackScenario = require("./domain/attack/AttackScenario");
const AttackStep = require("./domain/attack/AttackStep");
const AttackTarget = require("./domain/attack/AttackTarget");
const ExecutionContext = require("./domain/execution/ExecutionContext");
const { ExecutionState } = require("./domain/execution/ExecutionState");

const SIMULATOR_PORT = process.env.SIMULATOR_PORT || 3000;
const BLUE_TEAM_PORT = process.env.BLUE_TEAM_PORT || 4000;
const SIMULATOR_URL = process.env.SIMULATOR_URL || `http://localhost:${SIMULATOR_PORT}`;
const BLUE_TEAM_URL = process.env.BLUE_TEAM_URL || `http://localhost:${BLUE_TEAM_PORT}`;

async function checkServiceHealth(url) {
    for (const path of ["/health", "/api/v1/defense/health", "/api/v1/simulator/health"]) {
        try {
            const res = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(1500) });
            if (res.ok) return true;
        } catch {
            // try next path
        }
    }
    return false;
}

async function resolveSyntheticContext(baseUrl) {
    // 1. Fetch or create target synthetic user
    let userId = null;
    try {
        const userRes = await fetch(`${baseUrl}/api/v1/simulator/users?limit=5`);
        if (userRes.ok) {
            const data = await userRes.json();
            if (data.items && data.items.length > 0) {
                userId = data.items[0].user_id || data.items[0]._id;
            }
        }
    } catch (e) {
        // Fallback handled below
    }

    if (!userId) {
        const createRes = await fetch(`${baseUrl}/api/v1/simulator/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                first_name: "DemoTarget",
                last_name: "User",
                email: `demotarget_${Date.now()}@example.test`,
                phone: "+12025550199",
                date_of_birth: "1992-05-15"
            })
        });
        const created = await createRes.json();
        userId = created.user_id || created._id;
    }

    // 2. Fetch or create sender and receiver accounts
    let senderAccountId = null;
    let receiverAccountId = null;

    try {
        const accRes = await fetch(`${baseUrl}/api/v1/simulator/accounts`);
        if (accRes.ok) {
            const accData = await accRes.json();
            const items = accData.items || [];
            const activeAccs = items.filter(a => a.status === "ACTIVE" && Number(a.balance) >= 500);
            if (activeAccs.length >= 1) {
                senderAccountId = activeAccs[0].account_id;
                const otherAcc = items.find(a => a.status === "ACTIVE" && a.account_id !== senderAccountId);
                if (otherAcc) {
                    receiverAccountId = otherAcc.account_id;
                }
            }
        }
    } catch (e) {
        // Fallback handled below
    }

    if (!senderAccountId) {
        const createSender = await fetch(`${baseUrl}/api/v1/simulator/accounts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                account_type: "CHECKING",
                initial_balance: 5000.00,
                currency: "USD"
            })
        });
        const sAcc = await createSender.json();
        senderAccountId = sAcc.account_id;
    }

    if (!receiverAccountId) {
        const createReceiver = await fetch(`${baseUrl}/api/v1/simulator/accounts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                account_type: "SAVINGS",
                initial_balance: 100.00,
                currency: "USD"
            })
        });
        const rAcc = await createReceiver.json();
        receiverAccountId = rAcc.account_id;
    }

    return { userId, senderAccountId, receiverAccountId };
}

async function pollBlueTeamAlerts(blueTeamUrl, correlationKeys = {}, maxWaitMs = 6000) {
    const startTime = Date.now();
    const interval = 250;

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const res = await fetch(`${blueTeamUrl}/api/v1/defense/alerts?limit=50`);
            if (res.ok) {
                const data = await res.json();
                const allAlerts = data.alerts || [];

                // Filter alerts matching this execution's entities
                const matched = allAlerts.filter(a => {
                    if (correlationKeys.transaction_id && a.entity_id === correlationKeys.transaction_id) return true;
                    if (correlationKeys.device_id && a.device_id === correlationKeys.device_id) return true;
                    if (correlationKeys.simulation_id && a.simulation_id === correlationKeys.simulation_id) return true;
                    if (correlationKeys.execution_id && a.metadata?.adversarial_metadata?.execution_id === correlationKeys.execution_id) return true;
                    return false;
                });

                if (matched.length > 0) {
                    return matched;
                }
            }
        } catch {
            // Ignore polling connection glitches
        }

        await new Promise(r => setTimeout(r, interval));
    }

    return [];
}

async function runDemo() {
    const isSimulatorLive = await checkServiceHealth(SIMULATOR_URL);
    if (!isSimulatorLive) {
        console.error(`[Demo Error] Simulator service is not reachable at ${SIMULATOR_URL}. Please ensure 'npm start' is running.`);
        process.exit(1);
    }

    // 1. Resolve synthetic context dynamically
    const { userId, senderAccountId, receiverAccountId } = await resolveSyntheticContext(SIMULATOR_URL);

    // 2. Initialize Red-Team Stack
    const simulatorClient = new SimulatorClient({
        baseUrl: SIMULATOR_URL,
        timeoutMs: 5000,
        maxRetries: 1
    });
    const executor = new AttackExecutor({ simulatorClient });
    const validator = new AttackPolicyValidator();
    const orchestrator = new AttackOrchestrator({ validator, executor });

    const simulationId = `sim_demo_${Date.now()}`;
    const experimentId = `exp_demo_${Date.now()}`;
    const executionId = crypto.randomUUID();

    const executionContext = new ExecutionContext({
        execution_id: executionId,
        scenario_id: "ato-device-transfer-001",
        simulation_id: simulationId,
        experiment_id: experimentId,
        metadata: {
            scenario_name: "ATO Device Spoofing and Dynamic UUID Transaction"
        }
    });

    // 3. Define Canonical ATO Scenario with dynamic step reference
    const scenario = new AttackScenario({
        scenario_id: "ato-device-transfer-001",
        version: 1,
        objective: "Simulate ATO login, register spoofed device, and execute transfer using created device UUID",
        simulation_id: simulationId,
        experiment_id: experimentId,
        target: new AttackTarget({
            entity_type: "user",
            entity_id: userId
        }),
        steps: [
            new AttackStep({
                step_id: "ato-login-001",
                primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                action: "SIMULATE_LOGIN",
                parameters: {
                    user_id: userId,
                    device_id: "attacker-device-001",
                    ip_address: "198.51.100.99",
                    success: true
                },
                timeout_ms: 5000
            }),
            new AttackStep({
                step_id: "spoofed-device-001",
                primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                action: "REGISTER_DEVICE",
                parameters: {
                    user_id: userId,
                    device_type: "MOBILE",
                    operating_system: "Android 14",
                    browser: "Adversarial-Test-Agent",
                    ip_address: "198.51.100.99",
                    device_fingerprint: "spoofed-fingerprint-001"
                },
                depends_on: ["ato-login-001"],
                timeout_ms: 5000
            }),
            new AttackStep({
                step_id: "fraud-transfer-001",
                primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                action: "PERFORM_TRANSACTION",
                parameters: {
                    initiator_user_id: userId,
                    sender_account_id: senderAccountId,
                    receiver_account_id: receiverAccountId,
                    amount: 1500.00,
                    currency: "USD",
                    channel: "MOBILE_APP",
                    device_id: "{{steps.spoofed-device-001.device_id}}"
                },
                depends_on: ["spoofed-device-001"],
                timeout_ms: 5000
            })
        ]
    });

    // 4. Validate Scenario
    const validation = validator.validate(scenario);
    if (!validation.valid) {
        console.error("[Demo Error] Scenario failed static policy validation:", validation.errors);
        process.exit(1);
    }

    // 5. Execute Scenario via AttackOrchestrator
    const attackResult = await orchestrator.executeScenario(scenario, executionContext);

    // 6. Extract Dynamic State from Step Outputs
    const stepResults = attackResult.step_results || [];
    const step2Data = stepResults[1]?.simulator_response?.state_changes?.[0]?.data || {};
    const generatedDeviceId = step2Data.device_id || "N/A";

    const step3Data = stepResults[2]?.simulator_response?.state_changes?.[0]?.data || {};
    const transactionId = step3Data.transaction_id || "N/A";

    // 7. Retrieve Blue-Team Alerts
    let correlatedAlerts = [];
    const isBlueTeamLive = await checkServiceHealth(BLUE_TEAM_URL);
    if (isBlueTeamLive) {
        correlatedAlerts = await pollBlueTeamAlerts(BLUE_TEAM_URL, {
            transaction_id: transactionId,
            device_id: generatedDeviceId,
            simulation_id: simulationId,
            execution_id: executionId
        }, 7500);
    }

    // 8. Calculate Metrics
    const completedSteps = stepResults.filter(s => s.status === "COMPLETED").length;
    const attackSuccess = attackResult.status === ExecutionState.COMPLETED && completedSteps === scenario.steps.length;

    let detectionStatus = "MISSED";
    let highestSeverity = "NONE";
    let detectionLatencyMs = 0;

    if (correlatedAlerts.length > 0) {
        detectionStatus = "DETECTED";
        highestSeverity = correlatedAlerts.some(a => a.severity === "CRITICAL")
            ? "CRITICAL"
            : (correlatedAlerts.some(a => a.severity === "HIGH") ? "HIGH" : "MEDIUM");

        const firstAlert = correlatedAlerts[0];
        if (firstAlert.mitigation_action === "BLOCK" || firstAlert.mitigation_action === "FREEZE_ACCOUNT") {
            detectionStatus = "DETECTED";
        }

        const alertTime = new Date(firstAlert.created_at).getTime();
        const execStart = new Date(attackResult.started_at || Date.now()).getTime();
        detectionLatencyMs = Math.max(0, alertTime - execStart);
    }

    const stepsDetected = correlatedAlerts.length > 0 ? 3 : 0;
    const coveragePercentage = `${Math.round((stepsDetected / scenario.steps.length) * 100)}%`;
    const effectivenessScore = attackSuccess ? 100 : Math.round((completedSteps / scenario.steps.length) * 100);

    // 9. Output Concise Demonstration Report
    console.log("========================================");
    console.log("AIPaySec Red-Team / Blue-Team Demo");
    console.log("========================================");
    console.log();
    console.log(`Scenario: ${scenario.scenario_id}`);
    console.log(`Execution: ${executionId}`);
    console.log();
    console.log("ATTACK");
    console.log(`Status: ${attackSuccess ? "SUCCESS" : "FAILED"}`);
    console.log(`Steps: ${completedSteps}/${scenario.steps.length}`);
    console.log();
    console.log("DYNAMIC STATE");
    console.log(`Generated Device ID: ${generatedDeviceId}`);
    console.log(`Transaction: ${transactionId}`);
    console.log();
    console.log("DEFENSE");
    console.log(`Alerts: ${correlatedAlerts.length}`);
    console.log(`Detection: ${detectionStatus}`);
    console.log(`Severity: ${highestSeverity}`);
    console.log(`Detection latency: ${detectionLatencyMs}ms`);
    console.log(`Coverage: ${coveragePercentage}`);
    console.log();
    console.log("EFFECTIVENESS");
    console.log(`Score: ${effectivenessScore}/100`);
    console.log();
    console.log("========================================");

    return {
        scenario_id: scenario.scenario_id,
        execution_id: executionId,
        simulation_id: simulationId,
        experiment_id: experimentId,
        attack: {
            status: attackSuccess ? "SUCCESS" : "FAILED",
            steps_completed: completedSteps,
            steps_total: scenario.steps.length,
            step_results: stepResults.map(s => ({
                step_id: s.step_id,
                status: s.status,
                action_type: s.simulator_response?.action_type || s.action,
                latency_ms: s.latency_ms,
                state_changes: s.simulator_response?.state_changes || []
            }))
        },
        dynamic_state: {
            device_id: generatedDeviceId,
            transaction_id: transactionId
        },
        defense: {
            alerts_count: correlatedAlerts.length,
            detection: detectionStatus,
            severity: highestSeverity,
            detection_latency_ms: detectionLatencyMs,
            coverage: coveragePercentage,
            alerts: correlatedAlerts
        },
        effectiveness: {
            score: effectivenessScore
        }
    };
}

if (require.main === module) {
    runDemo().catch(err => {
        console.error("[Demo Fatal Error]", err);
        process.exit(1);
    });
}

module.exports = { runDemo };
