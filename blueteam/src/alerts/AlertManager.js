// blueteam/src/alerts/AlertManager.js
"use strict";

const AlertRepository = require("./AlertRepository");
const SecurityAlert = require("../domain/entities/SecurityAlert");
const { AlertSeverity, AlertStatus } = require("../domain/constants");

class AlertManager {
    constructor(repository = null) {
        this.repository = repository || new AlertRepository();
        this.metrics = {
            total_generated: 0,
            by_severity: {
                [AlertSeverity.INFO]: 0,
                [AlertSeverity.LOW]: 0,
                [AlertSeverity.MEDIUM]: 0,
                [AlertSeverity.HIGH]: 0,
                [AlertSeverity.CRITICAL]: 0
            },
            resolved_count: 0,
            dismissed_count: 0
        };
    }

    createAlertFromRisk({ riskScore, decision = null, event = {}, title = null, description = null, category = null }) {
        if (!riskScore.isHighRisk()) {
            return null; // Don't spam alerts for low risk normal traffic
        }

        const alert = SecurityAlert.fromRiskScore({
            riskScore,
            decision,
            event,
            title,
            description,
            category
        });

        this.repository.save(alert);
        this.metrics.total_generated += 1;
        if (this.metrics.by_severity[alert.severity] !== undefined) {
            this.metrics.by_severity[alert.severity] += 1;
        }

        return alert;
    }

    getAlert(alertId) {
        return this.repository.findById(alertId);
    }

    listAlerts(filter = {}) {
        return this.repository.findAll(filter);
    }

    resolveAlert(alertId, reason = "Threat addressed", author = "BlueTeam_Analyst") {
        const alert = this.repository.findById(alertId);
        if (!alert) return null;

        alert.resolve(reason, author);
        this.repository.save(alert);
        this.metrics.resolved_count += 1;
        return alert;
    }

    dismissAlert(alertId, reason = "False positive", author = "BlueTeam_Analyst") {
        const alert = this.repository.findById(alertId);
        if (!alert) return null;

        alert.dismiss(reason, author);
        this.repository.save(alert);
        this.metrics.dismissed_count += 1;
        return alert;
    }

    getMetrics() {
        return {
            ...this.metrics,
            active_alerts: this.metrics.total_generated - (this.metrics.resolved_count + this.metrics.dismissed_count)
        };
    }

    clear() {
        this.repository.clear();
        this.metrics.total_generated = 0;
        this.metrics.resolved_count = 0;
        this.metrics.dismissed_count = 0;
        for (const k in this.metrics.by_severity) {
            this.metrics.by_severity[k] = 0;
        }
    }
}

module.exports = AlertManager;
