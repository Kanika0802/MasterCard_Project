// blueteam/tests/unit/alertManager.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const AlertManager = require("../../src/alerts/AlertManager");
const RiskScore = require("../../src/domain/entities/RiskScore");
const { RiskTier, AlertSeverity, AlertStatus } = require("../../src/domain/constants");

describe("M3 Security Alert Manager Unit Tests", () => {

    it("should create security alert from high risk score and record metrics", () => {
        const alertManager = new AlertManager();

        const riskScore = new RiskScore({
            score: 0.88,
            risk_tier: RiskTier.CRITICAL,
            triggered_rules: [{ rule_name: "Impossible Travel", category: "GEOLOCATION", score: 0.9 }],
            explanations: ["Impossible physical speed detected"]
        });

        const alert = alertManager.createAlertFromRisk({
            riskScore,
            decision: { action: "BLOCK_TRANSACTION" },
            event: {
                event_id: "evt_101",
                entity_type: "transaction",
                entity_id: "tx_101",
                payload: { initiator_user_id: "usr_victim", amount: 5000 }
            }
        });

        assert.ok(alert);
        assert.strictEqual(alert.severity, AlertSeverity.CRITICAL);
        assert.strictEqual(alert.status, AlertStatus.NEW);
        assert.strictEqual(alert.user_id, "usr_victim");

        const metrics = alertManager.getMetrics();
        assert.strictEqual(metrics.total_generated, 1);
        assert.strictEqual(metrics.by_severity[AlertSeverity.CRITICAL], 1);
        assert.strictEqual(metrics.active_alerts, 1);
    });

    it("should not create alert for low risk normal transactions", () => {
        const alertManager = new AlertManager();
        const lowRisk = new RiskScore({ score: 0.05, risk_tier: RiskTier.LOW });

        const alert = alertManager.createAlertFromRisk({
            riskScore: lowRisk,
            event: { event_id: "evt_normal" }
        });

        assert.strictEqual(alert, null);
        assert.strictEqual(alertManager.getMetrics().total_generated, 0);
    });

    it("should support alert triage lifecycle: resolve and dismiss", () => {
        const alertManager = new AlertManager();
        const riskScore = new RiskScore({ score: 0.75, risk_tier: RiskTier.HIGH });

        const alert = alertManager.createAlertFromRisk({
            riskScore,
            event: { entity_id: "tx_threat_1" }
        });

        // Resolve
        const resolved = alertManager.resolveAlert(alert.alert_id, "Card blocked and verified with customer", "Senior_Analyst");
        assert.strictEqual(resolved.status, AlertStatus.RESOLVED);
        assert.strictEqual(resolved.triage_notes.length, 1);

        const metrics = alertManager.getMetrics();
        assert.strictEqual(metrics.resolved_count, 1);
        assert.strictEqual(metrics.active_alerts, 0);
    });
});
