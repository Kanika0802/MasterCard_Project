// blueteam/tests/unit/decisionEngine.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const DecisionEngine = require("../../src/mitigation/DecisionEngine");
const MitigationActionExecutor = require("../../src/mitigation/MitigationActionExecutor");
const RiskScore = require("../../src/domain/entities/RiskScore");
const { RiskTier, DefenseDecisionType } = require("../../src/domain/constants");

describe("M3 Decision Engine & Mitigation Unit Tests", () => {

    const decisionEngine = new DecisionEngine();

    it("should decide ALLOW for LOW risk score", () => {
        const risk = new RiskScore({ score: 0.1, risk_tier: RiskTier.LOW });
        const decision = decisionEngine.evaluateDecision(risk, { entity_id: "tx_1", entity_type: "transaction" });

        assert.strictEqual(decision.action, DefenseDecisionType.ALLOW);
        assert.strictEqual(decision.requires_step_up, false);
        assert.strictEqual(decision.isBlocked(), false);
    });

    it("should decide CHALLENGE_OTP / STEP_UP_AUTH for MEDIUM risk score", () => {
        const risk = new RiskScore({ score: 0.45, risk_tier: RiskTier.MEDIUM });
        const decision = decisionEngine.evaluateDecision(risk, { entity_id: "tx_2", entity_type: "transaction" });

        assert.strictEqual(decision.action, DefenseDecisionType.CHALLENGE_OTP);
        assert.strictEqual(decision.requires_step_up, true);
        assert.strictEqual(decision.step_up_type, "SMS_OTP");
    });

    it("should decide BLOCK_TRANSACTION for HIGH risk score", () => {
        const risk = new RiskScore({ score: 0.75, risk_tier: RiskTier.HIGH, explanations: ["Velocity spike detected"] });
        const decision = decisionEngine.evaluateDecision(risk, { entity_id: "tx_3", entity_type: "transaction" });

        assert.strictEqual(decision.action, DefenseDecisionType.BLOCK_TRANSACTION);
        assert.strictEqual(decision.isBlocked(), true);
        assert.ok(decision.reasons.includes("Velocity spike detected"));
    });

    it("should decide FREEZE_ACCOUNT for CRITICAL risk score", () => {
        const risk = new RiskScore({ score: 0.95, risk_tier: RiskTier.CRITICAL, explanations: ["Account takeover fund drain"] });
        const decision = decisionEngine.evaluateDecision(risk, { entity_id: "acc_victim_01", entity_type: "account" });

        assert.strictEqual(decision.action, DefenseDecisionType.FREEZE_ACCOUNT);
        assert.strictEqual(decision.isBlocked(), true);
        assert.ok(decision.mitigation_actions.includes("FREEZE_ACCOUNT"));
    });

    it("should record mitigation action history in executor", async () => {
        const executor = new MitigationActionExecutor();
        const risk = new RiskScore({ score: 0.95, risk_tier: RiskTier.CRITICAL });
        const decision = decisionEngine.evaluateDecision(risk, { entity_id: "acc_1", entity_type: "account" });

        const record = await executor.executeMitigation(decision);
        assert.strictEqual(record.status, "EXECUTED");
        assert.strictEqual(record.action, DefenseDecisionType.FREEZE_ACCOUNT);

        const history = executor.getExecutionHistory();
        assert.strictEqual(history.length, 1);
    });
});
