// blueteam/src/detectors/rules/NewDeviceHighValueRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class NewDeviceHighValueRule {
    constructor(options = {}) {
        this.id = "RULE_NEW_DEVICE_HIGH_VALUE";
        this.name = "High-Value Transaction on Unrecognized / Fresh Device";
        this.category = DetectionCategory.DEVICE_INTEGRITY;
        this.highValueThreshold = options.highValueThreshold || 1000;
        this.newDeviceAgeHours = options.newDeviceAgeHours || 2;
        this.weight = options.weight || 0.88;
    }

    evaluate(features, event) {
        const isNewDevice = features.is_new_device === true;
        const deviceAge = features.device_age_hours !== undefined ? features.device_age_hours : 0;
        const amount = features.amount || 0;
        const amountRatio = features.amount_to_avg_ratio || 1;

        const isFresh = isNewDevice || deviceAge < this.newDeviceAgeHours;
        const isHigh = amount >= this.highValueThreshold || amountRatio >= 3.0;

        const triggered = isFresh && isHigh;

        return {
            rule_id: this.id,
            rule_name: this.name,
            category: this.category,
            triggered,
            score: triggered ? this.weight : 0.0,
            reasons: triggered ? [
                `High value transfer (\$${amount}) executed on newly enrolled/unrecognized device (age: ${deviceAge} hrs)`
            ] : []
        };
    }
}

module.exports = NewDeviceHighValueRule;
