// blueteam/src/mitigation/MitigationActionExecutor.js
"use strict";

const { DefenseDecisionType } = require("../domain/constants");

class MitigationActionExecutor {
    constructor(options = {}) {
        this.simulatorClient = options.simulatorClient || null;
        this.executionLog = [];
    }

    async executeMitigation(decision, event = {}) {
        if (!decision) return null;

        const actionRecord = {
            decision_id: decision.decision_id,
            action: decision.action,
            target_entity_type: decision.target_entity_type,
            target_entity_id: decision.target_entity_id,
            executed_at: new Date().toISOString(),
            status: "EXECUTED",
            details: {}
        };

        // If connected to live simulator client and critical mitigation required
        if (this.simulatorClient) {
            try {
                if (decision.action === DefenseDecisionType.FREEZE_ACCOUNT && decision.target_entity_type === "account") {
                    await this.simulatorClient.executeAction({
                        action: "CHANGE_ACCOUNT_STATUS",
                        parameters: {
                            account_id: decision.target_entity_id,
                            status: "FROZEN",
                            reason: "Blue Team automated fraud defense freeze"
                        }
                    });
                    actionRecord.details.simulator_called = true;
                }
            } catch (err) {
                actionRecord.status = "FAILED";
                actionRecord.details.error = err.message;
            }
        }

        this.executionLog.push(actionRecord);
        return actionRecord;
    }

    getExecutionHistory() {
        return [...this.executionLog];
    }

    clear() {
        this.executionLog = [];
    }
}

module.exports = MitigationActionExecutor;
