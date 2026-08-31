// blueteam/src/detectors/rules/KycTamperingRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class KycTamperingRule {
    constructor(options = {}) {
        this.id = "RULE_KYC_TAMPERING";
        this.name = "Synthetic Document / KYC Modification Tampering";
        this.category = DetectionCategory.KYC_SYNTHETIC;
        this.weight = options.weight || 0.95;
    }

    evaluate(features, event) {
        const isTampered = features.is_kyc_tampered === true;
        const isUnverified = features.is_kyc_verified === false;
        const amount = features.amount || 0;

        let triggered = false;
        const reasons = [];

        if (isTampered) {
            triggered = true;
            reasons.push("KYC record exhibits synthetic attributes, failed verification, or rejection flags");
        }

        if (isUnverified && amount > 2000) {
            triggered = true;
            reasons.push(`High-value transaction (\$${amount}) attempted by unverified KYC profile`);
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

module.exports = KycTamperingRule;
