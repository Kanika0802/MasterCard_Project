// blueteam/src/detectors/rules/AccountFreezeRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class AccountFreezeRule {
    constructor(options = {}) {
        this.id = "RULE_ACCOUNT_STATUS_TAMPER";
        this.name = "Account Status Manipulation / Inactive Account Drainage";
        this.category = DetectionCategory.ACCOUNT_TAMPERING;
        this.weight = options.weight || 0.90;
    }

    evaluate(features, event) {
        const payload = event?.payload || {};
        const accountStatus = payload.status || features.account_status;

        let triggered = false;
        const reasons = [];

        if (event?.event_type === "ACCOUNT_STATUS_CHANGED" && (payload.status === "ACTIVE" && payload.previous_status === "FROZEN")) {
            triggered = true;
            reasons.push("Sudden unfreezing / reactivation of high-risk frozen account");
        }

        if (accountStatus === "FROZEN" || accountStatus === "SUSPENDED") {
            triggered = true;
            reasons.push(`Operation attempted on ${accountStatus} account`);
        }

        return {
            rule_id: this.id,
            rule_name: this.name,
            category: this.category,
            triggered,
            score: triggered ? this.weight : 0.0,
            reasons
        };
    }
}

module.exports = AccountFreezeRule;
