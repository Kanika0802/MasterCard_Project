// blueteam/src/detectors/rules/MulePassThroughRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class MulePassThroughRule {
    constructor(options = {}) {
        this.id = "RULE_MULE_PASS_THROUGH";
        this.name = "Mule Account Rapid Pass-Through / Structuring";
        this.category = DetectionCategory.MULE_NETWORK;
        this.minPassThroughRatio = options.minPassThroughRatio || 0.80;
        this.weight = options.weight || 0.85;
    }

    evaluate(features, event) {
        const passThrough = features.pass_through_ratio || 0;
        const totalIn = features.total_inflow || 0;
        const totalOut = features.total_outflow || 0;
        const cycle = features.cycle_detected === true;
        const muleDistance = features.min_distance_to_mule;

        let triggered = false;
        const reasons = [];

        if (passThrough >= this.minPassThroughRatio && (totalIn > 500 || totalOut > 500)) {
            triggered = true;
            reasons.push(`High pass-through flow (${(passThrough * 100).toFixed(1)}%) indicating mule transit behavior`);
        }

        if (cycle) {
            triggered = true;
            reasons.push("Circular transaction flow detected in graph topology");
        }

        if (muleDistance === 0 || muleDistance === 1) {
            triggered = true;
            reasons.push(`Direct network adjacency to confirmed mule account (hops: ${muleDistance})`);
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

module.exports = MulePassThroughRule;
