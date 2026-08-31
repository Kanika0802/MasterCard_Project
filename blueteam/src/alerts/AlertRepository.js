// blueteam/src/alerts/AlertRepository.js
"use strict";

const SecurityAlert = require("../domain/entities/SecurityAlert");

class AlertRepository {
    constructor() {
        this.alerts = new Map(); // alert_id -> SecurityAlert
    }

    save(alert) {
        if (!alert || !alert.alert_id) return null;
        this.alerts.set(alert.alert_id, alert);
        return alert;
    }

    findById(alertId) {
        return this.alerts.get(alertId) || null;
    }

    findByEntity(entityType, entityId) {
        const results = [];
        for (const alert of this.alerts.values()) {
            if (alert.entity_type === entityType && alert.entity_id === entityId) {
                results.push(alert);
            }
        }
        return results;
    }

    findAll({ status = null, severity = null, limit = 50, offset = 0 } = {}) {
        let list = Array.from(this.alerts.values());

        if (status) {
            list = list.filter(a => a.status === status);
        }
        if (severity) {
            list = list.filter(a => a.severity === severity);
        }

        // Sort descending by created_at
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return {
            total: list.length,
            alerts: list.slice(offset, offset + limit)
        };
    }

    clear() {
        this.alerts.clear();
    }
}

module.exports = AlertRepository;
