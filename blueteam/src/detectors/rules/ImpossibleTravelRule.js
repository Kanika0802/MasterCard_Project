// blueteam/src/detectors/rules/ImpossibleTravelRule.js
"use strict";

const { DetectionCategory } = require("../../domain/constants");

class ImpossibleTravelRule {
    constructor(options = {}) {
        this.id = "RULE_IMPOSSIBLE_TRAVEL";
        this.name = "Impossible Geo-Velocity Travel";
        this.category = DetectionCategory.GEOLOCATION;
        this.maxSpeedKmH = options.maxSpeedKmH || 800; // Commercial airliner speed limit
        this.weight = options.weight || 0.90;
    }

    evaluate(features, event) {
        const speed = features.geo_speed_kmh || 0;
        const triggered = speed > this.maxSpeedKmH;

        return {
            rule_id: this.id,
            rule_name: this.name,
            category: this.category,
            triggered,
            score: triggered ? this.weight : 0.0,
            reasons: triggered ? [`Impossible physical displacement speed: ${speed} km/h (threshold: ${this.maxSpeedKmH} km/h)`] : []
        };
    }
}

module.exports = ImpossibleTravelRule;
