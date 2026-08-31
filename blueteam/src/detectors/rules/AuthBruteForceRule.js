// blueteam/src/detectors/rules/AuthBruteForceRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class AuthBruteForceRule {
    constructor(options = {}) {
        this.id = "RULE_AUTH_BRUTE_FORCE";
        this.name = "Authentication Brute Force / Credential Stuffing";
        this.category = DetectionCategory.AUTH_CREDENTIAL;
        this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
        this.maxWindowFailures = options.maxWindowFailures || 4;
        this.weight = options.weight || 0.92;
    }

    evaluate(features, event) {
        const consecutive = features.consecutive_failed_logins || 0;
        const windowFailures = features.failed_auth_count_5m || 0;

        let triggered = false;
        const reasons = [];

        if (consecutive >= this.maxConsecutiveFailures) {
            triggered = true;
            reasons.push(`${consecutive} consecutive failed authentication attempts detected`);
        }

        if (windowFailures >= this.maxWindowFailures) {
            triggered = true;
            reasons.push(`${windowFailures} failed auth attempts within 5 minutes`);
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

module.exports = AuthBruteForceRule;
