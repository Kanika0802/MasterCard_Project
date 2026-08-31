// blueteam/src/api/controllers/DefenseController.js
"use strict";

class DefenseController {
    constructor(defenseEngine) {
        this.engine = defenseEngine;
    }

    async getHealth(req, res) {
        return res.status(200).json({
            status: "UP",
            module: "M3_BLUETEAM_DEFENSE",
            timestamp: new Date().toISOString()
        });
    }

    async evaluateTransaction(req, res) {
        try {
            const { transaction, context } = req.body;
            if (!transaction) {
                return res.status(400).json({ error: "Missing 'transaction' in request body" });
            }

            const evaluation = await this.engine.evaluateTransaction(transaction, context);
            return res.status(200).json(evaluation);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async evaluateEvent(req, res) {
        try {
            const event = req.body;
            if (!event || !event.event_type) {
                return res.status(400).json({ error: "Missing 'event_type' in event envelope" });
            }

            const result = await this.engine.processEvent(event);
            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getProfile(req, res) {
        try {
            const { entityType, entityId } = req.params;
            const profile = this.engine.getProfile(entityType, entityId);
            if (!profile) {
                return res.status(404).json({ error: `Profile not found for ${entityType}/${entityId}` });
            }
            return res.status(200).json(profile);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async listAlerts(req, res) {
        try {
            const { status, severity, limit, offset } = req.query;
            const result = this.engine.listAlerts({
                status,
                severity,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0
            });
            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getAlertById(req, res) {
        try {
            const { alertId } = req.params;
            const alert = this.engine.getAlert(alertId);
            if (!alert) {
                return res.status(404).json({ error: `Alert not found: ${alertId}` });
            }
            return res.status(200).json(alert);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async resolveAlert(req, res) {
        try {
            const { alertId } = req.params;
            const { reason, author } = req.body || {};
            const alert = this.engine.resolveAlert(alertId, reason, author);
            if (!alert) {
                return res.status(404).json({ error: `Alert not found: ${alertId}` });
            }
            return res.status(200).json(alert);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async dismissAlert(req, res) {
        try {
            const { alertId } = req.params;
            const { reason, author } = req.body || {};
            const alert = this.engine.dismissAlert(alertId, reason, author);
            if (!alert) {
                return res.status(404).json({ error: `Alert not found: ${alertId}` });
            }
            return res.status(200).json(alert);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getRules(req, res) {
        try {
            const rules = this.engine.getRules();
            return res.status(200).json({ rules });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async getMetrics(req, res) {
        try {
            const metrics = this.engine.getMetrics();
            return res.status(200).json(metrics);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
}

module.exports = DefenseController;
