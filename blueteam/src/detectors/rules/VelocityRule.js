// blueteam/src/detectors/rules/VelocityRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class VelocityRule {
    constructor(options = {}) {
        this.id = "RULE_VELOCITY_SPIKE";
        this.name = "Transaction Velocity Spike / Rapid Splitting";
        this.category = DetectionCategory.VELOCITY;
        this.maxCount1m = options.maxCount1m || 3;
        this.maxCount5m = options.maxCount5m || 5;
        this.maxSum5m = options.maxSum5m || 10000;
        this.weight = options.weight || 0.85;
    }

    evaluate(features, event) {
        const count1m = features.velocity_count_1m || 0;
        const count5m = features.velocity_count_5m || 0;
        const sum5m = features.velocity_sum_5m || 0;

        let triggered = false;
        const reasons = [];

        if (count1m >= this.maxCount1m) {
            triggered = true;
            reasons.push(`High 1-minute velocity: ${count1m} transactions (threshold: ${this.maxCount1m})`);
        }

        if (count5m >= this.maxCount5m) {
            triggered = true;
            reasons.push(`High 5-minute velocity: ${count5m} transactions (threshold: ${this.maxCount5m})`);
        }

        if (sum5m >= this.maxSum5m) {
            triggered = true;
            reasons.push(`High 5-minute aggregate outflow: \$${sum5m} (threshold: \$${this.maxSum5m})`);
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

module.exports = VelocityRule;
