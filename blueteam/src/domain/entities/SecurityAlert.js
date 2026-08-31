// blueteam/src/domain/entities/SecurityAlert.js
"use strict";

const crypto = require("crypto");
const { AlertSeverity, AlertStatus, RiskTier } = require("../constants");
const RiskScore = require("./RiskScore");

class SecurityAlert {
    constructor({
        alert_id = crypto.randomUUID(),
        title = "Security Alert",
        description = "",
        severity = AlertSeverity.MEDIUM,
        status = AlertStatus.NEW,
        entity_type = "transaction",
        entity_id = null,
        user_id = null,
        account_id = null,
        device_id = null,
        ip_address = null,
        simulation_id = null,
        experiment_id = null,
        event_id = null,
        risk_score = null,
        category = null,
        triggers = [],
        mitigation_action = null,
        created_at = new Date().toISOString(),
        updated_at = new Date().toISOString(),
        triage_notes = [],
        metadata = {}
    } = {}) {
        this.alert_id = alert_id;
        this.title = title;
        this.description = description;
        this.severity = severity;
        this.status = status;
        this.entity_type = entity_type;
        this.entity_id = entity_id;
        this.user_id = user_id;
        this.account_id = account_id;
        this.device_id = device_id;
        this.ip_address = ip_address;
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.event_id = event_id;
        this.risk_score = risk_score instanceof RiskScore ? risk_score : (risk_score ? new RiskScore(risk_score) : null);
        this.category = category;
        this.triggers = Array.isArray(triggers) ? [...triggers] : [];
        this.mitigation_action = mitigation_action;
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.triage_notes = Array.isArray(triage_notes) ? [...triage_notes] : [];
        this.metadata = typeof metadata === "object" && metadata !== null ? { ...metadata } : {};
    }

    static fromRiskScore({
        riskScore,
        decision = null,
        event = {},
        title = null,
        description = null,
        category = null
    }) {
        let severity = AlertSeverity.MEDIUM;
        if (riskScore.risk_tier === RiskTier.CRITICAL) severity = AlertSeverity.CRITICAL;
        else if (riskScore.risk_tier === RiskTier.HIGH) severity = AlertSeverity.HIGH;
        else if (riskScore.risk_tier === RiskTier.LOW) severity = AlertSeverity.LOW;

        const payload = event.payload || {};
        const entityId = event.entity_id || payload.transaction_id || payload.user_id || payload.account_id || null;
        const userId = payload.initiator_user_id || payload.user_id || (event.entity_type === "user" ? event.entity_id : null);
        const accountId = payload.sender_account_id || payload.account_id || (event.entity_type === "account" ? event.entity_id : null);
        const deviceId = event.device_id || payload.device_id || null;
        const ipAddress = payload.ip_address || (payload.location?.ip) || null;

        const alertTitle = title || `High Risk Alert: ${riskScore.triggered_rules[0]?.rule_name || riskScore.risk_tier} detected`;
        const alertDescription = description || (riskScore.explanations.join("; ") || `Suspicious activity with risk score ${riskScore.score}`);

        return new SecurityAlert({
            title: alertTitle,
            description: alertDescription,
            severity,
            status: AlertStatus.NEW,
            entity_type: event.entity_type || "transaction",
            entity_id: entityId,
            user_id: userId,
            account_id: accountId,
            device_id: deviceId,
            ip_address: ipAddress,
            simulation_id: event.simulation_id || null,
            experiment_id: event.experiment_id || null,
            event_id: event.event_id || null,
            risk_score: riskScore,
            category: category || riskScore.triggered_rules[0]?.category || null,
            triggers: riskScore.triggered_rules,
            mitigation_action: decision?.action || null,
            metadata: {
                event_type: event.event_type,
                ...event.metadata
            }
        });
    }

    addTriageNote(note, author = "BlueTeam_Analyst") {
        this.triage_notes.push({
            note,
            author,
            timestamp: new Date().toISOString()
        });
        this.updated_at = new Date().toISOString();
    }

    resolve(reason = "Threat mitigated", author = "BlueTeam_Analyst") {
        this.status = AlertStatus.RESOLVED;
        this.addTriageNote(`Resolved: ${reason}`, author);
    }

    dismiss(reason = "False positive", author = "BlueTeam_Analyst") {
        this.status = AlertStatus.DISMISSED;
        this.addTriageNote(`Dismissed: ${reason}`, author);
    }

    toJSON() {
        return {
            alert_id: this.alert_id,
            title: this.title,
            description: this.description,
            severity: this.severity,
            status: this.status,
            entity_type: this.entity_type,
            entity_id: this.entity_id,
            user_id: this.user_id,
            account_id: this.account_id,
            device_id: this.device_id,
            ip_address: this.ip_address,
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            event_id: this.event_id,
            risk_score: this.risk_score ? this.risk_score.toJSON() : null,
            category: this.category,
            triggers: this.triggers,
            mitigation_action: this.mitigation_action,
            created_at: this.created_at,
            updated_at: this.updated_at,
            triage_notes: this.triage_notes,
            metadata: this.metadata
        };
    }
}

module.exports = SecurityAlert;
